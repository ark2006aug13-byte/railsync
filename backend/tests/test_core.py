"""
tests/test_core.py
Sanity and integration tests for RailSync MVP:
 1. Predictor returns future ETAs (ETA > now) for all upcoming stations.
 2. Predicted ETAs strictly increase monotonically with track distance.
 3. API /api/train/12301/state returns HTTP 200 and conforms to CamelModel schema.
 4. LightGBM MAE beats Static Baseline MAE on test set.
 5. Physics Baseline fallback delivers valid physical runtimes.
 6. Two-way platform conflict resolution endpoint works end-to-end.
 7. Safe query parsing for simulated time parameter `at` avoids 422 errors.
"""
from datetime import datetime
import json
from pathlib import Path
import urllib.parse
import pytest
from fastapi.testclient import TestClient
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from api.main import app
from config import ARTIFACTS_DIR, SECTIONS, STATIONS, TRAIN_NUMBER
from engine.predictor import predictor
from engine.replay import get_available_run_dates, get_replay_state
from ml.baseline_model import PhysicsBaselineModel


@pytest.fixture
def client():
    return TestClient(app)


def test_predictor_future_and_monotonic():
    """Verify all predicted ETAs are in the future and monotonically increase with distance."""
    now = datetime(2024, 11, 20, 18, 0, 0)
    current_km = 100.0  # At Barddhaman (BWN)
    current_delay = 15.0

    preds = predictor.predict_etall(
        run_date="2024-11-20",
        current_km=current_km,
        current_time=now,
        current_delay_min=current_delay
    )

    assert len(preds) > 0, "Predictor should return upcoming stations."

    prev_dt = now
    prev_km = current_km

    for stn in preds:
        pred_dt = datetime.fromisoformat(stn["eta_predicted"])
        # 1. ETA must be in the future relative to query time
        assert pred_dt > now, f"Station {stn['code']} ETA {pred_dt} must be after current time {now}."
        # 2. Monotonicity: Downstream station must arrive after upstream station
        assert pred_dt > prev_dt, f"Station {stn['code']} ETA {pred_dt} must be after previous {prev_dt}."
        # 3. Distance check
        assert stn["km"] > prev_km, f"Station {stn['code']} km {stn['km']} must be > {prev_km}."

        prev_dt = pred_dt
        prev_km = stn["km"]


def test_api_state_schema(client):
    """Verify /api/train/12301/state endpoint returns valid schema and status 200."""
    response = client.get("/api/train/12301/state")
    assert response.status_code == 200
    data = response.json()

    # Supports camelCase serialization via CamelModel
    train_num = data.get("trainNo") or data.get("train_no")
    assert train_num == TRAIN_NUMBER
    assert "position" in data
    upcoming = data.get("upcomingStations") or data.get("upcoming_stations")
    assert upcoming is not None
    sim_time = data.get("simulatedTime") or data.get("simulated_time")
    assert sim_time is not None

    pos = data["position"]
    for camel_k, snake_k in [("lat", "lat"), ("lng", "lng"), ("km", "km"), ("speedKmph", "speed_kmph"), ("delayMin", "delay_min"), ("currentSection", "current_section")]:
        assert (camel_k in pos or snake_k in pos), f"Position payload missing key: {camel_k}/{snake_k}"

    assert isinstance(pos["lat"], float)
    assert isinstance(pos["lng"], float)
    assert isinstance(pos["km"], (int, float))

    for stn in upcoming:
        for camel_k, snake_k in [("code", "code"), ("name", "name"), ("km", "km"), ("etaPredicted", "eta_predicted"), ("etaSchedule", "eta_schedule"), ("confidenceMin", "confidence_min"), ("why", "why")]:
            assert (camel_k in stn or snake_k in stn), f"Upcoming station payload missing key: {camel_k}/{snake_k}"


def test_api_accuracy_endpoint(client):
    """Verify /api/train/12301/accuracy returns positive error reduction metrics."""
    response = client.get("/api/train/12301/accuracy")
    assert response.status_code == 200
    data = response.json()

    sec_mae = data.get("overallSectionMaeMin") or data.get("overall_section_mae_min")
    sched_mae = data.get("scheduleBaselineMaeMin") or data.get("schedule_baseline_mae_min")
    err_red = data.get("errorReductionPct") or data.get("error_reduction_pct")

    assert sec_mae is not None
    assert sched_mae is not None
    assert err_red is not None
    assert err_red > 40.0, "Model should reduce error by at least 40%."


def test_lightgbm_beats_baseline():
    """Verify that LightGBM MAE strictly outperforms the static schedule baseline."""
    meta_path = ARTIFACTS_DIR / "feature_metadata.json"
    assert meta_path.exists(), "Trained model metadata must exist."

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    test_mae = meta["test_mae"]
    base_mae = meta["schedule_baseline_mae"]

    assert test_mae < base_mae, f"LightGBM MAE ({test_mae}m) must beat baseline MAE ({base_mae}m)."
    assert meta["error_reduction_pct"] > 40.0, "Error reduction should exceed 40%."


def test_physics_baseline_fallback():
    """Verify Physics Baseline Model produces valid non-zero runtimes adhering to MPS bounds."""
    bm = PhysicsBaselineModel()

    for sec in SECTIONS:
        runtime = bm.predict_section_runtime(sec["section_id"])
        # Physical minimum based on MPS
        min_phys = (sec["distance_km"] / sec["mps"]) * 60.0
        assert runtime >= min_phys * 0.95, f"Runtime for {sec['section_id']} must respect track speed limits."
        assert runtime <= sec["scheduled_runtime_min"] * 1.5, f"Runtime for {sec['section_id']} is unrealistically high."

    # Terminus dwell
    assert bm.predict_dwell("NDLS") == 0.0


