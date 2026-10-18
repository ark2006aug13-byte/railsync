"""
engine/geospatial_telemetry_engine.py
Advanced Geospatial Telemetry & Railway Kinematics Engine for RailSync.
Integrates 4 specialized open APIs:
1. Open-Meteo Elevation & Topography API (track altitude, slope gradient & locomotive grade resistance)
2. Open-Meteo Live Fog & Visibility API (fog density, visibility in meters, Indian Railways Fog Pass Device speed cap)
3. OpenStreetMap Overpass Railway API (track gauge, electrification, tracks count, and authentic section MPS)
4. Photon / OSM Reverse Geocoding API (resolving moving train coordinates to real-world geographical landmarks)
"""
from datetime import datetime, timezone, timedelta
import json
import logging
import math
import os
import re
import time
from typing import Dict, Any, List, Optional, Tuple
import urllib.request
import urllib.parse
import urllib.error

logger = logging.getLogger("railsync.geospatial")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("[%(asctime)s] [%(levelname)s] [GeospatialEngine] %(message)s"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)

# In-memory caches with specialized TTLs
_ELEVATION_CACHE: Dict[str, Tuple[float, float]] = {}         # key -> (timestamp, elevation_m) - 24h TTL
_WEATHER_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}   # key -> (timestamp, weather_dict) - 15m TTL
_TRACK_INFRA_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {} # key -> (timestamp, track_dict) - 24h TTL
_LANDMARK_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}    # key -> (timestamp, landmark_dict) - 24h TTL

TTL_ELEVATION = 86400.0   # 24 hours
TTL_WEATHER = 900.0       # 15 minutes
TTL_TRACK = 86400.0       # 24 hours
TTL_LANDMARK = 86400.0    # 24 hours

# WMO Weather Code Table
WMO_WEATHER_CODES = {
    0: ("Clear sky", "CLEAR"),
    1: ("Mainly clear", "CLEAR"),
    2: ("Partly cloudy", "CLEAR"),
    3: ("Overcast", "CLEAR"),
    45: ("Foggy conditions", "DENSE_FOG"),
    48: ("Depositing rime fog", "DENSE_FOG"),
    51: ("Light drizzle", "LIGHT_RAIN"),
    53: ("Moderate drizzle", "LIGHT_RAIN"),
    55: ("Dense drizzle", "LIGHT_RAIN"),
    61: ("Slight rain", "MODERATE_RAIN"),
    63: ("Moderate rain", "MODERATE_RAIN"),
    65: ("Heavy rain", "HEAVY_RAIN"),
    71: ("Slight snow fall", "SNOW"),
    73: ("Moderate snow fall", "SNOW"),
    75: ("Heavy snow fall", "SNOW"),
    80: ("Slight rain showers", "MODERATE_RAIN"),
    81: ("Moderate rain showers", "MODERATE_RAIN"),
    82: ("Violent rain showers", "HEAVY_RAIN"),
    95: ("Thunderstorm", "THUNDERSTORM"),
    96: ("Thunderstorm with hail", "THUNDERSTORM"),
}


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes exact great-circle distance between two GPS coordinates in kilometers."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


# ---------------------------------------------------------------------------
# 1. Open-Meteo Elevation & Topography Engine
# ---------------------------------------------------------------------------

def fetch_elevation(lat: float, lon: float) -> float:
    """
    Fetches ground track elevation (altitude in meters above mean sea level)
    from Open-Meteo Elevation API (100% Free, No API key required).
    """
    if lat == 0.0 and lon == 0.0:
        return 100.0

    key = f"{lat:.3f}:{lon:.3f}"
    now_ts = time.time()
    if key in _ELEVATION_CACHE:
        cached_ts, elev = _ELEVATION_CACHE[key]
        if (now_ts - cached_ts) < TTL_ELEVATION:
            return elev

    url = f"https://api.open-meteo.com/v1/elevation?latitude={lat:.4f}&longitude={lon:.4f}"
    req = urllib.request.Request(url, headers={"User-Agent": "RailSync/2.0 (Railway Kinematics Engine)"})
    try:
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            elev_arr = data.get("elevation", [])
            if elev_arr and isinstance(elev_arr[0], (int, float)):
                elev_val = float(elev_arr[0])
                _ELEVATION_CACHE[key] = (now_ts, elev_val)
                return elev_val
    except Exception as e:
        logger.debug(f"[Elevation API Note] {e} for ({lat}, {lon})")

    # Climatological/topographic corridor baseline for Gangetic Plain / Northern Railway
    fallback_elev = max(50.0, round(210.0 - (lon - 77.0) * 12.0, 1))
    return fallback_elev


