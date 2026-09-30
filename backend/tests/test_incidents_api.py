"""
tests/test_incidents_api.py
Comprehensive test suite for crowdsourced incident reporting API:
1. Valid incident submission returns HTTP 200 and report_id.
2. Invalid report_type returns HTTP 400 with descriptive error.
3. Spam prevention rejects rapid successive reports by same user for same train (HTTP 429).
4. Fetching train incidents returns recent submitted reports.
5. Root discovery endpoint includes incident reporting paths.
"""
import pytest
from fastapi.testclient import TestClient

from api.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_submit_incident_report_success(client):
    """Test successful submission of a valid crowdsource incident report."""
    payload = {
        "train_number": "12301",
        "report_type": "FOG_SEVERE",
        "description": "Dense fog between CNB and ALJN, visibility < 40m",
        "latitude": 26.4499,
        "longitude": 80.3319,
        "user_id": "commuter_441"
    }
    response = client.post("/api/incidents/report", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "report_id" in data
    assert isinstance(data["report_id"], int)


def test_submit_incident_report_invalid_type(client):
    """Test submission with an invalid report type returns HTTP 400."""
    payload = {
        "train_number": "12301",
        "report_type": "ALIEN_INVASION",
        "description": "Something invalid",
        "latitude": 26.4499,
        "longitude": 80.3319,
        "user_id": "commuter_442"
    }
    response = client.post("/api/incidents/report", json=payload)
    assert response.status_code == 400
    assert "Invalid report type" in response.json()["detail"]


def test_submit_incident_report_spam_prevention(client):
    """Test spam protection: same user and train within 5 min returns HTTP 429."""
    user_id = "spammer_999"
    payload = {
        "train_number": "12301",
        "report_type": "CHAIN_PULLING",
        "description": "Alarm chain pulled",
        "user_id": user_id
    }
    # First report should succeed
    res1 = client.post("/api/incidents/report", json=payload)
    assert res1.status_code == 200

    # Immediate second report by same user for same train should trigger rate limiting
    res2 = client.post("/api/incidents/report", json=payload)
    assert res2.status_code == 429
    assert "Too many reports" in res2.json()["detail"]


def test_get_train_incidents(client):
    """Test retrieving incidents for a given train number."""
    train_no = "12302"
    payload = {
        "train_number": train_no,
        "report_type": "CATTLE_TRACK",
        "description": "Cattle herd crossing near Mirzapur",
        "latitude": 25.1337,
        "longitude": 82.5644,
        "user_id": "watcher_77"
    }
    submit_res = client.post("/api/incidents/report", json=payload)
    assert submit_res.status_code == 200

    get_res = client.get(f"/api/incidents/train/{train_no}")
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["train_number"] == train_no
    assert isinstance(data["incidents"], list)
    assert len(data["incidents"]) >= 1

    # Verify our submitted report is in the returned list
    matching = [r for r in data["incidents"] if r.get("report_type") == "CATTLE_TRACK"]
    assert len(matching) >= 1
    assert matching[0]["description"] == "Cattle herd crossing near Mirzapur"


def test_root_discovery_contains_incident_endpoints(client):
    """Verify that root discovery endpoint includes incident reporting paths."""
    res = client.get("/")
    assert res.status_code == 200
    endpoints = res.json().get("endpoints", [])
    assert "/api/incidents/report" in endpoints
    assert "/api/incidents/train/{train_number}" in endpoints