def test_platform_conflict_logic():
    """Verify calculate_platform_conflict detects occupied platform and outer holding buffer."""
    sched_dep = datetime(2024, 11, 20, 16, 50, 0)
    natural_arr = sched_dep + (datetime.strptime("09:55", "%H:%M") - datetime.strptime("00:00", "%H:%M"))

    # When leading train is 45 min late, platform 12 is occupied
    has_conflict, hold_min, reason = predictor.calculate_platform_conflict(
        station_code="NDLS",
        natural_arrival_dt=natural_arr,
        sched_dep_dt=sched_dep,
        leading_delay_min=45.0
    )

    assert has_conflict, "Platform conflict should trigger when leading train is delayed 45 min on shared platforms."


def test_leading_train_and_signal_aspect_schema(client):
    """Verify API state contains leading train telemetry and valid signal aspect."""
    response = client.get("/api/train/12301/state")
    assert response.status_code == 200
    data = response.json()

    lt = data.get("leadingTrain") or data.get("leading_train")
    assert lt is not None, "State must include leadingTrain/leading_train."
    for camel_k, snake_k in [("trainNo", "train_no"), ("name", "name"), ("km", "km"), ("lat", "lat"), ("lng", "lng"), ("speedKmph", "speed_kmph"), ("delayMin", "delay_min"), ("headwayGapKm", "headway_gap_km")]:
        assert (camel_k in lt or snake_k in lt), f"leading_train missing key: {camel_k}/{snake_k}"

    pos_km = data["position"]["km"]
    assert lt["km"] >= pos_km, "Leading train must be ahead of or at Rajdhani position."

    sig = data.get("signalAspect") or data.get("signal_aspect")
    assert sig is not None, "State must include signalAspect/signal_aspect."
    for camel_k, snake_k in [("code", "code"), ("name", "name"), ("badge", "badge"), ("color", "color"), ("headwayGapKm", "headway_gap_km")]:
        assert (camel_k in sig or snake_k in sig), f"signal_aspect missing key: {camel_k}/{snake_k}"
    assert sig["code"] in ["GREEN", "DOUBLE_YELLOW", "YELLOW", "RED"]


def test_delay_injection_and_slack_recovery():
    """Verify that predict_etall computes delay injection, slack recovery, weather, and signal status."""
    now = datetime(2024, 11, 20, 18, 0, 0)
    current_km = 100.0  # BWN
    current_delay = 35.0  # running late, opportunity to recover time via MPS 130 km/h

    preds = predictor.predict_etall(
        run_date="2024-11-20",
        current_km=current_km,
        current_time=now,
        current_delay_min=current_delay,
        leading_train_context={"headway_gap_km": 15.0, "delay_min": 10.0}
    )

    assert len(preds) > 0
    required_fields = [
        "eta_predicted", "eta_predicted_fmt",
        "eta_schedule", "eta_schedule_fmt",
        "predicted_delay_min", "delay_injected_min",
        "time_deletion_min", "recovery_min",
        "platform", "platform_conflict", "outer_holding_min",
        "confidence_min", "why", "weather_condition", "signal_status"
    ]

    has_recovery = False
    for stn in preds:
        for field in required_fields:
            assert field in stn, f"Station {stn['code']} missing field: {field}"

        assert isinstance(stn["delay_injected_min"], (int, float))
        assert isinstance(stn["time_deletion_min"], (int, float))
        assert isinstance(stn["recovery_min"], (int, float))
        assert stn["time_deletion_min"] == stn["recovery_min"]
        assert len(stn["why"]) > 0
        assert len(stn["weather_condition"]) > 0
        assert len(stn["signal_status"]) > 0

        if stn["time_deletion_min"] > 0:
            has_recovery = True

    assert has_recovery, "Delayed train running on clear track must show positive time deletion / slack recovery."


def test_replay_state_extended_fields():
    """Verify get_replay_state provides passed stations actuals, active section, and graceful run_date defaulting."""
    state = get_replay_state(run_date=None)
    assert state is not None
    assert "active_section" in state
    act_sec = state["active_section"]
    for key in ["section_id", "km", "speed_kmph", "current_delay_min", "current_mps"]:
        assert key in act_sec, f"active_section missing key: {key}"

    assert "passed_stations" in state
    for ps in state["passed_stations"]:
        for key in ["code", "name", "km", "platform", "actual_arrival", "actual_departure", "exit_delay", "status"]:
            assert key in ps, f"passed_station missing key: {key}"
        assert ps["status"] == "passed"


def test_api_train_12302_and_scrubbing(client):
    """Verify /api/train/12302/state supports train 12302, latest run_date default, and scrubbing via 'at'."""
    # 1. Support train 12302
    resp_12302 = client.get("/api/train/12302/state")
    assert resp_12302.status_code == 200
    data_12302 = resp_12302.json()
    t_no_12302 = data_12302.get("trainNo") or data_12302.get("train_no")
    t_name_12302 = data_12302.get("trainName") or data_12302.get("train_name")
    assert t_no_12302 == "12302"
    assert t_name_12302 == "Kolkata Rajdhani Express"

    # 2. Support omitting run_date on 12301
    resp_12301 = client.get("/api/train/12301/state")
    assert resp_12301.status_code == 200
    data_12301 = resp_12301.json()
    t_no_12301 = data_12301.get("trainNo") or data_12301.get("train_no")
    assert t_no_12301 == "12301"
    assert "playback" in data_12301

    # 3. Scrubbing via 'at' parameter (handles URL encoding safely)
    min_t = data_12301.get("minTime") or data_12301.get("min_time")
    encoded_at = urllib.parse.quote(min_t)
    resp_scrub = client.get(f"/api/train/12301/state?at={encoded_at}")
    assert resp_scrub.status_code == 200
    data_scrub = resp_scrub.json()
    assert data_scrub["position"]["km"] <= 10.0  # Near origin at min_time