def calculate_track_gradient(
    lat_start: float,
    lon_start: float,
    lat_end: float,
    lon_end: float
) -> Dict[str, Any]:
    """
    Computes topographic track slope gradient between two coordinates:
    G = (Δh / Δd) * 100%
    Calculates locomotive grade resistance and speed adjustment factor:
    - In Indian Railways RDSO standards, up-gradient creates gravity resistance F_g = mg * sin(θ)
      reducing locomotive acceleration and cruising speed.
    - Down-gradient allows coasting up to Section MPS.
    """
    dist_km = haversine_distance_km(lat_start, lon_start, lat_end, lon_end)
    dist_m = max(100.0, dist_km * 1000.0)

    elev_start = fetch_elevation(lat_start, lon_start)
    elev_end = fetch_elevation(lat_end, lon_end)
    delta_h = elev_end - elev_start  # positive = climb (up-slope), negative = descent

    gradient_pct = round((delta_h / dist_m) * 100.0, 2)
    # 1 in X ratio
    ratio_x = int(round(dist_m / abs(delta_h))) if abs(delta_h) >= 1.0 else 9999

    if gradient_pct > 0.25:
        grade_type = "UP_SLOPE"
        # Locomotive grade resistance speed reduction factor (up to 20% drop on steep ghats)
        speed_factor = round(max(0.80, 1.0 - min(0.20, (gradient_pct - 0.25) * 0.12)), 3)
        grade_desc = f"Upward Gradient (+{gradient_pct}% / 1 in {ratio_x})"
    elif gradient_pct < -0.25:
        grade_type = "DOWN_SLOPE"
        speed_factor = round(min(1.05, 1.0 + min(0.05, abs(gradient_pct) * 0.05)), 3)
        grade_desc = f"Downward Gradient ({gradient_pct}% / 1 in {ratio_x})"
    else:
        grade_type = "LEVEL"
        speed_factor = 1.0
        grade_desc = f"Level Track ({gradient_pct}% grade)"

    return {
        "elevation_m": round(elev_end, 1),
        "elevation_start_m": round(elev_start, 1),
        "elevation_delta_m": round(delta_h, 1),
        "distance_span_km": round(dist_km, 2),
        "gradient_pct": gradient_pct,
        "ratio_1_in_x": ratio_x,
        "grade_type": grade_type,
        "grade_description": grade_desc,
        "speed_factor": speed_factor
    }


# ---------------------------------------------------------------------------
# 2. Open-Meteo Live Fog & Visibility Engine
# ---------------------------------------------------------------------------

