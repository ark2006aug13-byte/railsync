"""
tests/test_train_status_authentic.py
Comprehensive test suite for the overhauled authentic train status and telemetry pipeline.
Ensures zero mock/fake data generation, strict dynamic resolution, transparent logging,
and validation of the standardized response schema.
"""
import pytest
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_status_missing_query_returns_400():
    """Verify empty or missing train_query returns HTTP 400."""
    resp = client.get("/api/train/status?train_query=&journey_date=2026-10-01")
    assert resp.status_code == 400
    assert "Please provide a valid train number or train name" in resp.json().get("detail", "")


def test_status_invalid_date_format_returns_400():
    """Verify non-YYYY-MM-DD journey_date returns HTTP 400."""
    resp = client.get("/api/train/status?train_query=12859&journey_date=01-10-2026")
    assert resp.status_code == 400
    assert "Invalid journey_date format" in resp.json().get("detail", "")

    resp2 = client.get("/api/train/status?train_query=12859&journey_date=invalid-date")
    assert resp2.status_code == 400
    assert "Invalid journey_date format" in resp2.json().get("detail", "")


def test_status_nonexistent_train_returns_404():
    """Verify non-existent train returns HTTP 404 and NEVER synthesizes fake data."""
    resp = client.get("/api/train/status?train_query=99999&journey_date=2026-10-01")
    assert resp.status_code == 404
    data = resp.json()
    detail = data.get("detail", {})
    if isinstance(detail, dict):
        assert "not found" in detail.get("error", "").lower()
    else:
        assert "not found" in str(detail).lower() or "not found" in str(data.get("error", "")).lower()


def test_status_ambiguous_name_returns_300():
    """Verify ambiguous train name returns HTTP 300 with matches list."""
    resp = client.get("/api/train/status?train_query=Rajdhani&journey_date=2026-10-01")
    assert resp.status_code == 300
    data = resp.json()
    detail = data.get("detail", data)
    assert detail.get("success") is False
    assert "Multiple trains matched query" in detail.get("error", "")
    assert "matches" in detail
    assert len(detail["matches"]) > 1


def test_status_exact_train_number_standardized_schema():
    """Verify valid train query returns standardized payload matching exact specifications."""
    resp = client.get("/api/train/status?train_query=12859&journey_date=2026-10-01")
    assert resp.status_code == 200
    data = resp.json()

    # 1. Root success flag
    assert data["success"] is True

    # 2. Train Block
    train = data["train"]
    assert train["number"] == "12859"
    assert "GITANJALI" in train["name"].upper()
    assert train["origin_date"] == "2026-10-01"
    assert train["source"] == "CSMT"
    assert train["destination"] == "HWH"

    # 3. Running Status Block
    status_block = data["running_status"]
    assert status_block["status"] in ["RUNNING", "HALTED", "NOT_STARTED", "TERMINATED"]

    last_stn = status_block["last_station"]
    assert "code" in last_stn
    assert "name" in last_stn
    assert "actual_departure" in last_stn
    assert isinstance(last_stn["delay_minutes"], int)

    next_stn = status_block["next_station"]
    assert "code" in next_stn
    assert "name" in next_stn
    assert "scheduled_arrival" in next_stn
    assert "expected_arrival" in next_stn
    assert isinstance(next_stn["distance_km"], (int, float))

    assert isinstance(status_block["current_speed_kmh"], (int, float))
    assert "lat" in status_block["current_location"]
    assert "lng" in status_block["current_location"]
    assert isinstance(status_block["current_location"]["lat"], (int, float))
    assert isinstance(status_block["current_location"]["lng"], (int, float))

    # 4. Schedule Array
    schedule = data["schedule"]
    assert isinstance(schedule, list)
    assert len(schedule) > 0
    sample = schedule[0]
    assert "station_code" in sample
    assert "sch_dep" in sample
    assert "act_dep" in sample
    assert sample["status"] in ["DEPARTED", "HALTED", "UPCOMING"]

    # 5. Last synced timestamp in IST (+05:30)
    assert "+05:30" in data["last_synced_ist"]


def test_status_path_based_routing():
    """Verify RESTful path routing /api/train/{train_no}/status returns identical schema."""
    resp = client.get("/api/train/12859/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["train"]["number"] == "12859"
    assert data["running_status"]["status"] in ["RUNNING", "HALTED", "NOT_STARTED", "TERMINATED"]


def test_status_not_started_train_telemetry():
    """Verify a train that has not yet departed returns NOT_STARTED status with zero speed."""
    resp = client.get("/api/train/status?train_query=12301&journey_date=2026-10-01")
    assert resp.status_code == 200
    data = resp.json()
    assert data["train"]["number"] == "12301"
    # Train 12301 departs at 16:50 IST, so before that it must be NOT_STARTED
    assert data["running_status"]["status"] == "NOT_STARTED"
    assert data["running_status"]["current_speed_kmh"] == 0
    assert data["running_status"]["last_station"]["code"] == "HWH"