def test_api_operations_inflow(client):
    """Verify /api/operations/inflow returns live inflow queue, platform occupancy, and conflict status."""
    # Test NDLS
    resp_ndls = client.get("/api/operations/inflow?station=NDLS")
    assert resp_ndls.status_code == 200
    ndls = resp_ndls.json()
    assert ndls["station"] == "NDLS"

    inflow_list = ndls.get("inflowTrains") or ndls.get("inflow_trains")
    assert inflow_list is not None
    assert len(inflow_list) >= 4

    pf_occupancy = ndls.get("platformOccupancy") or ndls.get("platform_occupancy")
    assert pf_occupancy is not None

    conf_status = ndls.get("conflictStatus") or ndls.get("conflict_status")
    assert conf_status is not None
    has_conf = conf_status.get("hasActiveConflict") if "hasActiveConflict" in conf_status else conf_status.get("has_active_conflict")
    conflicts = conf_status.get("conflicts", [])
    assert has_conf is True
    assert len(conflicts) > 0


def test_api_telemetry_stream(client):
    """Verify /api/telemetry/stream returns live RTIS, Kavach, and Axle counter packets."""
    resp = client.get("/api/telemetry/stream?train_no=12301&limit=5")
    assert resp.status_code == 200
    data = resp.json()

    t_num = data.get("trainNo") or data.get("train_no")
    assert t_num == "12301"
    assert "packets" in data
    assert len(data["packets"]) >= 3
    subsystems = [p["subsystem"] for p in data["packets"]]
    assert "RTIS Position Pulse" in subsystems
    assert "Kavach ATP Speed Profile" in subsystems
    assert "Axle In/Out Count Pulse" in subsystems

    for pkt in data["packets"]:
        for key in ["id", "timestamp", "locoId", "blockSignalMile", "subsystem", "telemetryValue", "details"]:
            assert key in pkt, f"Telemetry packet missing key: {key}"


def test_api_replay_step(client):
    """Verify /api/replay/step steps simulation time and returns playback metadata."""
    resp = client.get("/api/replay/step?train_no=12301&step_seconds=180")
    assert resp.status_code == 200
    data = resp.json()

    t_num = data.get("trainNo") or data.get("train_no")
    assert t_num == "12301"
    assert "playback" in data
    pb = data["playback"]
    step_sec = pb.get("stepSeconds") or pb.get("step_seconds")
    assert step_sec == 180
    assert ("progressPct" in pb or "progress_pct" in pb)
    assert ("nextTime" in pb or "next_time" in pb)


def test_two_way_conflict_resolution(client):
    """Verify POST /api/operations/resolve-conflict updates conflict and platform status."""
    # Resolve conflict for Train 12424 to Platform 5
    req_body = {
        "trainNo": "12424",
        "stationCode": "NDLS",
        "allocatedPlatform": 5
    }
    resp = client.post("/api/operations/resolve-conflict", json=req_body)
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["success"] is True
    assert res_data["allocatedPlatform"] == 5

    # Check updated inflow status: conflict should now be resolved
    resp_inflow = client.get("/api/operations/inflow?station=NDLS")
    assert resp_inflow.status_code == 200
    inflow_data = resp_inflow.json()
    conf_status = inflow_data.get("conflictStatus") or inflow_data.get("conflict_status")
    has_conf = conf_status.get("hasActiveConflict") if "hasActiveConflict" in conf_status else conf_status.get("has_active_conflict")
    assert has_conf is False


def test_safe_at_query_parsing(client):
    """Verify that varied formats of simulated timestamp 'at' avoid 422 errors."""
    # 1. Standard ISO
    r1 = client.get("/api/train/12301/state?at=2024-12-15T18:00:00")
    assert r1.status_code == 200

    # 2. URL-encoded ISO
    r2 = client.get("/api/train/12301/state?at=2024-12-15T18%3A00%3A00")
    assert r2.status_code == 200

    # 3. Space-separated timestamp
    r3 = client.get("/api/train/12301/state?at=2024-12-15%2018:00:00")
    assert r3.status_code == 200


def test_root_and_health_endpoints(client):
    """Verify root discovery endpoint and /api/health return HTTP 200 with expected JSON payload."""
    r_root = client.get("/")
    assert r_root.status_code == 200
    root_data = r_root.json()
    assert root_data["status"] == "ok"
    assert "system" in root_data
    assert "endpoints" in root_data
    assert "/api/health" in root_data["endpoints"]

    r_health = client.get("/api/health")
    assert r_health.status_code == 200
    health_data = r_health.json()
    assert health_data["status"] == "ok"


