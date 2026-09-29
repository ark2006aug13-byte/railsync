"""
api/schemas.py
Pydantic schemas for RailSync API.
All models inherit from CamelModel ensuring camelCase JSON serialization
with support for both snake_case and camelCase field access.
"""
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


# ---------------------------------------------------------------------------
# Base Serialization Model with CamelCase Aliases
# ---------------------------------------------------------------------------
class CamelModel(BaseModel):
    """
    Base model ensuring all JSON output serializes in camelCase
    while allowing population by both snake_case and camelCase field names.
    """
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        by_alias=True
    )


# ---------------------------------------------------------------------------
# Multi-Factor Dynamic Prediction & Waterfall Decomposition Schemas
# ---------------------------------------------------------------------------
class WaterfallStep(CamelModel):
    label: str
    impact_min: float  # Positive for penalties, negative for recovery
    category: str      # 'base' | 'penalty' | 'recovery' | 'terminal'
    description: str


class ConfidenceBounds(CamelModel):
    p10_time: str
    p50_time: str
    p90_time: str
    confidence_percentage: int


class IntermediateStation(CamelModel):
    station_code: str
    station_name: str
    distance_km: float
    scheduled_time: Optional[str] = "--:--"
    dynamic_time: Optional[str] = "--:--"
    status: Optional[str] = "UPCOMING"
    speed_kmph: Optional[float] = None
    delay_min: Optional[float] = 0.0
    lat: Optional[float] = None
    lng: Optional[float] = None


class StationETABreakdown(CamelModel):
    station_code: str
    station_name: str
    scheduled_arrival: str
    scheduled_arrival_fmt: Optional[str] = None
    dynamic_eta: str
    dynamic_eta_fmt: Optional[str] = None
    net_delay_min: float
    confidence: ConfidenceBounds
    waterfall: List[WaterfallStep]
    active_warnings: List[str]
    tsr_delay_min: Optional[float] = 0.0
    platform_hold_min: Optional[float] = 0.0
    slack_recovered_min: Optional[float] = 0.0
    platform: Optional[Union[int, str]] = "1"
    distance_km: Optional[float] = 0.0
    status: Optional[str] = "UPCOMING"
    scheduled_departure: Optional[str] = None
    scheduled_departure_fmt: Optional[str] = None
    halt_min: Optional[float] = 0.0
    intermediate_stations: Optional[List[IntermediateStation]] = []
    lat: Optional[float] = None
    lng: Optional[float] = None


class LeadingTrainModel(CamelModel):
    train_no: str
    name: str
    km: float
    lat: float
    lng: float
    speed_kmph: float
    delay_min: float
    headway_gap_km: float


class TrainPredictionResponse(CamelModel):
    train_no: str
    train_name: str
    status: Optional[str] = "RUNNING"
    train_type: Optional[str] = "Superfast Express"
    origin: Optional[str] = None
    origin_name: Optional[str] = None
    destination: Optional[str] = None
    destination_name: Optional[str] = None
    scheduled_departure: Optional[str] = None
    scheduled_departure_fmt: Optional[str] = None
    scheduled_arrival: Optional[str] = None
    scheduled_arrival_fmt: Optional[str] = None
    total_distance_km: Optional[float] = None
    mps: Optional[float] = 130.0
    current_km: float
    current_speed_kmph: float
    current_section: str
    current_station: Optional[str] = None
    current_delay_min: Optional[float] = 0.0
    signal_aspect: str
    headway_gap_km: float
    destination_eta: StationETABreakdown
    upcoming_stations: List[StationETABreakdown]
    all_stations: Optional[List[StationETABreakdown]] = []
    telemetry_source: Optional[str] = "RTIS_HIGH_PRECISION_GPS (ISRO Satellite Stream)"
    dead_reckoned_km: Optional[float] = None
    exact_location_text: Optional[str] = None
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    bearing: Optional[float] = None
    is_live_ground: Optional[bool] = False
    track_path: Optional[List[List[float]]] = []
    nearest_station: Optional[str] = None
    next_station: Optional[str] = None
    next_station_distance_km: Optional[float] = None
    leading_train: Optional[LeadingTrainModel] = None
    weather_condition: Optional[str] = None
    signal_status: Optional[str] = None



# ---------------------------------------------------------------------------
# Core Service & Operations Schemas
# ---------------------------------------------------------------------------
class ResolveConflictRequest(CamelModel):
    train_no: str
    station_code: str
    allocated_platform: int


class ResolveConflictResponse(CamelModel):
    success: bool
    train_no: str
    station_code: str
    allocated_platform: int
    message: str


class HealthCheckResponse(CamelModel):
    status: str
    system: str
    version: str


class TrainItemResponse(CamelModel):
    train_no: str
    name: str
    type: str
    origin: str
    destination: str
    total_distance_km: float
    stations_count: int
    available_dates: List[str]
    default_date: str
    priority: Optional[int] = 1


class StationModel(CamelModel):
    code: str
    name: str
    km: float
    halt_min: float
    lat: float
    lng: float
    mps: float
    platform: Optional[int] = 1


class SectionModel(CamelModel):
    section_id: str
    from_code: str
    to_code: str
    distance_km: float
    scheduled_runtime_min: float
    mps: float


class CorridorResponse(CamelModel):
    train_no: str
    train_name: str
    stations: List[StationModel]
    sections: List[SectionModel]
    route_coordinates: List[List[float]]
    detailed_track_geometry: List[List[float]]


class TrainPositionModel(CamelModel):
    lat: float
    lng: float
    km: float
    speed_kmph: float
    delay_min: float
    current_section: str
    section_id: Optional[str] = None
    current_mps: Optional[float] = 130.0


