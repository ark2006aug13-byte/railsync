"""
services/live_train_service.py
Isolated, production-grade service to fetch, normalize, and cache
real-time live train location and route schedule for Indian Railways.
"""
import asyncio
from datetime import datetime, timezone, timedelta
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple

import httpx

from api.v1.schemas import (
    Coordinates,
    LastStation,
    LiveTelemetry,
    LiveTrainStatusResponse,
    NextStation,
    RouteProgress,
    ScheduleStoppage,
    TrainInfo,
    TrainStatusEnum,
)
from services.cache_service import async_cache
from engine.train_registry import (
    resolve_train_profile,
    resolve_station_coordinates,
    TRAIN_PROFILES,
    _STATIONS_GEO,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Input Validation & Date Normalization
# ---------------------------------------------------------------------------

def validate_train_number(train_number: str) -> str:
    """Validates that train_number is a strict 5-digit numeric string."""
    clean = str(train_number).strip()
    if not re.match(r"^\d{5}$", clean):
        raise ValueError(f"Invalid train number '{train_number}'. Must be a 5-digit numeric string (e.g. 12424).")
    return clean


def validate_and_normalize_date(journey_date: Optional[str]) -> Tuple[str, str]:
    """
    Validates calendar date. Supports YYYY-MM-DD and DD-MM-YYYY formats.
    Returns: (normalized_yyyy_mm_dd, yyyymmdd)
    Raises: ValueError if the date is invalid or non-existent in the calendar.
    """
    if not journey_date or not str(journey_date).strip():
        # Default to today's date in IST (UTC+5:30)
        ist_now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
        return ist_now.strftime("%Y-%m-%d"), ist_now.strftime("%Y%m%d")

    clean_d = str(journey_date).strip()
    valid_formats = ["%Y-%m-%d", "%d-%m-%Y"]
    for fmt in valid_formats:
        try:
            parsed = datetime.strptime(clean_d, fmt)
            return parsed.strftime("%Y-%m-%d"), parsed.strftime("%Y%m%d")
        except ValueError:
            continue

    raise ValueError(
        f"Invalid journey_date '{journey_date}'. Must be a valid calendar date in YYYY-MM-DD or DD-MM-YYYY format."
    )


def parse_delay_minutes(delay_val: Any) -> int:
    """Parses delay string or number into an integer number of minutes."""
    if delay_val is None:
        return 0
    if isinstance(delay_val, (int, float)):
        return max(0, int(delay_val))
    s = str(delay_val).strip().upper()
    if s in ["ON TIME", "RIGHT TIME", "RT", "0", "00", ""]:
        return 0
    m = re.search(r"(\d+)", s)
    if m:
        return int(m.group(1))
    return 0


# ---------------------------------------------------------------------------
# Live Train Service
# ---------------------------------------------------------------------------

class LiveTrainService:
    """
    Production-ready railway telemetry aggregator.
    Handles caching (45s TTL), multi-provider HTTP requests with 8s timeout,
    strict schema normalization, and resilient mock fallback.
    """

    CACHE_TTL_SECONDS = 45
    HTTP_TIMEOUT_SECONDS = 8.0

    def __init__(self):
        self.railway_api_key = os.getenv("RAILWAY_API_KEY") or os.getenv("INDIAN_RAIL_API_KEY")
        self.railway_api_host = os.getenv("RAILWAY_API_HOST", "irctc1.p.rapidapi.com")

    async def get_live_train_status(
        self, train_number: str, journey_date: Optional[str] = None
    ) -> Tuple[LiveTrainStatusResponse, str]:
        """
        Main entrypoint.
        Returns (LiveTrainStatusResponse, data_source) where data_source is 'cache', 'live', or 'mock'.
        """
        # 1. Strict Validation
        clean_train_no = validate_train_number(train_number)
        norm_date, yyyymmdd = validate_and_normalize_date(journey_date)

        # 2. Cache Lookup
        cache_key = f"live_train:{clean_train_no}:{norm_date}"
        cached_dict = await async_cache.get(cache_key)
        if cached_dict:
            try:
                response_obj = LiveTrainStatusResponse.model_validate(cached_dict)
                logger.info(f"[LiveTrainService] Cache HIT for {cache_key}")
                return response_obj, "cache"
            except Exception as e:
                logger.warning(f"[LiveTrainService] Cached model deserialization failed: {e}")

        # 3. External API Request (with 8s timeout)
        live_payload = None
        source = "live"

        try:
            live_payload = await self._fetch_from_external_api(clean_train_no, norm_date, yyyymmdd)
        except Exception as e:
            logger.warning(f"[LiveTrainService] External API fetch failed: {e}. Falling back to resilient mock.")

        # 4. Fallback if External API failed or returned invalid response
        if not live_payload:
            source = "mock"
            live_payload = self._generate_mock_payload(clean_train_no, norm_date)

        # 5. Normalization against strict Pydantic v2 model
        response_model = self._normalize_payload(live_payload, clean_train_no, norm_date)

        # 6. Save to Cache with 45s TTL
        try:
            await async_cache.set(
                cache_key,
                response_model.model_dump(),
                ttl_seconds=self.CACHE_TTL_SECONDS
            )
        except Exception as e:
            logger.error(f"[LiveTrainService] Failed to cache response: {e}")

        return response_model, source

    async def _fetch_from_external_api(
        self, train_no: str, norm_date: str, yyyymmdd: str
    ) -> Optional[Dict[str, Any]]:
        """
        Fetches live train telemetry from external providers using httpx.AsyncClient with 8.0s timeout.
        Tries Indian Rail API first, then RapidAPI if configured.
        """
        timeout = httpx.Timeout(self.HTTP_TIMEOUT_SECONDS)

        async with httpx.AsyncClient(timeout=timeout) as client:
            # --- Strategy A: Indian Rail API ---
            if self.railway_api_key:
                indian_rail_url = (
                    f"http://indianrailapi.com/api/v2/livetrainstatus/"
                    f"apikey/{self.railway_api_key}/trainnumber/{train_no}/date/{yyyymmdd}/"
                )
                try:
                    logger.info(f"[LiveTrainService] Querying Indian Rail API for {train_no} ({yyyymmdd})...")
                    resp = await client.get(
                        indian_rail_url,
                        headers={"User-Agent": "RailSync/2.0 (FastAPI Production Engine)"}
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("ResponseCode") in ["200", 200] and data.get("TrainRoute"):
                            return {"provider": "indian_rail_api", "raw": data}
                        elif data.get("ResponseCode") in ["429", 429]:
                            logger.warning("[LiveTrainService] Indian Rail API rate-limited (429).")
                    elif resp.status_code == 429:
                        logger.warning("[LiveTrainService] HTTP 429 Too Many Requests from Indian Rail API.")
                except httpx.TimeoutException:
                    logger.warning("[LiveTrainService] Indian Rail API timed out (8.0s).")
                except Exception as e:
                    logger.debug(f"[LiveTrainService] Indian Rail API exception: {e}")

            # --- Strategy B: RapidAPI Indian Railways ---
            if self.railway_api_key and self.railway_api_host:
                rapid_url = f"https://{self.railway_api_host}/api/v1/liveTrainStatus"
                headers = {
                    "x-rapidapi-key": self.railway_api_key,
                    "x-rapidapi-host": self.railway_api_host,
                    "User-Agent": "RailSync/2.0",
                }
                params = {"trainNo": train_no, "date": norm_date}
                try:
                    logger.info(f"[LiveTrainService] Querying RapidAPI ({self.railway_api_host}) for {train_no}...")
                    resp = await client.get(rapid_url, headers=headers, params=params)
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("status") in [True, "success", 200] or data.get("data"):
                            return {"provider": "rapidapi", "raw": data}
                    elif resp.status_code == 429:
                        logger.warning("[LiveTrainService] RapidAPI rate-limited (HTTP 429).")
                except httpx.TimeoutException:
                    logger.warning("[LiveTrainService] RapidAPI timed out (8.0s).")
                except Exception as e:
                    logger.debug(f"[LiveTrainService] RapidAPI exception: {e}")

        return None

    def _normalize_payload(
        self, payload: Dict[str, Any], train_no: str, norm_date: str
    ) -> LiveTrainStatusResponse:
        """
        Normalizes varying upstream payloads (Indian Rail API, RapidAPI, or Mock)
        into the strict LiveTrainStatusResponse Pydantic model.
        """
        provider = payload.get("provider", "mock")
        raw = payload.get("raw", {})

        if provider == "indian_rail_api":
            return self._normalize_indian_rail_api(raw, train_no, norm_date)
        elif provider == "rapidapi":
            return self._normalize_rapidapi(raw, train_no, norm_date)
        else:
            return self._normalize_mock(raw, train_no, norm_date)

    def _normalize_indian_rail_api(
        self, raw: Dict[str, Any], train_no: str, norm_date: str
    ) -> LiveTrainStatusResponse:
        """Normalizes Indian Rail API JSON format."""
        train_name = raw.get("TrainName") or f"Train {train_no}"
        current_stn = raw.get("CurrentStation", {}) or {}
        curr_code = current_stn.get("StationCode", "")
        curr_name = current_stn.get("StationName", curr_code)
        raw_route = raw.get("TrainRoute", [])

        delay_minutes = parse_delay_minutes(current_stn.get("DelayInArrival") or current_stn.get("DelayInDeparture"))
        
        # Operational Status
        status_enum = TrainStatusEnum.RUNNING
        if current_stn.get("AtSource", False):
            status_enum = TrainStatusEnum.YET_TO_START
        elif current_stn.get("AtDestination", False):
            status_enum = TrainStatusEnum.REACHED

        # Build schedule stoppages
        stoppages: List[ScheduleStoppage] = []
        last_stn_obj: Optional[LastStation] = None
        next_stn_obj: Optional[NextStation] = None
        completed_count = 0
        current_stn_idx = -1

        for idx, s in enumerate(raw_route):
            code = s.get("StationCode", "").strip()
            name = s.get("StationName", code).strip()
            arr = s.get("ScheduleArrival") or ("START" if idx == 0 else "--:--")
            dep = s.get("ScheduleDeparture") or ("END" if idx == len(raw_route) - 1 else "--:--")
            dist = float(s.get("DistanceFromSource", 0.0) or 0.0)
            
            # Resolve coordinates
            lat = s.get("lat") or s.get("Latitude")
            lng = s.get("lng") or s.get("Longitude")
            if lat is None or lng is None:
                r_lat, r_lng = resolve_station_coordinates(code)
                lat = r_lat if r_lat is not None else 25.0
                lng = r_lng if r_lng is not None else 82.0

            is_dep = str(s.get("IsDeparted", "")).lower() in ["true", "1", "yes", "y"]
            if is_dep or (curr_code and code == curr_code):
                has_passed = True
                completed_count += 1
                current_stn_idx = idx
            else:
                has_passed = False

            stoppages.append(
                ScheduleStoppage(
                    station_code=code,
                    station_name=name,
                    scheduled_arrival=arr,
                    scheduled_departure=dep,
                    distance_km=dist,
                    coordinates=Coordinates(latitude=lat, longitude=lng),
                    has_passed=has_passed,
                )
            )

        # Determine last and next stations
        if current_stn_idx >= 0 and current_stn_idx < len(stoppages):
            cur_s = stoppages[current_stn_idx]
            last_stn_obj = LastStation(
                code=cur_s.station_code,
                name=cur_s.station_name,
                actual_departure=cur_s.scheduled_departure if cur_s.scheduled_departure != "END" else "12:00",
                delay_dep_minutes=delay_minutes,
            )
            if current_stn_idx + 1 < len(stoppages):
                nxt_s = stoppages[current_stn_idx + 1]
                dist_rem = max(1.0, round(nxt_s.distance_km - cur_s.distance_km, 1))
                next_stn_obj = NextStation(
                    code=nxt_s.station_code,
                    name=nxt_s.station_name,
                    scheduled_arrival=nxt_s.scheduled_arrival,
                    estimated_arrival=nxt_s.scheduled_arrival,
                    distance_to_go_km=dist_rem,
                )

        # Coordinates
        curr_coords = Coordinates(
            latitude=stoppages[max(0, current_stn_idx)].coordinates.latitude if stoppages else 28.6415,
            longitude=stoppages[max(0, current_stn_idx)].coordinates.longitude if stoppages else 77.2185,
        )

        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        return LiveTrainStatusResponse(
            status="success",
            train_info=TrainInfo(
                train_number=train_no,
                train_name=train_name,
                journey_date=norm_date,
            ),
            live_telemetry=LiveTelemetry(
                current_status=status_enum,
                current_coordinates=curr_coords,
                current_speed_kmh=110.0 if status_enum == TrainStatusEnum.RUNNING else 0.0,
                current_location_text=f"Near {curr_name} ({curr_code})" if curr_name else "In Transit",
                delay_minutes=delay_minutes,
                last_updated_time=now_iso,
            ),
            route_progress=RouteProgress(
                last_station=last_stn_obj,
                next_station=next_stn_obj,
                total_stations_count=len(stoppages),
                completed_stations_count=completed_count,
            ),
            schedule_stoppages=stoppages,
        )

    def _normalize_rapidapi(
        self, raw: Dict[str, Any], train_no: str, norm_date: str
    ) -> LiveTrainStatusResponse:
        """Normalizes RapidAPI payload (delegates to standard model mapping)."""
        data = raw.get("data") or raw
        # Map fields flexibly
        return self._normalize_mock(data, train_no, norm_date)

    def _normalize_mock(
        self, raw: Dict[str, Any], train_no: str, norm_date: str
    ) -> LiveTrainStatusResponse:
        """Parses generated or structured mock data directly into the strict schema."""
        return LiveTrainStatusResponse.model_validate(raw)

    def _generate_mock_payload(self, train_no: str, norm_date: str) -> Dict[str, Any]:
        """
        Generates an authentic, highly realistic mock live status payload
        for development and testing using genuine train profiles from train_registry.
        """
        # Resolve train profile
        profile = resolve_train_profile(train_no) or TRAIN_PROFILES.get("12424") or TRAIN_PROFILES.get("12301")
        train_name = profile.get("name", f"Train {train_no} Express")
        stations = profile.get("stations", [])

        # Default fallback route if profile has empty stations
        if not stations:
            stations = [
                {"code": "NDLS", "name": "New Delhi", "km": 0.0, "lat": 28.6415, "lng": 77.2185},
                {"code": "ALJN", "name": "Aligarh Junction", "km": 131.0, "lat": 27.8974, "lng": 78.0880},
                {"code": "TDL", "name": "Tundla Junction", "km": 204.0, "lat": 27.2067, "lng": 78.2439},
                {"code": "CNB", "name": "Kanpur Central", "km": 440.0, "lat": 26.4547, "lng": 80.3507},
                {"code": "PRYJ", "name": "Prayagraj Jn", "km": 635.0, "lat": 25.4497, "lng": 81.8282},
                {"code": "DDU", "name": "Pt. Deen Dayal Upadhyaya Jn", "km": 784.0, "lat": 25.2785, "lng": 83.1235},
                {"code": "DBRG", "name": "Dibrugarh", "km": 2426.0, "lat": 27.4728, "lng": 94.9120},
            ]

        total_stations = len(stations)
        # Position train realistically at ~25% to 50% along the route
        active_idx = min(len(stations) - 2, max(1, total_stations // 3))
        last_s = stations[active_idx]
        next_s = stations[active_idx + 1]

        # Interpolate coordinates between last and next station
        last_lat = last_s.get("lat") or 27.8974
        last_lng = last_s.get("lng") or 78.0880
        next_lat = next_s.get("lat") or 27.2067
        next_lng = next_s.get("lng") or 78.2439

        cur_lat = round(last_lat + (next_lat - last_lat) * 0.45, 4)
        cur_lng = round(last_lng + (next_lng - last_lng) * 0.45, 4)

        now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        stoppages_data = []
        for idx, s in enumerate(stations):
            c_code = s.get("code", "STN")
            c_name = s.get("name", c_code)
            c_km = float(s.get("km", idx * 100.0))
            
            c_lat = s.get("lat")
            c_lng = s.get("lng")
            if c_lat is None or c_lng is None:
                r_lat, r_lng = resolve_station_coordinates(c_code)
                c_lat = r_lat if r_lat is not None else 26.5
                c_lng = r_lng if r_lng is not None else 80.5

            arr_str = "START" if idx == 0 else f"{14 + (idx * 2) % 10:02d}:{(idx * 15) % 60:02d}"
            dep_str = "END" if idx == len(stations) - 1 else f"{14 + (idx * 2) % 10:02d}:{(idx * 15 + 5) % 60:02d}"

            stoppages_data.append({
                "station_code": c_code,
                "station_name": c_name,
                "scheduled_arrival": arr_str,
                "scheduled_departure": dep_str,
                "distance_km": c_km,
                "coordinates": {"latitude": round(float(c_lat), 6), "longitude": round(float(c_lng), 6)},
                "has_passed": idx <= active_idx,
            })

        dist_to_go = round(max(5.0, stoppages_data[active_idx + 1]["distance_km"] - stoppages_data[active_idx]["distance_km"] - 12.0), 1)

        mock_payload = {
            "status": "success",
            "train_info": {
                "train_number": train_no,
                "train_name": train_name,
                "journey_date": norm_date,
            },
            "live_telemetry": {
                "current_status": "RUNNING",
                "current_coordinates": {
                    "latitude": cur_lat,
                    "longitude": cur_lng,
                },
                "current_speed_kmh": 118.5,
                "current_location_text": f"Approaching {next_s.get('name', 'Next Station')}",
                "delay_minutes": 12,
                "last_updated_time": now_utc,
            },
            "route_progress": {
                "last_station": {
                    "code": last_s.get("code", "ALJN"),
                    "name": last_s.get("name", "Aligarh Junction"),
                    "actual_departure": stoppages_data[active_idx]["scheduled_departure"],
                    "delay_dep_minutes": 10,
                },
                "next_station": {
                    "code": next_s.get("code", "TDL"),
                    "name": next_s.get("name", "Tundla Junction"),
                    "scheduled_arrival": stoppages_data[active_idx + 1]["scheduled_arrival"],
                    "estimated_arrival": stoppages_data[active_idx + 1]["scheduled_arrival"],
                    "distance_to_go_km": dist_to_go,
                },
                "total_stations_count": total_stations,
                "completed_stations_count": active_idx + 1,
            },
            "schedule_stoppages": stoppages_data,
        }

        return {"provider": "mock", "raw": mock_payload}


# Global singleton instance
live_train_service = LiveTrainService()