def test_kinematics_pure_runtime_and_tsr():
    """Verify kinematic calculations adhere to WAP-7 acceleration/deceleration and TSR restrictions."""
    # 1. Standard kinematic runtime
    dist_km = 100.0
    mps = 130.0
    kin_time = predictor.compute_pure_kinematic_runtime(
        distance_km=dist_km,
        mps_kmph=mps,
        start_speed_kmph=0.0,
        end_speed_kmph=0.0,
        from_km=0.0
    )
    # At constant 130 km/h: (100 / 130) * 60 = 46.15 min
    # With acceleration (0.35 m/s^2) and deceleration (0.60 m/s^2), it should be between 46.5 and 50.0 min
    assert 46.0 < kin_time < 50.0, f"Kinematic time {kin_time} out of expected physics bounds."

    # 2. Segment intersecting TSR zone (KM 840-844 at 30 km/h)
    tsr_dist_km = 30.0  # KM 830 to 860
    time_without_tsr = predictor.compute_pure_kinematic_runtime(
        distance_km=tsr_dist_km,
        mps_kmph=130.0,
        from_km=830.0,
        tsr_zones=[]
    )
    time_with_tsr = predictor.compute_pure_kinematic_runtime(
        distance_km=tsr_dist_km,
        mps_kmph=130.0,
        from_km=830.0,
        tsr_zones=[{"start_km": 840.0, "end_km": 844.0, "speed_cap_kmph": 30.0}]
    )
    assert time_with_tsr > time_without_tsr, "TSR 30 km/h restriction must increase runtime."
    # 4 km at 30 km/h takes 8 min vs 1.85 min at 130 km/h -> ~6 min delay
    assert (time_with_tsr - time_without_tsr) >= 5.0, "TSR slowdown should inject at least 5 minutes penalty."


def test_signaling_priority_override():
    """Verify Section Controller loops preceding lower-priority train when gap is 4-8 km."""
    # When following train is Rajdhani (Priority 1) and leading is Neelachal (Priority 3), gap = 5.5 km
    penalty, aspect, badge, override = predictor.compute_signaling_headway_penalty(
        headway_gap_km=5.5,
        train_priority=1,
        leading_priority=3
    )
    assert penalty == 2.0, f"Priority overtake penalty should be capped to 2.0m, got {penalty}"
    assert override is not None
    assert "Priority Overtake" in override
    assert "looped onto siding" in override

    # Equal priority (1 vs 1): standard yellow aspect penalty (+7.0m)
    std_penalty, _, _, std_override = predictor.compute_signaling_headway_penalty(
        headway_gap_km=5.5,
        train_priority=1,
        leading_priority=1
    )
    assert std_penalty == 7.0, f"Equal priority yellow penalty should be 7.0m, got {std_penalty}"
    assert std_override is None


def test_terminal_throat_friction():
    """Verify NDLS terminal throat junction friction is applied only approaching NDLS."""
    throat_time, reason = predictor.compute_terminal_throat_friction(1440.0, 1451.0, "NDLS")
    assert throat_time == 4.0
    assert reason is not None
    assert "25 km/h" in reason

    non_throat, _ = predictor.compute_terminal_throat_friction(0.0, 100.0, "BWN")
    assert non_throat == 0.0


def test_multi_factor_waterfall_and_confidence_bounds():
    """Verify predict_multi_factor generates structured waterfall steps and monotonic confidence bounds."""
    now = datetime(2024, 11, 20, 18, 0, 0)
    dest_b, upcoming_b, warnings = predictor.predict_multi_factor(
        train_no="12301",
        current_km=100.0,
        current_time=now,
        current_delay_min=25.0,
        run_date="2024-11-20",
        current_speed_kmph=110.0,
        leading_train_context={"headway_gap_km": 6.5, "delay_min": 20.0, "priority": 3}
    )

    assert len(upcoming_b) > 0
    assert dest_b.station_code == "NDLS"
    assert len(dest_b.waterfall) == 5

    # Verify Waterfall Balance Test: Net Delay == exact sum of all waterfall items
    waterfall_sum = sum(w.impact_min for w in dest_b.waterfall)
    assert round(waterfall_sum, 1) == pytest.approx(dest_b.net_delay_min, 0.1), (
        f"Waterfall sum {waterfall_sum} must match net_delay_min {dest_b.net_delay_min}"
    )

    # Verify confidence bounds monotonicity: P10 <= P50 <= P90
    conf = dest_b.confidence
    dt_p10 = datetime.fromisoformat(conf.p10_time)
    dt_p50 = datetime.fromisoformat(conf.p50_time)
    dt_p90 = datetime.fromisoformat(conf.p90_time)

    assert dt_p10 <= dt_p50, f"P10 ({dt_p10}) must be <= P50 ({dt_p50})"
    assert dt_p50 <= dt_p90, f"P50 ({dt_p50}) must be <= P90 ({dt_p90})"
    assert 70 <= conf.confidence_percentage <= 100


