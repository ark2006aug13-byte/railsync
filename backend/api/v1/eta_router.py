"""
backend/api/v1/eta_router.py
Comprehensive REST and SSE Router for Dynamic Train ETA Prediction System.
Implements:
- 18+ Production Endpoints
- Strict IST timestamps (+05:30)
- RFC7807 error formats
- JWT RBAC security for controller actions
- Real-time Server-Sent Events (SSE) streaming at /api/v1/live/stream
"""
import asyncio
import json
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query, Request, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from engine.eta_config import format_ist_iso, now_utc, to_utc
from models.eta_models import LiveEvent, IncidentTypeEnum, UserRoleEnum
from engine.eta_engine import TrainETAPredictorEngine
from engine.train_registry import TRAIN_PROFILES
from engine.eta_services.incident_service import IncidentService
from engine.eta_services.feedback_service import FeedbackService
from engine.eta_services.event_ingestion_service import EventIngestionService
from engine.eta_services.station_engine import JUNCTION_MICRO_GRAPHS
from engine.security.auth import (
    SYSTEM_USERS, create_access_token, get_current_user, require_role
)
from engine.workers.background_workers import BackgroundWorkerManager
from engine.mock_data import GOLDEN_SCENARIOS, seed_deterministic_scenario

router = APIRouter(prefix="/api/v1", tags=["Train ETA Predictor v1"])

# ---------------------------------------------------------------------------
# Request & Response Schemas
# ---------------------------------------------------------------------------
class TokenRequest(BaseModel):
    username: str
    password: str

class IncidentCreateRequest(BaseModel):
    incident_type: IncidentTypeEnum
    severity: str = "HIGH"
    delay_impact_min: float = 15.0
    train_number: Optional[str] = None
    station_code: Optional[str] = None
    segment_id: Optional[str] = None
    freeze_recovery: bool = True
    notes: Optional[str] = None

class OverrideETARequest(BaseModel):
    train_number: str
    station_code: str
    manual_eta_ist: str  # ISO string or HH:MM
    reason: str

class ResolveIncidentRequest(BaseModel):
    incident_id: str

class ActualArrivalRequest(BaseModel):
    train_number: str
    station_code: str
    actual_arrival_ist: str
    actual_departure_ist: Optional[str] = None
    source: str = "INTERLOCKING_CIRCUIT"

class ScenarioApplyRequest(BaseModel):
    scenario_key: str = "NORMAL"

def rfc7807_error(title: str, detail: str, status_code: int, request: Request) -> Dict[str, Any]:
    return {
        "type": "https://railsync.cris.org.in/errors/" + title.lower().replace(" ", "-"),
        "title": title,
        "status": status_code,
        "detail": detail,
        "instance": str(request.url),
        "correlation_id": request.headers.get("X-Correlation-ID", f"corr-{uuid.uuid4().hex[:8]}")
    }

