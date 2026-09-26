"""
tests/test_api_endpoints.py
Comprehensive test suite for RailSync REST API endpoints:
1. GET /api/train/{train_number}/enhanced-eta (ETA with confidence bounds, weather, congestion, incidents)
2. GET /api/network/congestion-map (network occupancy and congestion levels)
3. GET /api/train/{train_number}/live-incidents (detected and reported train incidents)
4. GET /api/weather/{lat}/{lon} (location weather impact and operational recommendations)
5. GET /api/health and GET /api/corridor
"""
import pytest


def test_get_enhanced_eta_endpoint(client):
    """Verify /api/train/{train_number}/enhanced-eta endpoint returns full composite payload."""
    res = client.get("/api/train/12301/enhanced-eta")
    assert res.status_code == 200
    data = res.json()

    assert data["train_number"] == "12301"
    assert "eta" in data
    assert "weather_impact" in data
    assert "congestion_ahead" in data
    assert "incidents" in data

    # Verify nested ETA payload
    eta = data["eta"]
    assert "confidence_intervals" in eta
    assert "waterfall_breakdown" in eta

    # Verify weather impact
    w = data["weather_impact"]
    assert "impact_per_100km" in w
    assert "recommendation" in w

    # Verify congestion ahead
    cong = data["congestion_ahead"]
    assert "count" in cong
    assert "risk_level" in cong


def test_get_network_congestion_map_endpoint(client):
    """Verify /api/network/congestion-map endpoint returns section occupancies."""
    res = client.get("/api/network/congestion-map")
    assert res.status_code == 200
    data = res.json()

    assert "timestamp" in data
    assert "sections" in data
    assert isinstance(data["sections"], list)
    assert len(data["sections"]) > 0

    first_sec = data["sections"][0]
    assert "section_id" in first_sec
    assert "congestion_level" in first_sec
    assert "train_count" in first_sec
    assert "occupancy_percentage" in first_sec


def test_get_live_incidents_endpoint(client):
    """Verify /api/train/{train_number}/live-incidents returns detected and reported incidents."""
    # Submit a report first to verify reported incidents aggregation
    report_payload = {
        "train_number": "12301",
        "report_type": "FOG_MODERATE",
        "description": "Moderate fog near Prayagraj",
        "user_id": "observer_55"
    }
    client.post("/api/incidents/report", json=report_payload)

    res = client.get("/api/train/12301/live-incidents")
    assert res.status_code == 200
    data = res.json()

    assert data["train_number"] == "12301"
    assert "detected_incidents" in data
    assert "reported_incidents" in data
    assert "total_incidents" in data
    assert isinstance(data["detected_incidents"], list)
    assert isinstance(data["reported_incidents"]["incidents"], list)
    assert data["total_incidents"] >= 1


def test_weather_lat_lon_endpoint(client):
    """Verify /api/weather/{lat}/{lon} returns weather metrics and recommendation."""
    res = client.get("/api/weather/26.4499/80.3319")
    assert res.status_code == 200
    data = res.json()

    assert "location" in data
    assert data["location"]["lat"] == pytest.approx(26.4499)
    assert data["location"]["lon"] == pytest.approx(80.3319)
    assert "current_weather" in data
    assert "impact_per_100km" in data
    assert "recommendation" in data


def test_health_and_corridor_endpoints(client):
    """Verify health and corridor geometry endpoints."""
    res_health = client.get("/api/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "ok"

    res_corridor = client.get("/api/corridor")
    assert res_corridor.status_code == 200
    c_data = res_corridor.json()
    assert len(c_data["stations"]) == 9
    assert len(c_data["sections"]) == 8


def test_live_station_traffic_endpoint(client):
    """Verify /api/station/{station_code}/live returns authentic traffic and congestion analytics."""
    res = client.get("/api/station/NDLS/live?hours=2")
    assert res.status_code == 200
    data = res.json()

    assert data["status"] == "ok"
    assert data["station_code"] == "NDLS"
    assert "analytics" in data

    analytics = data["analytics"]
    assert "throat_congestion_level" in analytics
    assert "outer_holding_penalty_min" in analytics
    assert "platform_conflicts" in analytics
    assert "trains_manifest" in analytics
    assert isinstance(analytics["trains_manifest"], list)
    assert len(analytics["trains_manifest"]) > 0

    # Verify first train item format
    t0 = analytics["trains_manifest"][0]
    assert "number" in t0
    assert "name" in t0
    assert "platform" in t0
    assert "expected_arrival" in t0
    assert "status" in t0