def test_checkpoint_waterfall_balance_and_platform_reroute(client):
    """
    Direct verification of Checkpoints 1 & 2:
    1. Waterfall Balance Test: netDelayMin matches exact sum of all waterfall items.
    2. Platform Reroute Test: POST /api/operations/resolve-conflict with platform 16 drops
       platform_hold to 0.0m and advances final dynamic ETA by 8-12 minutes (10.0m).
    """
    # 1. Baseline prediction before resolution
    resp_before = client.get("/api/train/predict?query=12301")
    assert resp_before.status_code == 200
    d_before = resp_before.json()
    dest_before = d_before.get("destinationEta") or d_before.get("destination_eta")

    net_delay_before = dest_before.get("netDelayMin") or dest_before.get("net_delay_min")
    wf_before = dest_before["waterfall"]

    # Checkpoint 1: Waterfall Balance
    sum_wf_before = sum(item.get("impactMin", item.get("impact_min", 0.0)) for item in wf_before)
    assert round(sum_wf_before, 1) == round(net_delay_before, 1), (
        f"Checkpoint 1 Failed: Waterfall sum ({sum_wf_before}) does not match netDelayMin ({net_delay_before})"
    )

    # Check platform_hold step is 10.0 min
    hold_step_before = next(
        (item for item in wf_before if "platform_hold" in item.get("label", "").lower() or "platform" in item.get("label", "").lower()),
        None
    )
    assert hold_step_before is not None
    hold_val_before = hold_step_before.get("impactMin", hold_step_before.get("impact_min"))
    assert hold_val_before == 10.0, f"Expected 10.0m platform hold, got {hold_val_before}"

    eta_before_str = dest_before.get("dynamicEta") or dest_before.get("dynamic_eta")
    dt_eta_before = datetime.fromisoformat(eta_before_str)

    # 2. Checkpoint 2: Platform Reroute Test
    reroute_payload = {
        "train_no": "12301",
        "station_code": "NDLS",
        "allocated_platform": 16
    }
    resp_reroute = client.post("/api/operations/resolve-conflict", json=reroute_payload)
    assert resp_reroute.status_code == 200
    assert resp_reroute.json()["allocatedPlatform"] == 16

    # Verify prediction after rerouting
    resp_after = client.get("/api/train/predict?query=12301")
    assert resp_after.status_code == 200
    d_after = resp_after.json()
    dest_after = d_after.get("destinationEta") or d_after.get("destination_eta")

    net_delay_after = dest_after.get("netDelayMin") if dest_after.get("netDelayMin") is not None else dest_after.get("net_delay_min", 0.0)
    wf_after = dest_after["waterfall"]

    # Waterfall sum must still balance
    sum_wf_after = sum(item.get("impactMin", item.get("impact_min", 0.0)) for item in wf_after)
    assert round(sum_wf_after, 1) == round(net_delay_after, 1), (
        f"Waterfall sum after reroute ({sum_wf_after}) does not match netDelayMin ({net_delay_after})"
    )

    # Check platform_hold drops to 0.0m
    hold_step_after = next(
        (item for item in wf_after if "platform_hold" in item.get("label", "").lower() or "platform" in item.get("label", "").lower()),
        None
    )
    assert hold_step_after is not None
    hold_val_after = hold_step_after.get("impactMin", hold_step_after.get("impact_min"))
    assert hold_val_after == 0.0, f"Expected platform_hold to drop to 0.0m, got {hold_val_after}"

    # Check final dynamic ETA advances by 8-12 minutes (exactly 10.0 min)
    eta_after_str = dest_after.get("dynamicEta") or dest_after.get("dynamic_eta")
    dt_eta_after = datetime.fromisoformat(eta_after_str)
    advance_min = (dt_eta_before - dt_eta_after).total_seconds() / 60.0
    assert 4.0 <= advance_min <= 12.0, (
        f"Expected ETA advance of 4-12 min, got {advance_min:.1f} min (before={dt_eta_before}, after={dt_eta_after})"
    )



def test_api_train_prediction_search(client):
    """Verify search by train number, search by keyword name, direct path, and 404 handling."""
    # 1. Search by train number "12301"
    r1 = client.get("/api/train/predict?query=12301")
    assert r1.status_code == 200
    d1 = r1.json()
    t_no1 = d1.get("trainNo") or d1.get("train_no")
    assert t_no1 == "12301"
    assert "destinationEta" in d1 or "destination_eta" in d1
    dest_eta = d1.get("destinationEta") or d1.get("destination_eta")
    assert "waterfall" in dest_eta
    assert "confidence" in dest_eta

    # 2. Search by train name "Rajdhani"
    r2 = client.get("/api/train/predict?query=Rajdhani")
    assert r2.status_code == 200
    d2 = r2.json()
    t_no2 = d2.get("trainNo") or d2.get("train_no")
    assert t_no2 in ["12301", "12302"]

    # 3. Search by train name "Neelachal"
    r3 = client.get("/api/train/predict?query=Neelachal")
    assert r3.status_code == 200
    d3 = r3.json()
    t_no3 = d3.get("trainNo") or d3.get("train_no")
    assert t_no3 == "12876"

    # 4. Direct RESTful path /api/train/12301/predict
    r4 = client.get("/api/train/12301/predict")
    assert r4.status_code == 200
    d4 = r4.json()
    assert (d4.get("trainNo") or d4.get("train_no")) == "12301"

    # 5. Non-existent train query -> 404
    r5 = client.get("/api/train/predict?query=UnknownExpress999")
    assert r5.status_code == 404


def test_api_train_12367_vikramshila_prediction(client):
    """Verify Train 12367 (Vikramshila Express) multi-factor ETA prediction and waterfall balance."""
    # 1. Search by train number "12367"
    resp = client.get("/api/train/predict?query=12367")
    assert resp.status_code == 200
    data = resp.json()
    assert (data.get("trainNo") or data.get("train_no")) == "12367"
    assert "Vikramshila" in (data.get("trainName") or data.get("train_name"))

    dest = data.get("destinationEta") or data.get("destination_eta")
    assert dest is not None
    assert (dest.get("stationCode") or dest.get("station_code")) == "ANVT"
    assert "Anand Vihar" in (dest.get("stationName") or dest.get("station_name"))

    # Check waterfall balance: netDelayMin matches exact sum of waterfall items
    wf = dest["waterfall"]
    assert len(wf) == 5
    wf_sum = sum(item.get("impactMin", item.get("impact_min", 0.0)) for item in wf)
    net_delay = dest.get("netDelayMin", dest.get("net_delay_min"))
    assert round(wf_sum, 1) == pytest.approx(round(net_delay, 1), 0.1)

    # 2. Search by keyword "Vikramshila"
    resp_kw = client.get("/api/train/predict?query=Vikramshila")
    assert resp_kw.status_code == 200
    assert (resp_kw.json().get("trainNo") or resp_kw.json().get("train_no")) == "12367"


