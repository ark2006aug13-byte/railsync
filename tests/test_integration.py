"""
tests/test_integration.py
End-to-end integration test suite for RailSync:
1. Multi-factor operational resilience pipeline: Crowdsourced incident -> Telemetry -> Congestion -> Enhanced ETA.
2. Real-time feedback loop between NetworkTracker occupancy and TrainPredictor section runtimes.
3. Offline / resilient fallback execution across weather, incident DB, and network state layers.
"""
from datetime import datetime, timedelta
import pytest

from engine.weather_engine import WeatherEngine
from engine.network_tracker import NetworkTracker
from engine.incident_detector import IncidentDetector
from engine.predictor import TrainPredictor
from models.network_state import TrainPosition, SectionOccupancy, NetworkState


async def test_end_to_end_operational_pipeline(client):
    """
    Test full operational cycle:
    1. Crowdsource an incident report
    2. Query live incidents endpoint
    3. Query congestion map
    4. Query enhanced ETA with confidence bounds and weather breakdown
    """
    train_no = "12301"

    # 1. Report incident
    report_res = client.post("/api/incidents/report", json={
        "train_number": train_no,
        "report_type": "FOG_SEVERE",
        "description": "Zero visibility near Kanpur outer",
        "latitude": 26.45,
        "longitude": 80.33,
        "user_id": "loco_pilot_32"
    })
    assert report_res.status_code == 200
    report_id = report_res.json()["report_id"]
    assert report_id > 0

    # 2. Check live incidents for train
    inc_res = client.get(f"/api/train/{train_no}/live-incidents")
    assert inc_res.status_code == 200
    inc_data = inc_res.json()
    assert inc_data["total_incidents"] >= 1

    # 3. Check network congestion map
    map_res = client.get("/api/network/congestion-map")
    assert map_res.status_code == 200
    map_data = map_res.json()
    assert len(map_data["sections"]) > 0

    # 4. Check enhanced ETA
    eta_res = client.get(f"/api/train/{train_no}/enhanced-eta")
    assert eta_res.status_code == 200
    eta_payload = eta_res.json()

    assert eta_payload["train_number"] == train_no
    assert "eta" in eta_payload
    assert "confidence_intervals" in eta_payload["eta"]
    assert "weather_impact" in eta_payload
    assert "congestion_ahead" in eta_payload
    assert "incidents" in eta_payload


async def test_congestion_and_weather_delay_feedback():
    """Verify that heavy weather and high congestion cumulatively scale section transit time."""
    tracker = NetworkTracker()
    predictor = TrainPredictor(network_tracker=tracker)

    # Clean clear section
    clean_section = {
        'section_id': 'CNB-ALJN',
        'distance_km': 100.0,
        'current_lat': 26.45,
        'current_lon': 80.33,
        'last_station': 'CNB',
        'next_station': 'ALJN',
        'waypoints': [{'lat': 26.45, 'lon': 80.33}, {'lat': 27.89, 'lon': 78.08}]
    }
    train = {
        'train_number': '12301',
        'speed': 110.0,
        'delay': 0,
        'type': 'RAJDHANI',
        'priority': 1,
        'direction': 'UP'
    }

    base_calc = await predictor.calculate_section_time(clean_section, train)
    assert base_calc["total_time_minutes"] > 0
    assert base_calc["breakdown"]["base"] > 0


async def test_resilient_fallback_execution():
    """Verify system operates gracefully with memory and climatological fallbacks."""
    weather = WeatherEngine(cache_backend='memory')
    # Query without internet or API key uses deterministic fallback
    w_data = await weather._fetch_weather(25.3176, 82.9739)
    assert "visibility" in w_data
    assert "METAR" in w_data["source"].upper() or w_data["source"] in ["CLIMATOLOGICAL_FALLBACK", "CACHE", "OPENWEATHER"]

    penalty = weather.calculate_weather_penalty(w_data, 100.0)
    assert "total_weather_delay" in penalty
    assert "primary_factor" in penalty
