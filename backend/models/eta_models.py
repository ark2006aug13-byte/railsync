"""
backend/models/eta_models.py
Domain Models and Schemas for Train ETA Predictor.
Implements the 16 railway domain models, Factor Ledger, TrainDelayState,
and validation entities with timezone-aware UTC timestamps and IST serializers.
"""
from datetime import datetime
from enum import Enum
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator
from engine.eta_config import to_utc, format_ist_iso, now_utc

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------
class TrainRunStatusEnum(str, Enum):
    SCHEDULED = "SCHEDULED"
    RUNNING = "RUNNING"
    DELAYED = "DELAYED"
    DIVERTED = "DIVERTED"
    SHORT_TERMINATED = "SHORT_TERMINATED"
    CANCELLED = "CANCELLED"
    TERMINATED = "TERMINATED"
    RESCHEDULED = "RESCHEDULED"

class EventSourcePriority(int, Enum):
    OFFICIAL_MANUAL_EVENT = 1
    STATION_PASS_INTERLOCKING = 2
    STATION_PASS_MANUAL = 3
    GPS_GEOFENCE = 4
    SCHEDULE_INFERRED = 5

class SignalAspectEnum(str, Enum):
    GREEN = "GREEN"
    DOUBLE_YELLOW = "DOUBLE_YELLOW"
    YELLOW = "YELLOW"
    RED = "RED"

class UserRoleEnum(str, Enum):
    VIEWER = "VIEWER"
    OPERATOR = "OPERATOR"
    CONTROLLER = "CONTROLLER"
    ADMIN = "ADMIN"
    SYSTEM = "SYSTEM"

class IncidentTypeEnum(str, Enum):
    CHAIN_PULLING = "CHAIN_PULLING"
    MEDICAL_EMERGENCY = "MEDICAL_EMERGENCY"
    ACCIDENT = "ACCIDENT"
    DERAILMENT = "DERAILMENT"
    AGITATION = "AGITATION"
    SIGNAL_FAILURE = "SIGNAL_FAILURE"
    OHE_FAILURE = "OHE_FAILURE"
    FLOOD = "FLOOD"
    CAUTION_ORDER = "CAUTION_ORDER"
    LAW_ORDER = "LAW_ORDER"
    DIVERSION = "DIVERSION"
    PLATFORM_CHANGE = "PLATFORM_CHANGE"
    UNSCHEDULED_STOP = "UNSCHEDULED_STOP"

class EarlyArrivalPolicy(str, Enum):
    CAP_AT_SCHEDULE = "cap_at_schedule"
    SHOW_ON_TIME = "show_on_time"
    SHOW_EARLY = "show_early"

# ---------------------------------------------------------------------------
# FIX 2: Factor Ledger & Double-Count Validation Models
# ---------------------------------------------------------------------------
class DelayFactorLedger(BaseModel):
    """
    Explicit ledger item representing a single evaluated delay factor or recovery credit.
    Enforces overlap groups to prevent double counting across sub-models.
    """
    model_config = ConfigDict(from_attributes=True)

    factor_id: str
    prediction_id: str
    factor_type: str  # 'ground', 'weather_fog', 'signal_headway', 'throat', 'platform_holding', 'dwell_extension', 'incident', 'recovery'
    minutes: float
    source: str
    confidence: float = 1.0
    applied_to_segment: Optional[str] = None
    applied_to_station: Optional[str] = None
    overlap_group: str  # e.g., 'terminal_approach', 'atmospheric_restriction', 'track_caution'
    valid_from: datetime
    valid_to: datetime
    reason_text: str

    @field_validator("valid_from", "valid_to", mode="before")
    @classmethod
    def ensure_utc(cls, v: Any) -> datetime:
        if isinstance(v, str):
            v = datetime.fromisoformat(v)
        if isinstance(v, datetime):
            return to_utc(v)
        return now_utc()

    def to_dict_ist(self) -> Dict[str, Any]:
        d = self.model_dump(mode="json")
        d["valid_from_ist"] = format_ist_iso(self.valid_from)
        d["valid_to_ist"] = format_ist_iso(self.valid_to)
        return d