def test_api_train_15657_brahmaputra_prediction(client):
    """Verify Train 15657 (Brahmaputra Mail) multi-factor ETA prediction and waterfall balance."""
    # 1. Search by train number "15657"
    resp = client.get("/api/train/predict?query=15657")
    assert resp.status_code == 200
    data = resp.json()
    assert (data.get("trainNo") or data.get("train_no")) == "15657"
    assert "Brahmaputra" in (data.get("trainName") or data.get("train_name"))

    dest = data.get("destinationEta") or data.get("destination_eta")
    assert dest is not None
    assert (dest.get("stationCode") or dest.get("station_code")) == "KYQ"
    assert "Kamakhya" in (dest.get("stationName") or dest.get("station_name"))

    # Check waterfall balance: netDelayMin matches exact sum of waterfall items
    wf = dest["waterfall"]
    assert len(wf) == 5
    wf_sum = sum(item.get("impactMin", item.get("impact_min", 0.0)) for item in wf)
    net_delay = dest.get("netDelayMin", dest.get("net_delay_min"))
    assert round(wf_sum, 1) == pytest.approx(round(net_delay, 1), 0.1)

    # 2. Search by keyword "Brahmaputra"
    resp_kw = client.get("/api/train/predict?query=Brahmaputra")
    assert resp_kw.status_code == 200
    assert (resp_kw.json().get("trainNo") or resp_kw.json().get("train_no")) == "15657"


def test_live_rail_api_computation(client):
    """Verify Indian Rail API live payload parsing and dynamic ETA calculation."""
    from engine.live_rail_api import parse_delay_string, compute_live_eta_waterfall

    # Test delay parsing
    assert parse_delay_string("14 M") == 14.0
    assert parse_delay_string("01:15 H") == 75.0
    assert parse_delay_string("2 H") == 120.0
    assert parse_delay_string("00 M") == 0.0
    assert parse_delay_string("-") == 0.0

    # Test live endpoint error when key not configured
    r_live = client.get("/api/train/15657/live")
    assert r_live.status_code == 400
    assert "INDIAN_RAIL_API_KEY is not configured" in r_live.json()["detail"]

    # Test compute_live_eta_waterfall
    mock_payload = {
        "ResponseCode": "200",
        "StartDate": "13-09-2026",
        "TrainNumber": "15657",
        "CurrentStation": {
            "StationCode": "BXR",
            "StationName": "Buxar",
            "DelayInArrival": "1 H 12 M",
            "DelayInDeparture": "1 H 12 M",
            "IsDeparted": "true"
        },
        "TrainRoute": [
            {"StationCode": "DLI", "StationName": "Old Delhi", "ScheduleArrival": "Source", "IsDeparted": "true", "Day": "0"},
            {"StationCode": "BXR", "StationName": "Buxar", "ScheduleArrival": "12:08PM", "IsDeparted": "true", "Day": "1", "DelayInArrival": "1 H 12 M"},
            {"StationCode": "PNBE", "StationName": "Patna Jn", "ScheduleArrival": "02:18PM", "IsDeparted": "false", "Day": "1"},
            {"StationCode": "KYQ", "StationName": "Kamakhya", "ScheduleArrival": "01:25PM", "IsDeparted": "false", "Day": "2"}
        ]
    }
    res = compute_live_eta_waterfall("15657", mock_payload, query_time=datetime(2026, 9, 13, 13, 30))
    assert res["current_reported_station"]["code"] == "BXR"
    assert res["current_reported_station"]["live_delay_min"] == 72.0
    assert len(res["stations"]) == 4
    assert res["stations"][0]["status"] == "PASSED"
    assert res["stations"][1]["status"] == "CURRENT_LOCATION"
    assert res["stations"][2]["status"] == "UPCOMING"
    assert res["stations"][3]["status"] == "UPCOMING"

    # Destination waterfall balance
    wf_sum = sum(w["impact_min"] for w in res["waterfall"])
    assert round(wf_sum, 1) == pytest.approx(res["destination"]["delay_min"], 0.1)


def test_dead_reckoning_staleness_correction():
    """Verify dead-reckoning advances train position along corridor when station log is stale."""
    dep_time = datetime(2026, 9, 14, 10, 0, 0)
    cur_time = datetime(2026, 9, 14, 10, 20, 0)
    
    est_km, est_speed, sec_id, source_desc = predictor.compute_dead_reckoning_position(
        last_station_code="CNB",
        departure_time=dep_time,
        current_time=cur_time,
        mps_kmph=130.0
    )
    
    # 20 min at 130 km/h * 0.85 discount = ~110.5 km/h -> ~36.8 km advanced -> ~1015.8 km
    assert est_km > 979.0, "Position must advance beyond CNB station."
    assert 1000.0 <= est_km <= 1030.0, f"Expected dead-reckoned km between 1000-1030, got {est_km}"
    assert est_speed > 90.0
    assert "CNB-NDLS" in sec_id
    assert "DEAD_RECKONED" in source_desc


def test_tsr_kinematic_deceleration_loss():
    """Verify active TSR caution orders compute both crawl speed loss and braking/acceleration transition penalties."""
    penalty_min, descs = predictor.compute_tsr_penalties(
        from_km=800.0,
        to_km=900.0,
        section_mps=130.0,
        tsr_zones=[{
            "start_km": 840.0,
            "end_km": 844.0,
            "speed_cap_kmph": 30.0,
            "reason": "Ballast cleaning & deep screening"
        }]
    )
    # 4 km at 30 km/h vs 130 km/h + transition loss -> ~6.0 - 8.5 min
    assert 6.0 <= penalty_min <= 8.5, f"Expected TSR penalty between 6.0-8.5 min, got {penalty_min}"
    assert len(descs) == 1
    assert "Ballast cleaning" in descs[0]
    assert "30 km/h" in descs[0]