# ---------------------------------------------------------------------------
# 1. Authentication Endpoint
# ---------------------------------------------------------------------------
@router.post("/auth/token")
def login_for_token(req: TokenRequest, request: Request):
    """Issues JWT token with role claims for operators and controllers."""
    user = SYSTEM_USERS.get(req.username)
    if not user or user["password"] != req.password:
        raise HTTPException(
            status_code=401,
            detail=rfc7807_error("Unauthorized", "Invalid username or password.", 401, request)
        )
    token = create_access_token(user["user_id"], user["username"], user["role"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user["user_id"],
        "username": user["username"],
        "role": user["role"].value if hasattr(user["role"], "value") else str(user["role"])
    }

# ---------------------------------------------------------------------------
# 2. Dynamic ETA & Train Prediction Endpoints
# ---------------------------------------------------------------------------
@router.get("/trains/{train_number}/eta")
def get_train_dynamic_eta(
    train_number: str,
    run_date: Optional[str] = None,
    early_arrival_policy: Optional[str] = None
):
    """
    Main prediction endpoint: segment-wise kinematics, bounded recovery,
    P10/P50/P90 quantiles, and 8-factor delay breakdown.
    """
    return TrainETAPredictorEngine.predict_train_eta(
        train_number=train_number,
        run_date=run_date,
        early_arrival_policy=early_arrival_policy
    )

@router.get("/trains/{train_number}/route")
def get_train_route(train_number: str):
    """Returns official timetable schedule, station offsets, and platform assignments."""
    profile = TRAIN_PROFILES.get(train_number)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Train {train_number} route not found.")
    return {
        "train_number": train_number,
        "train_name": profile["name"],
        "origin": profile["origin_code"],
        "destination": profile["dest_code"],
        "total_distance_km": profile["total_distance_km"],
        "stations": profile["stations"]
    }

@router.get("/trains/{train_number}/status")
def get_train_live_status(train_number: str, run_date: Optional[str] = None):
    """Returns live kinematic position, speed, signal aspect, and staleness."""
    pred = TrainETAPredictorEngine.predict_train_eta(train_number=train_number, run_date=run_date)
    return {
        "train_number": train_number,
        "train_name": pred["meta"]["train_name"],
        "live_status": pred["live_status"],
        "disclaimer": pred["meta"]["disclaimer"]
    }

@router.get("/trains/{train_number}/factors")
def get_train_factor_ledger(train_number: str, run_date: Optional[str] = None):
    """Returns DelayFactorLedger items and double-count audit statuses for upcoming stations."""
    pred = TrainETAPredictorEngine.predict_train_eta(train_number=train_number, run_date=run_date)
    return {
        "train_number": train_number,
        "upcoming_stations_count": len(pred["upcoming_stations"]),
        "factors": [
            {
                "station_code": stn["station_code"],
                "station_name": stn["station_name"],
                "delay_breakdown": stn["delay_breakdown"],
                "double_count_validation": stn["double_count_validation"],
                "factor_ledger": stn["factor_ledger"]
            }
            for stn in pred["upcoming_stations"]
        ]
    }

@router.get("/trains/{train_number}/uncertainty")
def get_train_uncertainty(train_number: str, run_date: Optional[str] = None):
    """Returns P10, P50, P90 confidence envelopes and horizon variance growth."""
    pred = TrainETAPredictorEngine.predict_train_eta(train_number=train_number, run_date=run_date)
    return {
        "train_number": train_number,
        "bounds": [
            {
                "station_code": stn["station_code"],
                "station_name": stn["station_name"],
                "km": stn["km"],
                "eta_p10_ist": stn["eta_p10_ist"],
                "eta_p50_ist": stn["eta_p50_ist"],
                "eta_p90_ist": stn["eta_p90_ist"],
                "confidence_score": stn["confidence_score"],
                "confidence_level": stn["confidence_level"],
                "uncertainty_window_min": stn["uncertainty_window_min"]
            }
            for stn in pred["upcoming_stations"]
        ]
    }

# ---------------------------------------------------------------------------
# 3. Station & Corridor Endpoints
# ---------------------------------------------------------------------------
@router.get("/stations/{station_code}/upcoming")
def get_upcoming_trains_for_station(station_code: str):
    """Returns upcoming trains scheduled to arrive at the station with dynamic ETAs."""
    matching = []
    for t_no, profile in TRAIN_PROFILES.items():
        stn_codes = [s["code"] for s in profile.get("stations", [])]
        if station_code in stn_codes:
            pred = TrainETAPredictorEngine.predict_train_eta(t_no)
            for up in pred["upcoming_stations"]:
                if up["station_code"] == station_code:
                    matching.append({
                        "train_number": t_no,
                        "train_name": profile["name"],
                        "platform": up["platform"],
                        "scheduled_arrival_ist": up["scheduled_arrival_ist"],
                        "eta_p50_ist": up["eta_p50_ist"],
                        "eta_p10_ist": up["eta_p10_ist"],
                        "eta_p90_ist": up["eta_p90_ist"],
                        "projected_delay_min": up["projected_delay_min"],
                        "platform_conflict": up["platform_conflict"]
                    })
    return {"station_code": station_code, "upcoming_trains": matching}

@router.get("/stations/{station_code}/micrograph")
def get_station_micrograph(station_code: str):
    """Returns terminal throat topology parameters for major railway junctions."""
    graph = JUNCTION_MICRO_GRAPHS.get(station_code.upper())
    if not graph:
        return {
            "station_code": station_code,
            "has_custom_micrograph": False,
            "turnout_mps_kmph": 30.0,
            "base_throat_friction_min": 1.5,
            "description": "Standard through station sectional interlocking"
        }
    return {
        "station_code": station_code,
        "has_custom_micrograph": True,
        **graph
    }

@router.get("/corridor")
def get_corridor_info():
    """Returns high-density corridors (Howrah - New Delhi Trunk)."""
    return {
        "corridor_name": "Eastern Trunk Corridor (Howrah - NDLS via Grand Chord)",
        "mps_kmph": 130.0,
        "signaling_system": "Automatic Block Signaling (4-Aspect) with Kavach ATP",
        "key_junctions": ["HWH", "BWN", "ASN", "DHN", "GAYA", "DDU", "PRYJ", "CNB", "NDLS"],
        "active_supported_trains": list(TRAIN_PROFILES.keys())
    }

# ---------------------------------------------------------------------------
# 4. Ingestion & Ground Truth Feedback Endpoints
# ---------------------------------------------------------------------------
@router.post("/events/ingest")
def ingest_live_event(event: LiveEvent, request: Request):
    """Ingests operational event with deduplication cache and 60s future drift validation."""
    result = EventIngestionService.ingest_event(event)
    if result.get("status") == "REJECTED_FUTURE_TIMESTAMP":
        raise HTTPException(
            status_code=400,
            detail=rfc7807_error("Future Timestamp Drift", result["error"], 400, request)
        )
    return result

@router.post("/events/actual-arrival")
def record_actual_arrival(req: ActualArrivalRequest):
    """Records ground truth arrival event and triggers automatic error evaluation & recalibration."""
    dt_arr = datetime.fromisoformat(req.actual_arrival_ist)
    dt_dep = datetime.fromisoformat(req.actual_departure_ist) if req.actual_departure_ist else None
    
    metrics = FeedbackService.record_actual_arrival(
        train_number=req.train_number,
        station_code=req.station_code,
        actual_arrival_time=dt_arr,
        actual_departure_time=dt_dep,
        source=req.source
    )
    return {
        "status": "RECORDED",
        "reconciled_predictions_count": len(metrics),
        "metrics": [m.model_dump() for m in metrics]
    }

@router.get("/analytics/accuracy")
def get_prediction_accuracy_metrics():
    """Returns system-wide MAE, P90 empirical coverage, and horizon breakdown."""
    return FeedbackService.get_accuracy_metrics()

@router.get("/analytics/conformal-offsets")
def get_conformal_offsets():
    """Returns currently calibrated quantile margin offsets."""
    return FeedbackService.get_conformal_offsets()

# ---------------------------------------------------------------------------
# 5. Administrative & Traffic Controller Overrides (JWT RBAC)
# ---------------------------------------------------------------------------
@router.post("/admin/incidents")
def create_operational_incident(
    req: IncidentCreateRequest,
    user: Dict[str, Any] = Depends(require_role(UserRoleEnum.CONTROLLER))
):
    """Registers an active operational incident with recovery freeze flag."""
    inc = IncidentService.register_incident(
        incident_type=req.incident_type,
        severity=req.severity,
        delay_impact_min=req.delay_impact_min,
        train_number=req.train_number,
        station_code=req.station_code,
        segment_id=req.segment_id,
        freeze_recovery=req.freeze_recovery,
        notes=req.notes,
        reported_by=user.get("username", "CONTROLLER")
    )
    return {"status": "SUCCESS", "incident": inc.model_dump(mode="json")}

@router.post("/admin/override-eta")
def set_controller_manual_override(
    req: OverrideETARequest,
    user: Dict[str, Any] = Depends(require_role(UserRoleEnum.CONTROLLER))
):
    """Allows authorized controller to manually pin an ETA for a train and station."""
    dt_override = datetime.fromisoformat(req.manual_eta_ist)
    inc = IncidentService.set_manual_override(
        train_number=req.train_number,
        station_code=req.station_code,
        manual_eta=dt_override,
        reason=req.reason,
        actor_id=user.get("username", "CONTROLLER")
    )
    return {"status": "OVERRIDE_ACTIVE", "override": inc.model_dump(mode="json")}

@router.post("/admin/resolve-incident")
def resolve_operational_incident(
    req: ResolveIncidentRequest,
    user: Dict[str, Any] = Depends(require_role(UserRoleEnum.CONTROLLER))
):
    """Marks an active incident as resolved."""
    inc = IncidentService.resolve_incident(req.incident_id, actor_id=user.get("username", "CONTROLLER"))
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found.")
    return {"status": "RESOLVED", "incident": inc.model_dump(mode="json")}

@router.get("/admin/audit-logs")
def get_audit_trail(
    limit: int = 50,
    user: Dict[str, Any] = Depends(require_role(UserRoleEnum.CONTROLLER))
):
    """Returns immutable audit logs of controller actions."""
    logs = IncidentService.get_audit_logs(limit)
    return {"count": len(logs), "logs": [l.model_dump(mode="json") for l in logs]}

@router.get("/system/adapters")
def get_system_adapter_health():
    """Returns health and latency of all upstream railway and weather adapters."""
    return {"adapters": BackgroundWorkerManager.get_adapter_statuses()}

@router.post("/system/scenarios/apply")
def apply_simulation_scenario(req: ScenarioApplyRequest):
    """Applies a deterministic golden scenario for validation or demonstration."""
    res = seed_deterministic_scenario(req.scenario_key)
    return {"status": "APPLIED", "scenario": res}

# ---------------------------------------------------------------------------
# 6. Real-Time Server-Sent Events (SSE) Stream
# ---------------------------------------------------------------------------
@router.get("/live/stream")
async def live_telemetry_stream(train_number: str = "12301"):
    """
    Server-Sent Events (SSE) stream broadcasting live kinematic position,
    signal aspect, and upcoming station ETAs every 2 seconds.
    """
    async def event_generator():
        while True:
            try:
                pred = TrainETAPredictorEngine.predict_train_eta(train_number=train_number)
                payload = {
                    "train_number": train_number,
                    "timestamp_ist": pred["meta"]["evaluated_at_ist"],
                    "speed_kmph": pred["live_status"]["current_speed_kmph"],
                    "current_km": pred["live_status"]["current_km"],
                    "signal_aspect": pred["live_status"]["signal_aspect"],
                    "current_delay_min": pred["live_status"]["current_delay_minutes"],
                    "next_station": pred["upcoming_stations"][0] if pred["upcoming_stations"] else None
                }
                yield f"data: {json.dumps(payload)}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
            await asyncio.sleep(2.0)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