class ValidationResult(BaseModel):
    status: str  # 'PASS' | 'FAIL'
    issues: List[str] = Field(default_factory=list)

# ---------------------------------------------------------------------------
# FIX 3: Explicit TrainDelayState
# ---------------------------------------------------------------------------
class TrainDelayState(BaseModel):
    """
    Current single source of truth for train's active ground delay.
    Strictly prioritized: Official Manual > GPS Geofence > Schedule Inferred.
    """
    model_config = ConfigDict(from_attributes=True)

    train_number: str
    run_date: str  # YYYY-MM-DD
    as_of_time: datetime
    reference_station_code: str
    reference_km: float
    current_delay_minutes: float
    delay_source: str  # 'OFFICIAL_MANUAL_EVENT', 'GPS_GEOFENCE', 'SCHEDULE_INFERRED'
    source_priority: int = 5
    confidence: float = 1.0
    last_updated: datetime = Field(default_factory=now_utc)

    @field_validator("as_of_time", "last_updated", mode="before")
    @classmethod
    def ensure_utc(cls, v: Any) -> datetime:
        if isinstance(v, str):
            v = datetime.fromisoformat(v)
        if isinstance(v, datetime):
            return to_utc(v)
        return now_utc()

# ---------------------------------------------------------------------------
# FIX 4: 16 Railway Domain Data Models
# ---------------------------------------------------------------------------
class BlockSection(BaseModel):
    block_id: str
    from_signal_id: str
    to_signal_id: str
    segment_id: str
    length_km: float
    block_type: str = "AUTOMATIC"  # AUTOMATIC, ABSOLUTE, INTERLOCKED
    occupied_by_train: Optional[str] = None
    last_cleared_time: Optional[datetime] = None

class Signal(BaseModel):
    signal_id: str
    station_code: Optional[str] = None
    signal_type: str = "AUTOMATIC_4_ASPECT"  # HOME, ROUTING, STARTER, ADVANCE_STARTER, DISTANT
    aspect_state: SignalAspectEnum = SignalAspectEnum.GREEN
    last_updated: datetime = Field(default_factory=now_utc)

class SignalAspectEvent(BaseModel):
    signal_id: str
    aspect: SignalAspectEnum
    valid_from: datetime
    valid_to: Optional[datetime] = None
    source: str = "INTERLOCKING_CIRCUIT"

class MovementAuthority(BaseModel):
    train_number: str
    run_date: str
    granted_until_signal: str
    granted_at: datetime
    source: str = "KAVACH_ATP"

class TrackGeometry(BaseModel):
    segment_id: str
    geometry_linestring: Optional[List[List[float]]] = None  # [[lng, lat], ...]
    km_start: float
    km_end: float
    line_code: str = "UP_MAIN"
    direction: str = "UP"  # UP, DOWN, BI_DIRECTIONAL
    gradient_permille: float = 0.0
    curvature_degrees: float = 0.0

class RouteVersion(BaseModel):
    route_id: str
    train_number: str
    effective_from: datetime
    effective_to: Optional[datetime] = None
    route_stations: List[Dict[str, Any]]
    source: str = "CRIS_OFFICIAL"

class TimetableVersion(BaseModel):
    train_number: str
    effective_date: str
    schedule_payload: List[Dict[str, Any]]
    source: str = "NTES_TIMETABLE"

class TrainComposition(BaseModel):
    train_number: str
    run_date: str
    coach_count: int = 22
    train_length_meters: float = 540.0
    loco_type: str = "WAP-7"
    max_permitted_speed: float = 130.0
    trailing_load_tonnes: float = 1100.0

class PlatformAssignment(BaseModel):
    train_number: str
    run_date: str
    station_code: str
    platform_number: str
    assigned_at: datetime = Field(default_factory=now_utc)
    source: str = "STATION_MASTER"
    confidence: float = 1.0

class PlatformOccupancy(BaseModel):
    station_code: str
    platform_number: str
    occupying_train: Optional[str] = None
    expected_free_time: Optional[datetime] = None
    actual_free_time: Optional[datetime] = None
    clearance_time_min: float = 3.0