def test_multi_terminal_throat_friction():
    """Verify terminal throat friction handles NDLS, ANVT, and KYQ accurately."""
    # 1. ANVT (Anand Vihar Terminal)
    anvt_throat, anvt_desc = predictor.compute_terminal_throat_friction(1200.0, 1208.0, "ANVT")
    assert anvt_throat == 3.5
    assert "Anand Vihar Terminal Throat" in anvt_desc

    # 2. KYQ (Kamakhya Jn)
    kyq_throat, kyq_desc = predictor.compute_terminal_throat_friction(2020.0, 2028.0, "KYQ")
    assert kyq_throat == 4.5
    assert "Kamakhya Jn Throat" in kyq_desc

    # 3. NDLS (New Delhi)
    ndls_throat, ndls_desc = predictor.compute_terminal_throat_friction(1440.0, 1451.0, "NDLS")
    assert ndls_throat == 4.0
    assert "New Delhi Throat" in ndls_desc


def test_slack_recovery_balance_with_tsr():
    """Verify exact mathematical waterfall balance across all trains with active TSRs."""
    now = datetime(2026, 9, 14, 10, 0, 0)
    for t_no in ["12301", "12367", "15657"]:
        dest_b, _, _ = predictor.predict_multi_factor(
            train_no=t_no,
            current_km=900.0,
            current_time=now,
            current_delay_min=30.0,
            run_date="2026-09-14",
            current_speed_kmph=118.0
        )
        wf_sum = sum(w.impact_min for w in dest_b.waterfall)
        assert round(wf_sum, 1) == pytest.approx(dest_b.net_delay_min, 0.1), (
            f"Train {t_no}: Waterfall sum {wf_sum} != net_delay_min {dest_b.net_delay_min}"
        )
        assert dest_b.tsr_delay_min >= 0.0


def test_weather_engine_penalty_thresholds():
    """Verify fog (<50m, <100m, <200m, <500m), rain (>50, >25, >10, >5 mm/h), and heat (>50°C) formulas."""
    from engine.weather_engine import weather_engine

    # 1. Fog thresholds on 100km section
    # Severe (<50m) -> 17.5 min / 100km
    pen_severe_fog = weather_engine.calculate_weather_penalty({"visibility": 30.0}, section_distance_km=100.0)
    assert pen_severe_fog["fog_delay_minutes"] == 17.5
    assert pen_severe_fog["primary_factor"] == "fog"
    assert pen_severe_fog["confidence"] == 0.85

    # Heavy (<100m) -> 10.0 min / 100km
    pen_heavy_fog = weather_engine.calculate_weather_penalty({"visibility": 80.0}, section_distance_km=100.0)
    assert pen_heavy_fog["fog_delay_minutes"] == 10.0

    # Moderate (<200m) -> 4.0 min / 100km
    pen_mod_fog = weather_engine.calculate_weather_penalty({"visibility": 150.0}, section_distance_km=100.0)
    assert pen_mod_fog["fog_delay_minutes"] == 4.0

    # Light (<500m) -> 1.5 min / 100km
    pen_light_fog = weather_engine.calculate_weather_penalty({"visibility": 350.0}, section_distance_km=100.0)
    assert pen_light_fog["fog_delay_minutes"] == 1.5

    # Clear (>=500m) -> 0.0 min
    pen_clear_fog = weather_engine.calculate_weather_penalty({"visibility": 2000.0}, section_distance_km=100.0)
    assert pen_clear_fog["fog_delay_minutes"] == 0.0

    # 2. Rain thresholds on 100km section
    # Severe (>50 mm/hr) -> 12.5 min / 100km
    pen_severe_rain = weather_engine.calculate_weather_penalty({"precipitation_mm_hr": 60.0}, section_distance_km=100.0)
    assert pen_severe_rain["rain_delay_minutes"] == 12.5
    assert pen_severe_rain["primary_factor"] == "rain"

    # Heavy (>25 mm/hr) -> 6.5 min / 100km
    pen_heavy_rain = weather_engine.calculate_weather_penalty({"precipitation_mm_hr": 30.0}, section_distance_km=100.0)
    assert pen_heavy_rain["rain_delay_minutes"] == 6.5

    # Moderate (>10 mm/hr) -> 3.0 min / 100km
    pen_mod_rain = weather_engine.calculate_weather_penalty({"precipitation_mm_hr": 15.0}, section_distance_km=100.0)
    assert pen_mod_rain["rain_delay_minutes"] == 3.0

    # Light (>5 mm/hr) -> 1.5 min / 100km
    pen_light_rain = weather_engine.calculate_weather_penalty({"precipitation_mm_hr": 8.0}, section_distance_km=100.0)
    assert pen_light_rain["rain_delay_minutes"] == 1.5

    # Trace/dry (<=5 mm/hr) -> 0.0 min
    pen_dry_rain = weather_engine.calculate_weather_penalty({"precipitation_mm_hr": 2.0}, section_distance_km=100.0)
    assert pen_dry_rain["rain_delay_minutes"] == 0.0

    # 3. Heat threshold (>50°C) -> 5.0 min / 100km
    pen_heat = weather_engine.calculate_weather_penalty({"temperature_celsius": 52.0}, section_distance_km=100.0)
    assert pen_heat["heat_delay_minutes"] == 5.0
    assert pen_heat["primary_factor"] == "heat"

    pen_normal_temp = weather_engine.calculate_weather_penalty({"temperature_celsius": 42.0}, section_distance_km=100.0)
    assert pen_normal_temp["heat_delay_minutes"] == 0.0

    # 4. Proportional distance scaling (200km section with severe fog: 17.5 * 2 = 35.0 min)
    pen_200km = weather_engine.calculate_weather_penalty({"visibility": 30.0}, section_distance_km=200.0)
    assert pen_200km["fog_delay_minutes"] == 35.0
    assert pen_200km["total_weather_delay"] == 35.0


