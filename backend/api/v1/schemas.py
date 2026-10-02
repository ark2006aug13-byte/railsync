"""
api/v1/schemas.py
Strict Pydantic v2 response schemas for RailSync v1 Live Train Status API.
"""
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class TrainStatusEnum(str, Enum):
    RUNNING = "RUNNING"
    REACHED = "REACHED"
    YET_TO_START = "YET_TO_START"
    CANCELLED = "CANCELLED"


class Coordinates(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    latitude: float = Field(..., description="WGS84 Latitude coordinate (-90 to 90)")
    longitude: float = Field(..., description="WGS84 Longitude coordinate (-180 to 180)")

    @field_validator("latitude")
    @classmethod
    def validate_latitude(cls, v: float) -> float:
        if not (-90.0 <= v <= 90.0):
            raise ValueError(f"Latitude must be between -90 and 90, got {v}")
        return round(v, 6)

    @field_validator("longitude")
    @classmethod
    def validate_longitude(cls, v: float) -> float:
        if not (-180.0 <= v <= 180.0):
            raise ValueError(f"Longitude must be between -180 and 180, got {v}")
        return round(v, 6)


class TrainInfo(BaseModel):
    model_config = ConfigDict(extra="ignore")

    train_number: str = Field(..., description="5-digit official Indian Railways train number")
    train_name: str = Field(..., description="Official train name")
    journey_date: str = Field(..., description="Journey origin date in YYYY-MM-DD format")


class LiveTelemetry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    current_status: TrainStatusEnum = Field(..., description="Operational status: RUNNING, REACHED, YET_TO_START, CANCELLED")
    current_coordinates: Coordinates = Field(..., description="Current GPS coordinates of the train")
    current_speed_kmh: float = Field(..., description="Instantaneous speed in km/h")
    current_location_text: str = Field(..., description="Human readable description of the current position")
    delay_minutes: int = Field(..., description="Current running delay in minutes (+ve for delayed, 0 for on-time)")
    last_updated_time: str = Field(..., description="ISO 8601 UTC timestamp of last telemetry fix")


class LastStation(BaseModel):
    model_config = ConfigDict(extra="ignore")

    code: str = Field(..., description="Station alpha code")
    name: str = Field(..., description="Station name")
    actual_departure: str = Field(..., description="Actual departure time (HH:MM or ISO)")
    delay_dep_minutes: int = Field(..., description="Departure delay in minutes")


class NextStation(BaseModel):
    model_config = ConfigDict(extra="ignore")

    code: str = Field(..., description="Station alpha code")
    name: str = Field(..., description="Station name")
    scheduled_arrival: str = Field(..., description="Timetable scheduled arrival time (HH:MM)")
    estimated_arrival: str = Field(..., description="Dynamic estimated arrival time (HH:MM)")
    distance_to_go_km: float = Field(..., description="Distance remaining to next station in kilometers")


class RouteProgress(BaseModel):
    model_config = ConfigDict(extra="ignore")

    last_station: Optional[LastStation] = Field(None, description="Last cleared station details")
    next_station: Optional[NextStation] = Field(None, description="Upcoming station details")
    total_stations_count: int = Field(..., description="Total stops along the corridor route")
    completed_stations_count: int = Field(..., description="Number of stations already departed")


class ScheduleStoppage(BaseModel):
    model_config = ConfigDict(extra="ignore")

    station_code: str = Field(..., description="Station alpha code")
    station_name: str = Field(..., description="Station full name")
    scheduled_arrival: str = Field(..., description="Scheduled arrival time or START")
    scheduled_departure: str = Field(..., description="Scheduled departure time or END")
    distance_km: float = Field(..., description="Cumulative distance from origin in kilometers")
    coordinates: Coordinates = Field(..., description="Station geographic coordinates")
    has_passed: bool = Field(..., description="Flag indicating if the train has already passed this station")


class LiveTrainStatusResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    status: str = Field("success", description="Response status (success)")
    train_info: TrainInfo = Field(..., description="Train metadata")
    live_telemetry: LiveTelemetry = Field(..., description="Instantaneous telemetry fix")
    route_progress: RouteProgress = Field(..., description="Route progression metrics")
    schedule_stoppages: List[ScheduleStoppage] = Field(..., description="Full route schedule and stoppage list")