class HistoricalDelayStats(BaseModel):
    train_number_or_type: str
    segment_id: str
    station_code: str
    time_of_day_bucket: str = "EVENING"  # MORNING, AFTERNOON, EVENING, NIGHT
    season_bucket: str = "WINTER"        # WINTER, MONSOON, SUMMER
    weather_bucket: str = "FOG"          # CLEAR, FOG, RAIN
    delay_p10: float = 0.0
    delay_p50: float = 8.0
    delay_p90: float = 24.0
    recovery_rate: float = 0.65
    dwell_extension_p50: float = 1.5
    sample_count: int = 150

class CalibrationParameter(BaseModel):
    model_name: str
    parameter_key: str
    parameter_value: float
    valid_from: datetime
    valid_to: Optional[datetime] = None

class AdapterHealth(BaseModel):
    adapter_name: str
    status: str = "HEALTHY"  # HEALTHY, DEGRADED, DOWN
    last_success_time: Optional[datetime] = None
    last_error: Optional[str] = None
    staleness_seconds: float = 0.0

class AuditLog(BaseModel):
    actor_id: str
    role: str
    action: str
    entity_type: str
    entity_id: str
    before_value: Optional[Dict[str, Any]] = None
    after_value: Optional[Dict[str, Any]] = None
    reason: str
    timestamp: datetime = Field(default_factory=now_utc)

class AdminUser(BaseModel):
    user_id: str
    username: str
    role: UserRoleEnum
    auth_provider: str = "LOCAL_JWT"
    active: bool = True

class TrainRunStatus(BaseModel):
    run_id: str
    train_number: str
    run_date: str
    status: TrainRunStatusEnum = TrainRunStatusEnum.RUNNING
    status_time: datetime = Field(default_factory=now_utc)
    reason: str = "Normal scheduled run"
    source: str = "CONTROLLER"

# ---------------------------------------------------------------------------
# Operational & Prediciton Entities
# ---------------------------------------------------------------------------
class Incident(BaseModel):
    incident_id: str
    train_number: Optional[str] = None
    station_code: Optional[str] = None
    segment_id: Optional[str] = None
    type: IncidentTypeEnum
    severity: str = "HIGH"  # LOW, MEDIUM, HIGH, CRITICAL
    start_time: datetime
    expected_end_time: Optional[datetime] = None
    manual_eta_override: Optional[datetime] = None
    delay_impact_min: float = 15.0
    freeze_recovery: bool = True
    active: bool = True
    notes: Optional[str] = None
    reported_by: str = "SYSTEM"

class CautionOrder(BaseModel):
    order_id: str
    segment_id: str
    speed_cap_kmph: float
    start_km: float
    end_km: float
    valid_from: datetime
    valid_to: Optional[datetime] = None
    reason: str = "Track maintenance"
    source: str = "DIVISIONAL_CIRCULAR"

class LiveEvent(BaseModel):
    event_id: str
    train_number: str
    event_type: str  # GPS_PING, STATION_PASS, DWELL_START, DWELL_END, MANUAL_LOG
    station_id: Optional[str] = None
    event_time: datetime
    received_time: datetime = Field(default_factory=now_utc)
    source: str = "GPS_GEOFENCE"
    payload: Dict[str, Any] = Field(default_factory=dict)

class PredictionLog(BaseModel):
    prediction_id: str
    train_number: str
    station_code: str
    predicted_at: datetime
    horizon_minutes: float
    eta_p10: datetime
    eta_p50: datetime
    eta_p90: datetime
    scheduled_arrival: datetime
    delay_breakdown_json: Dict[str, Any]
    confidence_score: float
    data_freshness_seconds: float
    factor_ledger: List[DelayFactorLedger] = Field(default_factory=list)

class ActualArrival(BaseModel):
    train_number: str
    station_code: str
    actual_arrival: datetime
    actual_departure: Optional[datetime] = None
    source: str = "STATION_PASS_INTERLOCKING"

class FeedbackMetric(BaseModel):
    prediction_id: str
    train_number: str
    station_code: str
    horizon_minutes: float
    error_p10_min: float
    error_p50_min: float
    error_p90_min: float
    covered_by_p90: bool
    covered_by_p10_p90: bool
