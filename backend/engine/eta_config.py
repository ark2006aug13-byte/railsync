"""
backend/engine/eta_config.py
Configurable Thresholds and Timezone Utilities for Train ETA Predictor.
All magic numbers, thresholds, and operational parameters are defined here.
Timezone Policy:
  - Internally: All datetimes are timezone-aware UTC.
  - User-facing & API payloads: Converted to IST (Asia/Kolkata, UTC+05:30) with explicit +05:30 offset.
"""
from datetime import datetime, timezone, timedelta
from typing import Dict, Any
from zoneinfo import ZoneInfo
import os

# ---------------------------------------------------------------------------
# Timezone Definitions
# ---------------------------------------------------------------------------
UTC = timezone.utc
IST_ZONE = ZoneInfo("Asia/Kolkata")
IST_OFFSET = timedelta(hours=5, minutes=30)

def now_utc() -> datetime:
    """Returns current timestamp in timezone-aware UTC."""
    return datetime.now(timezone.utc)

def now_ist() -> datetime:
    """Returns current timestamp in timezone-aware IST."""
    return datetime.now(IST_ZONE)

def to_utc(dt: datetime) -> datetime:
    """Converts any datetime to timezone-aware UTC. Rejects or localizes naive datetimes."""
    if dt.tzinfo is None:
        # Default assume IST if naive input, then convert to UTC
        dt = dt.replace(tzinfo=IST_ZONE)
    return dt.astimezone(timezone.utc)

def to_ist(dt: datetime) -> datetime:
    """Converts a datetime to timezone-aware IST."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(IST_ZONE)

def format_ist_iso(dt: datetime) -> str:
    """Formats a datetime as an ISO8601 string with explicit +05:30 IST offset."""
    return to_ist(dt).isoformat()

# ---------------------------------------------------------------------------
# Configurable System Thresholds
# ---------------------------------------------------------------------------
ETA_CONFIG: Dict[str, Any] = {
    # Position Estimator & EKF
    "gps_staleness_warning_seconds": int(os.getenv("GPS_STALENESS_WARNING_SEC", "300")),      # 5 mins
    "gps_staleness_critical_seconds": int(os.getenv("GPS_STALENESS_CRITICAL_SEC", "900")),    # 15 mins
    "position_confidence_decay_half_life_sec": 600,                                            # 10 mins
    "max_plausible_train_speed_kmph": float(os.getenv("MAX_PLAUSIBLE_SPEED_KMPH", "180.0")),   # impossible speed rejection
    "min_dwell_detection_speed_kmph": 3.0,
    "min_dwell_detection_duration_sec": 45,
    "geofence_station_radius_meters": 1200,

    # Event Ingestion
    "future_timestamp_tolerance_seconds": 60,                                                  # max 60s future drift
    "idempotency_cache_ttl_seconds": 86400,                                                    # 24 hours

    # Weather Penalties
    "weather_cache_ttl_seconds": int(os.getenv("WEATHER_CACHE_TTL_SEC", "450")),               # 7.5 mins (5-10m for fog/rain)
    "fog_visibility_severe_meters": 50,    # +15-20 min / 100km
    "fog_visibility_heavy_meters": 150,    # +8-12 min / 100km
    "fog_visibility_moderate_meters": 300, # +3-5 min / 100km
    "fog_visibility_light_meters": 800,    # +1-2 min / 100km
    "rain_severe_mm_hr": 50.0,
    "rain_heavy_mm_hr": 25.0,
    "rain_moderate_mm_hr": 10.0,

    # Signaling & Overtake
    "overtake_probability_threshold": float(os.getenv("OVERTAKE_PROB_THRESH", "0.65")),
    "block_headway_clear_km": 10.0,
    "block_headway_caution_km": 6.0,
    "block_headway_attention_km": 3.0,

    # Recovery
    "default_recovery_efficiency_130": 0.85,
    "default_recovery_efficiency_110": 0.60,
    "max_recovery_rate_mins_per_100km": 3.0,

    # Uncertainty & Horizons
    "conformal_p10_alpha": 0.10,
    "conformal_p50_alpha": 0.50,
    "conformal_p90_alpha": 0.90,
    "horizon_variance_growth_rate": 0.08, # variance grows per minute of horizon

    # Early Arrival Display Policy: 'cap_at_schedule' | 'show_on_time' | 'show_early'
    "early_arrival_policy": os.getenv("EARLY_ARRIVAL_POLICY", "show_on_time"),

    # Rate Limiting & API
    "api_rate_limit_per_minute": int(os.getenv("API_RATE_LIMIT", "120")),
}
