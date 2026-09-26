import sys
from pathlib import Path
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from fastapi.testclient import TestClient
from api.main import app

c = TestClient(app)

def run_checks():
    print("================ RAILSYNC API VERIFICATION ================")
    
    # 1. GET /api/health
    print("\n[1] Testing GET /api/health...")
    r = c.get("/api/health")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    health_data = r.json()
    assert health_data.get("status") == "ok", f"Expected status 'ok', got {health_data.get('status')}"
    print(f"PASS: /api/health -> status: ok | body: {health_data}")

    # 2. GET /api/corridor
    print("\n[2] Testing GET /api/corridor...")
    r = c.get("/api/corridor")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    corridor_data = r.json()
    stations = corridor_data.get("stations", [])
    sections = corridor_data.get("sections", [])
    waypoints = corridor_data.get("detailed_track_geometry", [])

    assert len(stations) == 9, f"Expected 9 stations, got {len(stations)}"
    assert len(sections) == 8, f"Expected 8 sections, got {len(sections)}"
    assert len(waypoints) == 84, f"Expected 84 waypoints, got {len(waypoints)}"

    print(f"PASS: /api/corridor -> {len(stations)} stations, {len(sections)} sections, {len(waypoints)} waypoints.")
    for s in stations:
        assert "platform" in s, f"Station {s.get('code')} missing platform"
        print(f"   Station: {s['code']:5s} | {s['name']:32s} | KM: {s['km']:4d} | Platform: PF {s['platform']}")

    # 3. GET /api/train/12301/state
    print("\n[3] Testing GET /api/train/12301/state...")
    r = c.get("/api/train/12301/state")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    state = r.json()

    pos = state.get("position", {})
    assert "km" in pos, "Missing km in position"
    assert ("speed_kmph" in pos or "speed" in pos), "Missing speed in position"
    assert "delay_min" in pos, "Missing delay_min in position"
    assert "current_section" in pos, "Missing current_section in position"
    assert "current_mps" in pos, "Missing current_mps in position"
    print(f"PASS: Position -> KM: {pos['km']}, Speed: {pos.get('speed_kmph', pos.get('speed'))} km/h, Delay: {pos['delay_min']}m, Section: {pos['current_section']}, MPS: {pos['current_mps']}")

    lt = state.get("leading_train", {})
    assert lt.get("train_no") == "12876", f"Expected 12876, got {lt.get('train_no')}"
    assert "Neelachal Express" in lt.get("name", ""), f"Expected Neelachal Express, got {lt.get('name')}"
    assert "headway_gap_km" in lt, "Missing headway_gap_km in leading_train"
    print(f"PASS: Leading Train -> {lt.get('train_no')} {lt.get('name')}, Headway Gap: {lt.get('headway_gap_km')} km, KM: {lt.get('km')}")

    sig = state.get("signal_aspect", {})
    for k in ["code", "badge", "color", "speed_cap", "headway_gap_km"]:
        assert k in sig, f"Missing {k} in signal_aspect"
    print(f"PASS: Signal Aspect -> Code: {sig['code']}, Badge: {sig['badge']}, Color: {sig['color']}, Speed Cap: {sig['speed_cap']}, Headway: {sig['headway_gap_km']} km")

    upcoming = state.get("upcoming_stations", [])
    assert len(upcoming) > 0, "Expected upcoming stations"
    req_up_fields = [
        "platform", "platform_conflict", "outer_holding_min", "eta_predicted",
        "eta_schedule", "predicted_delay_min", "delay_injected_min",
        "time_deletion_min", "why", "weather_condition", "signal_status"
    ]
    for stn in upcoming:
        for f in req_up_fields:
            assert f in stn, f"Upcoming station {stn.get('code')} missing field '{f}'"
    print(f"PASS: Upcoming stations ({len(upcoming)} stations) verified with all required fields:")
    for stn in upcoming[:3]:
        print(f"   * {stn['code']} (PF {stn['platform']}): Pred ETA={stn['eta_predicted']}, Sched={stn['eta_schedule']}, Pred Delay={stn['predicted_delay_min']}m, Delay Inj={stn['delay_injected_min']}m, Time Del={stn['time_deletion_min']}m, Weather='{stn['weather_condition']}', Signal='{stn['signal_status']}'")
        print(f"     Why: {stn['why']}")

    passed = state.get("passed_stations", [])
    req_passed_fields = ["code", "name", "platform", "actual_arrival", "actual_departure", "exit_delay", "status"]
    for stn in passed:
        for f in req_passed_fields:
            assert f in stn, f"Passed station {stn.get('code')} missing field '{f}'"
    print(f"PASS: Passed stations ({len(passed)} stations) verified with all required fields:")
    for stn in passed:
        print(f"   * {stn['code']} (PF {stn['platform']}): Arr={stn['actual_arrival']}, Dep={stn['actual_departure']}, Exit Delay={stn['exit_delay']}m, Status={stn['status']}")

    # 4. GET /api/operations/inflow?station=NDLS
    print("\n[4] Testing GET /api/operations/inflow?station=NDLS...")
    r = c.get("/api/operations/inflow?station=NDLS")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    inflow_data = r.json()
    assert "inflow_queue" in inflow_data, "Missing inflow_queue"
    assert "platform_occupancy" in inflow_data, "Missing platform_occupancy"
    assert "conflict_status" in inflow_data, "Missing conflict_status"
    assert len(inflow_data["inflow_queue"]) > 0, "Inflow queue should not be empty"
    assert len(inflow_data["platform_occupancy"]) > 0, "Platform occupancy should not be empty"
    assert "has_active_conflict" in inflow_data["conflict_status"], "Missing has_active_conflict"
    print(f"PASS: Inflow -> Queue: {len(inflow_data['inflow_queue'])} trains, Platform Occupancies: {len(inflow_data['platform_occupancy'])}, Active Conflict: {inflow_data['conflict_status']['has_active_conflict']}")
    if inflow_data['conflict_status'].get('conflicts'):
        for conf in inflow_data['conflict_status']['conflicts']:
            print(f"   * Conflict on {conf['platform']}: {conf['incoming_train']} vs {conf['occupying_train']} -> Overlap: {conf['overlap_min']}m. Recommended: {conf['recommended_platform']}")

    # 5. GET /api/telemetry/stream
    print("\n[5] Testing GET /api/telemetry/stream...")
    r = c.get("/api/telemetry/stream")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    telem = r.json()
    packets = telem.get("packets", [])
    assert len(packets) >= 3, f"Expected at least 3 packets, got {len(packets)}"
    subsystems = [p["subsystem"] for p in packets]
    has_rtis = any("RTIS" in s for s in subsystems)
    has_kavach = any("Kavach" in s for s in subsystems)
    has_axle = any("Axle" in s for s in subsystems)
    assert has_rtis, "Missing RTIS packet"
    assert has_kavach, "Missing Kavach packet"
    assert has_axle, "Missing Axle packet"
    print(f"PASS: Telemetry stream returned {len(packets)} packets. Subsystems verified: RTIS ({has_rtis}), Kavach ({has_kavach}), Axle ({has_axle})")
    for p in packets:
        print(f"   * [{p['id']}] Subsystem: {p['subsystem']} | Value: {p['telemetryValue']} | Signal Mile: {p['blockSignalMile']}")

    # 6. GET /app
    print("\n[6] Testing GET /app...")
    r = c.get("/app")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    assert "<html" in r.text.lower() or "<!doctype html>" in r.text.lower(), "Expected HTML response for React app"
    print(f"PASS: /app returned HTTP 200 HTML page ({len(r.text)} bytes).")

    print("\n================ ALL 6 VERIFICATION CHECKS PASSED ================\n")

if __name__ == "__main__":
    run_checks()
