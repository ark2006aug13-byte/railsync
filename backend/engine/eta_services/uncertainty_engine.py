"""
backend/engine/eta_services/uncertainty_engine.py
Dynamic Uncertainty and Quantile Prediction Engine (FIX 5).
Computes conformal and quantile bounds (P10, P50, P90) ensuring strict monotonic ordering:
P10 <= P50 <= P90.
Accounts for prediction horizon widening, telemetry staleness, adverse weather,
incidents, and conformal calibration offsets.
"""
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import math
from engine.eta_config import ETA_CONFIG, to_utc, format_ist_iso

class UncertaintyEngine:
    """
    Computes calibrated probabilistic ETA bounds (P10, P50, P90) and confidence scoring.
    """

    @classmethod
    def compute_quantile_bounds(
        cls,
        eta_p50: datetime,
        current_time: datetime,
        min_physical_eta: datetime,
        scheduled_arrival: datetime,
        staleness_seconds: float = 0.0,
        weather_condition: str = "CLEAR",
        has_active_incident: bool = False,
        conformal_offset_p10_min: float = 0.0,
        conformal_offset_p90_min: float = 0.0,
        early_arrival_policy: str = "show_on_time"
    ) -> Dict[str, Any]:
        """
        Calculates monotonic P10, P50, P90 arrival timestamps.
        
        Args:
            eta_p50: The point prediction (median / P50 expected arrival time) in UTC.
            current_time: Current evaluation timestamp in UTC.
            min_physical_eta: Absolute kinematic minimum arrival time in UTC.
            scheduled_arrival: Timetable scheduled arrival time in UTC.
            staleness_seconds: Age of latest telemetry feed in seconds.
            weather_condition: Fog / rain / clear weather status.
            has_active_incident: True if train or block has active operational disruption.
            conformal_offset_p10_min: Calibrated offset for lower quantile in minutes.
            conformal_offset_p90_min: Calibrated offset for upper quantile in minutes.
            early_arrival_policy: 'cap_at_schedule', 'show_on_time', or 'show_early'.
        """
        eta_p50 = to_utc(eta_p50)
        current_time = to_utc(current_time)
        min_physical_eta = to_utc(min_physical_eta)
        scheduled_arrival = to_utc(scheduled_arrival)

        # 1. Horizon Calculation (in minutes)
        horizon_seconds = max(0.0, (eta_p50 - current_time).total_seconds())
        horizon_minutes = horizon_seconds / 60.0

        # 2. Base Spread Growth as Horizon Expands
        # Standard deviation grows with square root of horizon
        base_spread_min = math.sqrt(max(1.0, horizon_minutes)) * 0.75 + (horizon_minutes * 0.015)

        # 3. Staleness Multiplier
        staleness_mult = 1.0
        warn_sec = ETA_CONFIG.get("gps_staleness_warning_seconds", 300)
        crit_sec = ETA_CONFIG.get("gps_staleness_critical_seconds", 900)
        if staleness_seconds > crit_sec:
            staleness_mult = 2.0
        elif staleness_seconds > warn_sec:
            staleness_mult = 1.4

        # 4. Asymmetric Upside Risk Multiplier (Railways have positive skew: delays > earliness)
        weather_upside_mult = 1.0
        if "SEVERE_FOG" in weather_condition or "DENSE" in weather_condition:
            weather_upside_mult = 2.2
        elif "MODERATE_FOG" in weather_condition or "FOG" in weather_condition:
            weather_upside_mult = 1.6
        elif "RAIN" in weather_condition:
            weather_upside_mult = 1.3

        incident_upside_mult = 2.5 if has_active_incident else 1.0

        upper_spread_min = base_spread_min * staleness_mult * weather_upside_mult * incident_upside_mult
        upper_spread_min += conformal_offset_p90_min

        # Lower spread (P10) is constrained because train cannot run arbitrarily faster than MPS
        lower_spread_min = (base_spread_min * 0.5) + conformal_offset_p10_min
        lower_spread_min = max(0.5, lower_spread_min)

        # 5. Raw Datetimes
        raw_p10 = eta_p50 - timedelta(minutes=lower_spread_min)
        raw_p90 = eta_p50 + timedelta(minutes=upper_spread_min)

        # 6. Physical Lower Bound Enforcement
        # Train can never arrive earlier than kinematic absolute minimum
        bounded_p10 = max(raw_p10, min_physical_eta)

        # Ensure P10 <= P50
        bounded_p10 = min(bounded_p10, eta_p50)

        # Ensure P50 <= P90
        bounded_p90 = max(raw_p90, eta_p50)

        # If early arrival policy caps at schedule for display
        if early_arrival_policy == "cap_at_schedule":
            display_p10 = max(bounded_p10, scheduled_arrival)
            display_p50 = max(eta_p50, scheduled_arrival)
            display_p90 = max(bounded_p90, scheduled_arrival)
        else:
            display_p10 = bounded_p10
            display_p50 = eta_p50
            display_p90 = bounded_p90

        # Monotonicity check assertion guarantee
        assert display_p10 <= display_p50 <= display_p90, (
            f"Quantile monotonicity violation: P10={display_p10} > P50={display_p50} or P50 > P90={display_p90}"
        )

        # 7. Confidence Score Calculation (0.1 to 0.98)
        # Decays with horizon, staleness, adverse conditions
        horizon_penalty = min(0.35, (horizon_minutes / 360.0) * 0.35)
        staleness_penalty = 0.30 if staleness_seconds > crit_sec else (0.15 if staleness_seconds > warn_sec else 0.0)
        condition_penalty = 0.20 if has_active_incident else (0.12 if "FOG" in weather_condition else 0.0)

        confidence_score = max(0.15, min(0.98, 0.95 - horizon_penalty - staleness_penalty - condition_penalty))
        confidence_score = round(confidence_score, 2)

        if confidence_score >= 0.75:
            confidence_level = "HIGH"
        elif confidence_score >= 0.45:
            confidence_level = "MEDIUM"
        else:
            confidence_level = "LOW"

        uncertainty_spread_min = round((display_p90 - display_p10).total_seconds() / 60.0, 1)

        return {
            "eta_p10": display_p10,
            "eta_p50": display_p50,
            "eta_p90": display_p90,
            "eta_p10_ist": format_ist_iso(display_p10),
            "eta_p50_ist": format_ist_iso(display_p50),
            "eta_p90_ist": format_ist_iso(display_p90),
            "horizon_minutes": round(horizon_minutes, 1),
            "uncertainty_spread_min": uncertainty_spread_min,
            "confidence_score": confidence_score,
            "confidence_level": confidence_level,
            "is_stale": staleness_seconds > warn_sec,
            "staleness_seconds": staleness_seconds,
            "monotonic_verified": True
        }
