"""
tests/test_live_status_v1.py
Unit and integration test suite for the FastAPI v1 Live Train Status endpoint.
Verifies input validation, schema normalization, caching strategy, and fallback resiliency.
"""
from pathlib import Path
import sys
import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient

from api.main import app
from api.v1.schemas import LiveTrainStatusResponse
from services.cache_service import async_cache


@pytest.fixture
def client():
    return TestClient(app)


def test_live_status_valid_train_default_date(client):
    """Verifies that querying a valid 5-digit train number returns 200 and passes strict Pydantic validation."""
    response = client.get("/api/v1/trains/12424/live-status")
    assert response.status_code == 200
    data = response.json()

    # 1. Strict Pydantic Schema Validation
    validated = LiveTrainStatusResponse.model_validate(data)
    assert validated.status == "success"
    assert validated.train_info.train_number == "12424"
    assert validated.live_telemetry.current_status in ["RUNNING", "REACHED", "YET_TO_START", "CANCELLED"]
    assert -90.0 <= validated.live_telemetry.current_coordinates.latitude <= 90.0
    assert -180.0 <= validated.live_telemetry.current_coordinates.longitude <= 180.0
    assert validated.live_telemetry.current_speed_kmh >= 0.0
    assert validated.route_progress.total_stations_count > 0
    assert len(validated.schedule_stoppages) > 0

    # 2. Header Verification
    assert "x-data-source" in response.headers
    assert response.headers["x-data-source"] in ["live", "mock", "cache"]


def test_live_status_valid_date_formats(client):
    """Verifies that both YYYY-MM-DD and DD-MM-YYYY date formats are accepted and normalized."""
    # Format: YYYY-MM-DD
    resp_iso = client.get("/api/v1/trains/12424/live-status?journey_date=2026-10-02")
    assert resp_iso.status_code == 200
    data_iso = resp_iso.json()
    assert data_iso["train_info"]["journey_date"] == "2026-10-02"

    # Format: DD-MM-YYYY
    resp_in = client.get("/api/v1/trains/12424/live-status?journey_date=02-10-2026")
    assert resp_in.status_code == 200
    data_in = resp_in.json()
    # Normalized to standard YYYY-MM-DD
    assert data_in["train_info"]["journey_date"] == "2026-10-02"


def test_live_status_invalid_train_number(client):
    """Verifies that non-5-digit train numbers are rejected with HTTP 400."""
    # Less than 5 digits
    resp1 = client.get("/api/v1/trains/123/live-status")
    assert resp1.status_code == 400
    assert "Invalid train number" in resp1.json()["detail"]

    # Alphabetic string
    resp2 = client.get("/api/v1/trains/rajdhani/live-status")
    assert resp2.status_code == 400
    assert "Invalid train number" in resp2.json()["detail"]

    # More than 5 digits
    resp3 = client.get("/api/v1/trains/123456/live-status")
    assert resp3.status_code == 400
    assert "Invalid train number" in resp3.json()["detail"]


def test_live_status_invalid_journey_date(client):
    """Verifies that invalid calendar dates are rejected with HTTP 400."""
    # Non-existent calendar date
    resp1 = client.get("/api/v1/trains/12424/live-status?journey_date=2026-02-31")
    assert resp1.status_code == 400
    assert "Invalid journey_date" in resp1.json()["detail"]

    # Malformed date string
    resp2 = client.get("/api/v1/trains/12424/live-status?journey_date=invalid-date")
    assert resp2.status_code == 400
    assert "Invalid journey_date" in resp2.json()["detail"]


def test_live_status_caching_behavior(client):
    """Verifies that consecutive calls to the same train and date utilize cache and return X-Data-Source: cache."""
    test_train = "12301"
    test_date = "2026-10-15"

    # First call - cache miss (fetches or generates mock)
    resp1 = client.get(f"/api/v1/trains/{test_train}/live-status?journey_date={test_date}")
    assert resp1.status_code == 200
    source1 = resp1.headers.get("x-data-source")

    # Second call - should hit cache
    resp2 = client.get(f"/api/v1/trains/{test_train}/live-status?journey_date={test_date}")
    assert resp2.status_code == 200
    source2 = resp2.headers.get("x-data-source")

    assert source2 == "cache"
    assert resp1.json() == resp2.json()


def test_live_status_another_profile(client):
    """Verifies that other trains like 12367 Vikramshila Express work seamlessly."""
    response = client.get("/api/v1/trains/12367/live-status?journey_date=2026-06-30")
    assert response.status_code == 200
    data = response.json()

    validated = LiveTrainStatusResponse.model_validate(data)
    assert validated.train_info.train_number == "12367"
    assert validated.train_info.journey_date == "2026-06-30"
    assert len(validated.schedule_stoppages) >= 2
