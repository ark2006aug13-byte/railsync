"""
tests/test_train_locate.py
Comprehensive test suite for the dynamic, strictly user-input driven train location retrieval pipeline.
Validates HTTP 400 on missing/invalid parameters, HTTP 404 on nonexistent trains,
HTTP 300 disambiguation on multi-match names, and HTTP 200 dynamic telemetry payload structure.
"""
import pytest
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_locate_missing_query_returns_400():
    """Verify empty or missing train_query returns HTTP 400."""
    resp = client.get("/api/train/locate?train_query=&journey_date=2026-10-01")
    assert resp.status_code == 400
    assert "Please provide a valid train number or train name" in resp.json().get("detail", "")


def test_locate_invalid_date_format_returns_400():
    """Verify non-YYYY-MM-DD journey_date returns HTTP 400."""
    resp = client.get("/api/train/locate?train_query=12859&journey_date=01-10-2026")
    assert resp.status_code == 400
    assert "Invalid journey_date format" in resp.json().get("detail", "")

    resp2 = client.get("/api/train/locate?train_query=12859&journey_date=not-a-date")
    assert resp2.status_code == 400
    assert "Invalid journey_date format" in resp2.json().get("detail", "")


def test_locate_unknown_train_returns_404():
    """Verify non-existent train identifier returns HTTP 404 with explicit error message."""
    resp = client.get("/api/train/locate?train_query=99999&journey_date=2026-10-01")
    assert resp.status_code == 404
    data = resp.json()
    assert data["success"] is False
    assert "No train found" in data.get("error", "") or "not found" in data.get("error", "")


def test_locate_name_disambiguation_returns_300():
    """Verify ambiguous train name returns HTTP 300 with matches list."""
    resp = client.get("/api/train/locate?train_query=Gitanjali&journey_date=2026-10-01")
    assert resp.status_code == 300
    data = resp.json()
    assert data["success"] is False
    assert "Multiple trains matched query" in data["error"]
    assert "matches" in data
    assert len(data["matches"]) >= 2
    assert any("12859" in m["train_number"] for m in data["matches"])
    assert any("12860" in m["train_number"] for m in data["matches"])


def test_locate_exact_train_number_success():
    """Verify valid 5-digit train number returns HTTP 200 with dynamic telemetry schema."""
    resp = client.get("/api/train/locate?train_query=12859&journey_date=2026-10-01")
    assert resp.status_code == 200
    data = resp.json()

    assert data["success"] is True
    assert "query" in data
    assert data["query"]["raw_input"] == "12859"
    assert data["query"]["resolved_train_number"] == "12859"
    assert "Gitanjali" in data["query"]["resolved_train_name"]
    assert data["query"]["journey_date"] == "2026-10-01"

    # Status must be one of the specified enum values
    assert data["status"] in ["RUNNING", "HALTED_AT_STATION", "NOT_STARTED", "CANCELLED", "COMPLETED"]

    # Telemetry structure
    telem = data["telemetry"]
    assert "last_reported_station" in telem
    assert "code" in telem["last_reported_station"]
    assert "name" in telem["last_reported_station"]
    assert "departure_time" in telem["last_reported_station"]

    assert "next_station" in telem
    assert "code" in telem["next_station"]
    assert "name" in telem["next_station"]
    assert "distance_km" in telem["next_station"]
    assert isinstance(telem["next_station"]["distance_km"], (int, float))

    assert "coordinates" in telem
    assert "lat" in telem["coordinates"]
    assert "lng" in telem["coordinates"]
    assert isinstance(telem["coordinates"]["lat"], (int, float))
    assert isinstance(telem["coordinates"]["lng"], (int, float))

    assert "speed_kmh" in telem
    assert isinstance(telem["speed_kmh"], (int, float))
    assert "delay_minutes" in telem
    assert isinstance(telem["delay_minutes"], int)

    assert "last_updated" in data


def test_locate_vande_bharat_disambiguation():
    """Verify multi-service brand like Vande Bharat returns multiple disambiguation options."""
    resp = client.get("/api/train/locate?train_query=Vande%20Bharat&journey_date=2026-10-01")
    assert resp.status_code == 300
    data = resp.json()
    assert len(data["matches"]) > 5