class ActiveSectionModel(CamelModel):
    section_id: str
    km: float
    speed_kmph: float
    current_delay_min: float
    current_mps: float



class SignalAspectModel(CamelModel):
    code: str
    name: str
    badge: str
    color: str
    speed_cap: str
    headway_gap_km: float


class UpcomingStationModel(CamelModel):
    code: str
    name: str
    km: float
    platform: Union[int, str]
    platform_conflict: bool
    outer_holding_min: float
    conflicting_train: Optional[str] = None
    eta_predicted: str
    eta_predicted_fmt: str
    eta_schedule: str
    eta_schedule_fmt: str
    predicted_delay_min: float
    delay_injected_min: Optional[float] = 0.0
    time_deletion_min: Optional[float] = 0.0
    recovery_min: Optional[float] = 0.0
    confidence_min: float
    why: str
    weather_condition: Optional[str] = None
    signal_status: Optional[str] = None
    horizon: int
    status: Optional[str] = None
    actual_arrival: Optional[str] = None
    actual_arrival_fmt: Optional[str] = None


class PassedStationModel(CamelModel):
    code: str
    name: str
    km: float
    platform: Union[int, str]
    actual_arrival: Optional[str] = None
    actual_arrival_fmt: Optional[str] = None
    actual_departure: Optional[str] = None
    actual_departure_fmt: Optional[str] = None
    exit_delay: float
    status: str = "passed"


class PlaybackModel(CamelModel):
    progress_pct: float
    min_time: str
    max_time: str
    current_time: str
    prev_time: Optional[str] = None
    next_time: Optional[str] = None
    has_prev: Optional[bool] = False
    has_next: Optional[bool] = False
    step_seconds: Optional[int] = 60


class TrainStateResponseModel(CamelModel):
    train_no: str
    train_name: str
    run_date: str
    simulated_time: str
    simulated_time_fmt: str
    min_time: str
    max_time: str
    position: TrainPositionModel
    active_section: Optional[ActiveSectionModel] = None
    leading_train: Optional[LeadingTrainModel] = None
    signal_aspect: Optional[SignalAspectModel] = None
    upcoming_stations: List[UpcomingStationModel] = []
    passed_stations: List[PassedStationModel] = []
    playback: Optional[PlaybackModel] = None
    is_complete: Optional[bool] = False
    last_updated: Optional[str] = None


class ConflictDetailsModel(CamelModel):
    conflicting_train: str
    description: str
    recommended_platform: str
    resolved: Optional[bool] = False


class InflowTrainModel(CamelModel):
    id: str
    train_number: str
    train_name: str
    source: str
    source_code: str
    destination: str
    destination_code: str
    platform: str
    platform_buffer: str
    dynamic_eta: str
    scheduled_eta: str
    variance_formatted: str
    variance_minutes: float
    speed_km_h: float
    location_description: str
    rakes_coaches: str
    signal_status: str
    has_conflict: Optional[bool] = False
    conflict_details: Optional[ConflictDetailsModel] = None


class PlatformOccupancyModel(CamelModel):
    platform: int
    platform_number: Optional[int] = None
    label: str
    platform_label: Optional[str] = None
    status: str
    train_no: Optional[str] = None
    train_number: Optional[str] = None
    train_name: Optional[str] = None
    occupancy_time: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    buffer_min: Optional[float] = None
    conflict_train: Optional[str] = None
    description: Optional[str] = None
    action_required: Optional[bool] = False


class ConflictItemModel(CamelModel):
    conflict_id: str
    platform: str
    incoming_train: str
    incoming_eta: str
    occupying_train: str
    occupying_departure: str
    overlap_min: float
    severity: str
    description: str
    recommended_platform: str
    recommended_action: str
    resolved: bool


class ConflictStatusModel(CamelModel):
    has_active_conflict: bool
    active_conflicts_count: int
    conflicts: List[ConflictItemModel]


class HeadwayBufferModel(CamelModel):
    station: str
    bottleneck_cleared: bool
    effective_headway_km: float
    trailing_trains_ahead: int
    block_clearance: str
    interlocking_loop_cycle_sec: float


class OperationsInflowResponseModel(CamelModel):
    station: str
    inflow_trains: List[InflowTrainModel]
    platform_occupancy: List[PlatformOccupancyModel]
    conflict_status: ConflictStatusModel
    headway_buffer: HeadwayBufferModel


class TelemetryPacketDetailsModel(CamelModel):
    channel: Optional[str] = None
    fec: Optional[str] = None
    crc: Optional[str] = None
    snr_db: Optional[float] = None
    raw_hex: Optional[str] = None
    payload_json: Optional[Dict[str, Any]] = None


class TelemetryPacketModel(CamelModel):
    id: str
    timestamp: str
    loco_id: str
    block_signal_mile: str
    subsystem: str
    telemetry_value: str
    speed_km_h: Optional[float] = None
    details: TelemetryPacketDetailsModel


class TelemetryStreamResponseModel(CamelModel):
    train_no: str
    train_name: str
    simulated_time: str
    position: TrainPositionModel
    signal_aspect: Optional[SignalAspectModel] = None
    navic_satellites_locked: int
    packet_rate_hz: float
    packets: List[TelemetryPacketModel]


class HorizonBreakdownModel(CamelModel):
    horizon: str
    schedule_mae: float
    railsync_mae: float
    reduction: str
    confidence: str


class AccuracyMetricsResponseModel(CamelModel):
    train_no: str
    train_name: str
    overall_section_mae_min: float
    schedule_baseline_mae_min: float
    error_reduction_pct: float
    tested_runs_count: int
    badge: str
    horizon_breakdown: List[HorizonBreakdownModel]