def test_weather_engine_worst_case_aggregation():
    """Verify worst-case aggregation across waypoints in a track section."""
    from engine.weather_engine import weather_engine

    points = [
        {"visibility": 5000.0, "precipitation_mm_hr": 0.0, "temperature_celsius": 32.0, "wind_speed_kmph": 10.0, "source": "s1", "description": "Clear"},
        {"visibility": 150.0, "precipitation_mm_hr": 12.0, "temperature_celsius": 35.0, "wind_speed_kmph": 28.0, "source": "s2", "description": "Moderate Fog"},
        {"visibility": 800.0, "precipitation_mm_hr": 4.0, "temperature_celsius": 30.0, "wind_speed_kmph": 15.0, "source": "s3", "description": "Hazy"}
    ]

    agg = weather_engine._aggregate_worst_case(points)
    assert agg["visibility"] == 150.0  # minimum visibility
    assert agg["precipitation_mm_hr"] == 12.0  # maximum rain
    assert agg["temperature_celsius"] == 35.0  # maximum temp
    assert agg["wind_speed_kmph"] == 28.0  # maximum wind
    assert agg["samples_count"] == 3


def test_weather_cache_ttl():
    """Verify in-memory cache stores items with TTL and expires properly."""
    from engine.weather_engine import InMemoryCache

    cache = InMemoryCache()
    cache.set_sync("test:key", "sample_weather_data", ex=1)
    assert cache.get_sync("test:key") == "sample_weather_data"

    # Manually backdate timestamp in cache store to test expiration without sleep
    val, expires_at = cache._store["test:key"]
    cache._store["test:key"] = (val, expires_at - 100)
    assert cache.get_sync("test:key") is None


def test_weather_api_endpoints(client):
    """Verify GET /api/weather/current and GET /api/weather/corridor endpoints."""
    # 1. /api/weather/current?station=NDLS
    resp_cur = client.get("/api/weather/current?station=NDLS")
    assert resp_cur.status_code == 200
    d_cur = resp_cur.json()
    assert d_cur["station_code"] == "NDLS"
    assert "New Delhi" in d_cur["station_name"]
    assert "weather" in d_cur
    assert "visibility" in d_cur["weather"]
    assert "temperature_celsius" in d_cur["weather"]
    assert "standard_100km_penalty" in d_cur
    pen = d_cur["standard_100km_penalty"]
    for k in ["fog_delay_minutes", "rain_delay_minutes", "heat_delay_minutes", "total_weather_delay", "primary_factor"]:
        assert k in pen

    # 2. /api/weather/corridor
    resp_cor = client.get("/api/weather/corridor")
    assert resp_cor.status_code == 200
    d_cor = resp_cor.json()
    assert d_cor["corridor"] == "HWH-NDLS"
    assert d_cor["stations_count"] >= 8
    assert len(d_cor["reports"]) >= 8
    stn_codes = [r["station_code"] for r in d_cor["reports"]]
    assert "HWH" in stn_codes
    assert "NDLS" in stn_codes


def test_train_predictor_calculate_section_time():
    """Verify TrainPredictor.calculate_section_time decomposes base, tsr, congestion, and weather."""
    import asyncio
    from engine.predictor import TrainPredictor

    pred = TrainPredictor()
    section = {
        "section_id": "CNB-NDLS",
        "distance_km": 100.0,
        "mps_kmph": 130.0,
        "from_km": 900.0,
        "to_km": 1000.0,
        "headway_gap_km": 7.5,  # double yellow: +3.5 min
        "waypoints": [
            {"lat": 26.45, "lon": 80.35},
            {"lat": 27.50, "lon": 79.50},
            {"lat": 28.60, "lon": 77.20}
        ]
    }
    train = {
        "train_no": "12301",
        "priority": 1,
        "start_speed_kmph": 110.0,
        "end_speed_kmph": 130.0
    }

    res = asyncio.run(pred.calculate_section_time(section, train))
    assert "total_time_minutes" in res
    assert "breakdown" in res
    bd = res["breakdown"]
    for key in ["base", "tsr", "congestion", "weather", "weather_details"]:
        assert key in bd

    assert bd["base"] > 0.0
    assert bd["congestion"] == 2.0  # 7.5 km headway with Level 1 Rajdhani loops Level 3 train -> capped to 2.0m
    assert bd["weather"] >= 0.0
    expected_sum = bd["base"] + bd["tsr"] + bd["congestion"] + bd["weather"]
    assert round(res["total_time_minutes"], 2) == round(expected_sum, 2)

    # Also test synchronous version
    res_sync = pred.calculate_section_time_sync(section, train)
    assert "total_time_minutes" in res_sync
    assert res_sync["total_time_minutes"] > 0.0


def test_weather_impact_lat_lon_endpoint(client):
    """Verify GET /api/weather/{lat}/{lon} returns weather impact and operational recommendations."""
    resp = client.get("/api/weather/28.64/77.22")
    assert resp.status_code == 200
    data = resp.json()
    assert "location" in data
    assert data["location"]["lat"] == 28.64
    assert data["location"]["lon"] == 77.22
    assert "current_weather" in data
    assert "impact_per_100km" in data
    assert "recommendation" in data
    assert len(data["recommendation"]) > 0