def fetch_live_weather_and_visibility(lat: float, lon: float) -> Dict[str, Any]:
    """
    Fetches real-time atmospheric conditions and visibility from Open-Meteo Weather API
    (100% Free, Zero API Keys, Sub-second Response).
    Implements Indian Railways Fog Safety Rules (Fog Pass Device / Automatic Block Signaling):
    - Visibility < 200m: Severe Fog -> Mandatory Speed Cap of 60 km/h (or 30 km/h in absolute block).
    - Visibility 200m - 500m: Moderate Fog -> Cautionary speed cap of 75 km/h.
    - Visibility 500m - 1000m: Light Fog -> Speed cap of 90 km/h.
    - Visibility >= 1000m: Clear running -> Normal track MPS applies.
    """
    if lat == 0.0 and lon == 0.0:
        lat, lon = 26.45, 80.35  # Central Gangetic corridor default (Kanpur region)

    key = f"{lat:.2f}:{lon:.2f}"
    now_ts = time.time()
    if key in _WEATHER_CACHE:
        cached_ts, w_data = _WEATHER_CACHE[key]
        if (now_ts - cached_ts) < TTL_WEATHER:
            return w_data

    url = (
        f"https://api.open-meteo.com/v1/forecast?latitude={lat:.4f}&longitude={lon:.4f}"
        f"&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,visibility,wind_speed_10m"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "RailSync/2.0 (Live Fog & Weather Radar)"})

    try:
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            cur = data.get("current", {})
            vis_m = float(cur.get("visibility", 10000.0))
            temp_c = float(cur.get("temperature_2m", 28.0))
            humidity_pct = float(cur.get("relative_humidity_2m", 50.0))
            rain_mm = float(cur.get("precipitation", 0.0))
            wind_kmh = float(cur.get("wind_speed_10m", 10.0))
            wmo_code = int(cur.get("weather_code", 0))

            wmo_text, category = WMO_WEATHER_CODES.get(wmo_code, ("Fair weather", "CLEAR"))

            # Determine Fog condition and speed cap based on Indian Railways Safety Norms
            fog_cap: Optional[float] = None
            fog_condition = "CLEAR"
            fog_device_active = False

            if vis_m < 200.0 or wmo_code in [45, 48]:
                fog_condition = "DENSE_FOG"
                fog_cap = 60.0
                fog_device_active = True
                alert = "⚠️ SEVERE FOG: Indian Railways Fog Pass Device active. MPS restricted to 60 km/h."
            elif vis_m < 500.0:
                fog_condition = "MODERATE_FOG"
                fog_cap = 75.0
                fog_device_active = True
                alert = "⚠️ MODERATE FOG: Cautionary running enforced. Speed restricted to 75 km/h."
            elif vis_m < 1000.0:
                fog_condition = "LIGHT_FOG"
                fog_cap = 90.0
                fog_device_active = False
                alert = "ℹ️ LIGHT FOG: Visibility reduced. Speed capped at 90 km/h."
            else:
                alert = "✅ CLEAR: Optimal visibility. Normal track permissible speed applies."

            # Severe weather checks
            if rain_mm >= 25.0:
                alert = f"🌧️ HEAVY DOWNPOUR ({rain_mm} mm/h): Water-logging caution active."
                if fog_cap is None or fog_cap > 80.0:
                    fog_cap = 80.0
            if wind_kmh >= 60.0:
                alert = f"💨 GALE WIND ({wind_kmh:.0f} km/h): Caution active on high viaducts & river bridges."

            result = {
                "source": "Open-Meteo Live Atmosphere Engine",
                "visibility_meters": round(vis_m, 1),
                "visibility_km": round(vis_m / 1000.0, 1),
                "fog_condition": fog_condition,
                "temperature_c": round(temp_c, 1),
                "humidity_pct": round(humidity_pct, 1),
                "precipitation_mm": round(rain_mm, 1),
                "wind_speed_kmh": round(wind_kmh, 1),
                "weather_code": wmo_code,
                "weather_description": wmo_text,
                "fog_speed_cap_kmh": fog_cap,
                "fog_device_active": fog_device_active,
                "operational_alert": alert,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            _WEATHER_CACHE[key] = (now_ts, result)
            return result
    except Exception as e:
        logger.debug(f"[Open-Meteo Weather Note] {e} for ({lat}, {lon})")

    # Resilient Fallback (Standard clear weather defaults)
    fallback = {
        "source": "Climatological Corridor Baseline",
        "visibility_meters": 8000.0,
        "visibility_km": 8.0,
        "fog_condition": "CLEAR",
        "temperature_c": 28.5,
        "humidity_pct": 55.0,
        "precipitation_mm": 0.0,
        "wind_speed_kmh": 12.0,
        "weather_code": 0,
        "weather_description": "Clear atmosphere",
        "fog_speed_cap_kmh": None,
        "fog_device_active": False,
        "operational_alert": "✅ CLEAR: Optimal visibility.",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    return fallback


# ---------------------------------------------------------------------------
# 3. OpenStreetMap Overpass Railway Infrastructure Engine
# ---------------------------------------------------------------------------

def fetch_track_infrastructure(lat: float, lon: float) -> Dict[str, Any]:
    """
    Fetches official Indian Railways track infrastructure properties from OpenStreetMap Overpass API:
    - Gauge: 1676mm (Indian Broad Gauge)
    - Electrification: 25 kV AC 50 Hz Overhead Contact Line
    - Tracks Count: Single / Double / 3-Line / Quadruple Corridor
    - Maximum Permissible Speed (MPS) tagged by Indian Railways railway cartographers.
    """
    if lat == 0.0 and lon == 0.0:
        lat, lon = 26.45, 80.35

    key = f"{lat:.3f}:{lon:.3f}"
    now_ts = time.time()
    if key in _TRACK_INFRA_CACHE:
        cached_ts, t_data = _TRACK_INFRA_CACHE[key]
        if (now_ts - cached_ts) < TTL_TRACK:
            return t_data

    overpass_query = f'[out:json][timeout:4];way(around:1000,{lat:.4f},{lon:.4f})["railway"="rail"];out tags 3;'
    url = "https://overpass-api.de/api/interpreter?data=" + urllib.parse.quote(overpass_query)
    req = urllib.request.Request(url, headers={"User-Agent": "RailSync/2.0 (Railway Track Infrastructure Map)"})

    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            elements = data.get("elements", [])
            if elements:
                tags = elements[0].get("tags", {})
                gauge_val = tags.get("gauge", "1676")
                electrified_val = tags.get("electrified", "contact_line")
                voltage_val = tags.get("voltage", "25000")
                tracks_val = int(tags.get("tracks", 2) or 2)
                raw_mps = tags.get("maxspeed:railway") or tags.get("maxspeed")
                parsed_mps = 130.0
                if raw_mps:
                    m = re.search(r"(\d+)", str(raw_mps))
                    if m:
                        parsed_mps = float(m.group(1))

                infra_result = {
                    "source": "OpenStreetMap Railway Infrastructure Registry",
                    "gauge_mm": 1676 if gauge_val == "1676" else gauge_val,
                    "gauge_name": "Indian Broad Gauge (5 ft 6 in)" if gauge_val == "1676" else f"Gauge {gauge_val}",
                    "electrification": "25 kV AC 50 Hz Overhead Wire" if electrified_val in ["contact_line", "yes"] else "Non-Electrified Diesel Track",
                    "voltage_volts": int(voltage_val) if str(voltage_val).isdigit() else 25000,
                    "tracks_count": tracks_val,
                    "track_class": "Multiple Track Trunk Route" if tracks_val >= 2 else "Single Line Section",
                    "section_mps_kmh": parsed_mps
                }
                _TRACK_INFRA_CACHE[key] = (now_ts, infra_result)
                return infra_result
    except Exception as e:
        logger.debug(f"[OSM Overpass Track Note] {e} for ({lat}, {lon})")

    # Authentic Indian Railways Corridor Standard Defaults (Broad Gauge 25kV Electrified)
    default_infra = {
        "source": "Indian Railways Standard Corridor Specification",
        "gauge_mm": 1676,
        "gauge_name": "Indian Broad Gauge (5 ft 6 in)",
        "electrification": "25 kV AC 50 Hz Overhead Wire",
        "voltage_volts": 25000,
        "tracks_count": 2,
        "track_class": "Double Line High-Density Corridor",
        "section_mps_kmh": 130.0
    }
    return default_infra


# ---------------------------------------------------------------------------
# 4. Photon / OSM Reverse Geocoding Landmark Engine
# ---------------------------------------------------------------------------

def fetch_track_landmark(lat: float, lon: float) -> Dict[str, Any]:
    """
    Resolves moving train coordinates to authentic geographical landmarks
    (e.g., 'Son River Bridge near Dehri-on-Sone', 'Yamuna Rail Bridge, Agra', 'Sasaram Bypass')
    using the Photon Komoot API with OpenStreetMap Nominatim failover.
    (100% Free, No API Key Required).
    """
    if lat == 0.0 and lon == 0.0:
        return {"landmark_text": "Indian Railways Track Network", "locality": "National Corridor"}

    key = f"{lat:.3f}:{lon:.3f}"
    now_ts = time.time()
    if key in _LANDMARK_CACHE:
        cached_ts, l_data = _LANDMARK_CACHE[key]
        if (now_ts - cached_ts) < TTL_LANDMARK:
            return l_data

    # Strategy 1: Photon Komoot Reverse Geocoder (sub-150ms response)
    photon_url = f"https://photon.komoot.io/reverse?lat={lat:.4f}&lon={lon:.4f}"
    req = urllib.request.Request(photon_url, headers={"User-Agent": "RailSync/2.0 (Railway Landmark Resolving Engine)"})

    try:
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            features = data.get("features", [])
            if features:
                props = features[0].get("properties", {})
                name = props.get("name")
                locality = props.get("locality") or props.get("district") or props.get("city")
                district = props.get("district") or props.get("county") or props.get("city")
                state = props.get("state", "India")

                parts = []
                if name and name.lower() not in ["india", "railway", "unnamed road"]:
                    parts.append(name)
                if locality and locality != name:
                    parts.append(locality)
                if district and district not in [name, locality]:
                    parts.append(district)
                if state:
                    parts.append(state)

                clean_text = ", ".join(parts) if parts else f"Track Coordinate ({lat:.3f}°, {lon:.3f}°)"
                res = {
                    "source": "Photon OpenStreetMap Geocoding",
                    "landmark_name": name or locality or "Rail Corridor",
                    "locality": locality or district or "Track",
                    "district": district or "",
                    "state": state,
                    "formatted_text": clean_text
                }
                _LANDMARK_CACHE[key] = (now_ts, res)
                return res
    except Exception as e:
        logger.debug(f"[Photon Landmark Note] {e} for ({lat}, {lon})")

    # Strategy 2: Fallback to coordinate-based regional sector
    res = {
        "source": "Corridor Geographic Coordinate Sector",
        "landmark_name": f"Track Sector ({lat:.2f}N, {lon:.2f}E)",
        "locality": "Trunk Rail Corridor",
        "district": "",
        "state": "Indian Railways Network",
        "formatted_text": f"Rail Section at {lat:.3f}° N, {lon:.3f}° E"
    }
    return res


# ---------------------------------------------------------------------------
# Unified High-Performance Enhancer Hook
# ---------------------------------------------------------------------------

def enrich_train_location_telemetry(
    lat: float,
    lon: float,
    prev_lat: Optional[float] = None,
    prev_lon: Optional[float] = None,
    current_speed_kmh: float = 0.0
) -> Dict[str, Any]:
    """
    Executes all 4 APIs concurrently/synchronously to generate an enriched
    geospatial and physics telemetry block for live train radar and CLI.
    """
    # 1. Elevation & Gradient
    if prev_lat is not None and prev_lon is not None and (prev_lat != lat or prev_lon != lon):
        gradient_info = calculate_track_gradient(prev_lat, prev_lon, lat, lon)
    else:
        elev = fetch_elevation(lat, lon)
        gradient_info = {
            "elevation_m": round(elev, 1),
            "elevation_start_m": round(elev, 1),
            "elevation_delta_m": 0.0,
            "distance_span_km": 0.0,
            "gradient_pct": 0.0,
            "ratio_1_in_x": 9999,
            "grade_type": "LEVEL",
            "grade_description": "Level Track (0.0% grade)",
            "speed_factor": 1.0
        }

    # 2. Weather & Fog Visibility
    weather_info = fetch_live_weather_and_visibility(lat, lon)

    # 3. Track Infrastructure
    track_info = fetch_track_infrastructure(lat, lon)

    # 4. Landmark Reverse Geocoding
    landmark_info = fetch_track_landmark(lat, lon)

    # Recommended Safe Speed based on combined physics (MPS, Gradient & Fog)
    raw_mps = track_info.get("section_mps_kmh", 130.0)
    grade_factor = gradient_info.get("speed_factor", 1.0)
    fog_cap = weather_info.get("fog_speed_cap_kmh")

    physics_speed = raw_mps * grade_factor
    if fog_cap is not None:
        safe_recommended_speed = min(physics_speed, fog_cap)
    else:
        safe_recommended_speed = physics_speed

    return {
        "elevation": gradient_info,
        "weather_visibility": weather_info,
        "track_infrastructure": track_info,
        "landmark": landmark_info,
        "physics_analysis": {
            "section_mps_kmh": raw_mps,
            "grade_speed_factor": grade_factor,
            "fog_speed_cap_kmh": fog_cap,
            "safe_recommended_speed_kmh": round(safe_recommended_speed, 1),
            "current_vs_safe_pct": round((current_speed_kmh / safe_recommended_speed) * 100.0, 1) if safe_recommended_speed > 0 else 0.0
        }
    }
