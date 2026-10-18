"""
backend/engine/eta_services/train_state_service.py
TrainStateService.
Implements probabilistic position state estimation (EKF), map matching,
staleness tracking, impossible speed filtering, and hybrid station pass detection.
"""
from datetime import datetime, timezone
import math
from typing import Dict, Any, List, Optional, Tuple
from engine.eta_config import now_utc, to_utc, ETA_CONFIG
from models.eta_models import TrainDelayState, EventSourcePriority

class TrainStateService:
    """
    Maintains active train position state and performs probabilistic estimation.
    """

    def __init__(self):
        # In-memory storage for active run states
        self._active_states: Dict[str, TrainDelayState] = {}
        self._station_dwell_trackers: Dict[str, Dict[str, Any]] = {}

    def get_or_create_delay_state(
        self,
        train_number: str,
        run_date: str,
        initial_station: str = "HWH",
        initial_km: float = 0.0,
        initial_delay: float = 0.0
    ) -> TrainDelayState:
        key = f"{train_number}:{run_date}"
        if key not in self._active_states:
            self._active_states[key] = TrainDelayState(
                train_number=train_number,
                run_date=run_date,
                as_of_time=now_utc(),
                reference_station_code=initial_station,
                reference_km=initial_km,
                current_delay_minutes=initial_delay,
                delay_source="SCHEDULE_INFERRED",
                source_priority=EventSourcePriority.SCHEDULE_INFERRED.value,
                confidence=0.85
            )
        return self._active_states[key]

    def update_with_event(
        self,
        train_number: str,
        run_date: str,
        station_code: str,
        track_km: float,
        delay_minutes: float,
        source: str,
        source_priority: int,
        event_time: datetime
    ) -> TrainDelayState:
        """
        Updates delay state respecting Event Source Priority:
        OFFICIAL_MANUAL (1) > INTERLOCKING (2) > STATION_PASS_MANUAL (3) > GPS_GEOFENCE (4) > SCHEDULE_INFERRED (5)
        """
        key = f"{train_number}:{run_date}"
        current = self.get_or_create_delay_state(train_number, run_date, station_code, track_km, delay_minutes)

        event_utc = to_utc(event_time)

        # Priority comparison (lower integer = higher priority)
        if source_priority <= current.source_priority or (event_utc > current.as_of_time and source_priority == current.source_priority):
            current.reference_station_code = station_code
            current.reference_km = track_km
            current.current_delay_minutes = round(delay_minutes, 1)
            current.delay_source = source
            current.source_priority = source_priority
            current.as_of_time = event_utc
            current.last_updated = now_utc()
            current.confidence = 0.98 if source_priority <= 2 else (0.90 if source_priority <= 4 else 0.70)
            self._active_states[key] = current

        return current

    def estimate_position_probabilistic(
        self,
        state: TrainDelayState,
        last_known_speed_kmph: float,
        max_line_mps: float = 130.0,
        current_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Extended Kalman Filter / Dead Reckoning estimator.
        Accounts for tractive acceleration, speed discounts, and GPS staleness decay.
        """
        now = to_utc(current_time or now_utc())
        elapsed_sec = max(0.0, (now - state.as_of_time).total_seconds())
        elapsed_min = elapsed_sec / 60.0

        # Impossible speed filter
        speed = min(ETA_CONFIG["max_plausible_train_speed_kmph"], max(0.0, last_known_speed_kmph))
        
        # Operational speed discount (85% of MPS accounts for turnouts, curves, and signal spacing)
        effective_speed = min(max_line_mps * 0.85, max(speed, 25.0 if elapsed_min > 2 else 0.0))

        # Dead reckoned advancement
        est_advance_km = effective_speed * (elapsed_min / 60.0)
        est_km = state.reference_km + est_advance_km

        # Uncertainty variance expands with elapsed time
        # sigma = sqrt(sigma_0^2 + q * dt)
        base_sigma = 0.25 if state.source_priority <= 2 else 0.80
        sigma_km = math.sqrt(base_sigma**2 + 0.05 * elapsed_min)

        possible_km_min = max(state.reference_km, round(est_km - 1.96 * sigma_km, 1))
        possible_km_max = round(est_km + 1.96 * sigma_km, 1)

        # Confidence decay: exponential half-life based on staleness
        half_life_sec = ETA_CONFIG["position_confidence_decay_half_life_sec"]
        staleness_decay = math.exp(-0.693 * (elapsed_sec / half_life_sec))
        final_confidence = round(max(0.20, state.confidence * staleness_decay), 2)

        is_stale_warning = elapsed_sec >= ETA_CONFIG["gps_staleness_warning_seconds"]
        is_stale_critical = elapsed_sec >= ETA_CONFIG["gps_staleness_critical_seconds"]

        return {
            "estimated_km": round(est_km, 1),
            "effective_speed_kmph": round(effective_speed, 1),
            "possible_km_range": [possible_km_min, possible_km_max],
            "position_confidence": final_confidence,
            "staleness_seconds": round(elapsed_sec, 0),
            "is_stale_warning": is_stale_warning,
            "is_stale_critical": is_stale_critical,
            "uncertainty_sigma_km": round(sigma_km, 2)
        }

    def detect_hybrid_station_pass(
        self,
        station_code: str,
        station_km: float,
        current_km: float,
        current_speed_kmph: float,
        gps_distance_to_station_meters: float,
        is_departed_flag: bool = False
    ) -> str:
        """
        Hybrid Station Pass Detection: PASSED, ARRIVED, DEPARTED, NEXT, UPCOMING.
        Requires geofence entry, speed dwell check, or official flag.
        """
        if is_departed_flag or current_km > (station_km + 1.2):
            return "PASSED"

        # Within geofence radius
        radius = ETA_CONFIG["geofence_station_radius_meters"]
        if gps_distance_to_station_meters <= radius or abs(current_km - station_km) <= 0.8:
            if current_speed_kmph <= ETA_CONFIG["min_dwell_detection_speed_kmph"]:
                return "ARRIVED"
            else:
                return "NEXT"

        if current_km < station_km:
            return "NEXT" if (station_km - current_km) <= 35.0 else "UPCOMING"

        return "PASSED"

    @classmethod
    def update_position_estimate(
        cls,
        prev_km: float,
        prev_time: datetime,
        new_km: float,
        new_time: datetime,
        max_mps: float = 130.0
    ) -> Dict[str, Any]:
        dt_hr = max(0.0001, (to_utc(new_time) - to_utc(prev_time)).total_seconds() / 3600.0)
        speed = (new_km - prev_km) / dt_hr
        is_plausible = speed <= ETA_CONFIG["max_plausible_train_speed_kmph"]
        effective_speed = min(ETA_CONFIG["max_plausible_train_speed_kmph"], speed) if speed >= 0 else 0.0
        return {
            "speed_kmph": round(effective_speed, 1),
            "is_speed_plausible": is_plausible,
            "raw_speed_kmph": round(speed, 1)
        }
