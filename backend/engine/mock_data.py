"""
backend/engine/mock_data.py
Deterministic Mock Data and Golden Scenarios (FIX 18).
Provides repeatable fixtures for Train 12301, 12367, 22436, and key operational edge-cases:
1. Normal Right-Time Kinematics
2. Dense Winter Fog Restriction (Gangetic plains)
3. Terminal Throat & Platform Holding Queue (NDLS / HWH)
4. Temporary Speed Restriction (TSR Caution Order)
5. Active Operational Disruption with Controller Manual Override
"""
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from engine.eta_config import now_utc, to_utc
from models.eta_models import LiveEvent, IncidentTypeEnum, SignalAspectEnum
from engine.eta_services.event_ingestion_service import EventIngestionService
from engine.eta_services.incident_service import IncidentService

GOLDEN_SCENARIOS = {
    "NORMAL": {
        "name": "Normal High-Speed Running (130 km/h MPS)",
        "train_number": "12301",
        "description": "Train 12301 running right-time on DDU-PRYJ trunk corridor with clear green signals.",
        "delay_minutes": 4.0,
        "speed_kmph": 128.0,
        "signal_aspect": "GREEN",
        "headway_gap_km": 24.0,
        "is_fog": False,
        "is_incident": False
    },
    "HEAVY_FOG": {
        "name": "Severe Gangetic Fog Speed Restriction",
        "train_number": "12367",
        "description": "Dense winter fog between CNB and PRYJ with visibility <150m, speed capped to 60 km/h, recovery frozen.",
        "delay_minutes": 42.0,
        "speed_kmph": 58.0,
        "signal_aspect": "DOUBLE_YELLOW",
        "headway_gap_km": 6.5,
        "is_fog": True,
        "is_incident": False
    },
    "OUTER_HOLDING": {
        "name": "Terminal Outer Home Platform Occupancy Holding",
        "train_number": "12301",
        "description": "Train approaching NDLS held at Yamuna Bridge Outer due to delayed departure of platform 12 occupant.",
        "delay_minutes": 15.0,
        "speed_kmph": 0.0,
        "signal_aspect": "RED",
        "headway_gap_km": 1.2,
        "is_fog": False,
        "is_incident": False
    },
    "CAUTION_ORDER_TSR": {
        "name": "Active Divisional Caution Order (TSR 30 km/h)",
        "train_number": "22436",
        "description": "Track maintenance caution order over 4.5 km track renewal zone; slack recovery frozen.",
        "delay_minutes": 12.0,
        "speed_kmph": 30.0,
        "signal_aspect": "YELLOW",
        "headway_gap_km": 8.0,
        "is_fog": False,
        "is_incident": False
    },
    "CONTROLLER_OVERRIDE": {
        "name": "Operational Incident & Manual Controller Override",
        "train_number": "12301",
        "description": "Unscheduled chain pulling halt with Railway Traffic Controller manual ETA override.",
        "delay_minutes": 35.0,
        "speed_kmph": 0.0,
        "signal_aspect": "YELLOW",
        "headway_gap_km": 12.0,
        "is_fog": False,
        "is_incident": True
    }
}

def seed_deterministic_scenario(scenario_key: str = "NORMAL", as_of_time: Optional[datetime] = None) -> Dict[str, Any]:
    """
    Applies deterministic ground conditions and incident state for a selected scenario.
    """
    scen = GOLDEN_SCENARIOS.get(scenario_key.upper(), GOLDEN_SCENARIOS["NORMAL"])
    train_no = scen["train_number"]
    eval_time = to_utc(as_of_time or now_utc())
    run_date = eval_time.strftime("%Y-%m-%d")

    # Ingest baseline ground event
    ev = LiveEvent(
        event_id=f"SCEN-{scenario_key}-{train_no}",
        train_number=train_no,
        event_type="GPS_PING",
        station_id="REF_STN",
        event_time=eval_time - timedelta(seconds=45),
        source="GPS_GEOFENCE",
        payload={
            "run_date": run_date,
            "delay_minutes": scen["delay_minutes"],
            "current_km": 720.0,
            "station_code": "PRYJ"
        }
    )
    EventIngestionService.ingest_event(ev)

    # If incident scenario, register incident and override
    if scen["is_incident"]:
        IncidentService.register_incident(
            incident_type=IncidentTypeEnum.CHAIN_PULLING,
            severity="HIGH",
            delay_impact_min=25.0,
            train_number=train_no,
            station_code="NDLS",
            freeze_recovery=True,
            notes="Alarm Chain Pulling reported by Loco Pilot near Khurja Jn",
            reported_by="CONTROLLER_NORTHERN"
        )
        # Set manual override
        IncidentService.set_manual_override(
            train_number=train_no,
            station_code="NDLS",
            manual_eta=eval_time + timedelta(hours=4, minutes=45),
            reason="Train held for mechanical reset; controller slot regulation",
            actor_id="CONTROLLER_NORTHERN"
        )

    return {
        "scenario": scenario_key,
        "train_number": train_no,
        "details": scen
    }
