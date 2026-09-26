"""
engine/replay.py
Replay simulation engine that queries stored position snapshots for a given run_date,
interpolates smooth real-time telemetry at any simulated timestamp t,
and attaches dynamic downstream ETA forecasts from ETAPredictor.
"""
from datetime import datetime, timedelta
from pathlib import Path
import sqlite3
from typing import Dict, Any, Optional, List
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import (
    DB_PATH,
    HEADWAY_THRESHOLDS,
    LEADING_TRAIN_CONFIG,
    SCHEDULED_TIMELINE,
    SECTION_MAP,
    SECTIONS,
    STATION_MAP,
    STATIONS,
    TRAIN_NAME,
    TRAIN_NUMBER,
    get_coords_at_km,
)
from engine.predictor import predictor


def get_available_run_dates() -> List[str]:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT run_date FROM runs ORDER BY run_date ASC")
    dates = [r[0] for r in cursor.fetchall()]
    conn.close()
    return dates


def get_replay_bounds(run_date: str) -> tuple:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT MIN(ts), MAX(ts) FROM position_snapshots WHERE run_date = ?",
        (run_date,)
    )
    row = cursor.fetchone()
    conn.close()
    return row[0], row[1]


def get_replay_state(run_date: Optional[str] = None, at_time_iso: Optional[str] = None) -> Dict[str, Any]:
    available_dates = get_available_run_dates()
    if not available_dates:
        raise ValueError("No historical run data found in database")

    if not run_date or run_date not in available_dates:
        run_date = available_dates[-1]

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get bounds for this run
    cursor.execute(
        "SELECT MIN(ts), MAX(ts) FROM position_snapshots WHERE run_date = ?",
        (run_date,)
    )
    bounds = cursor.fetchone()
    min_ts, max_ts = bounds[0], bounds[1]

    if not min_ts:
        conn.close()
        raise ValueError(f"No run data found for run_date={run_date}")

    if not at_time_iso:
        at_time_iso = min_ts

    clean_at = at_time_iso.rstrip("Z")
    clean_min = min_ts.rstrip("Z")
    clean_max = max_ts.rstrip("Z")

    # Clamp requested timestamp within bounds
    target_dt = datetime.fromisoformat(clean_at)
    min_dt = datetime.fromisoformat(clean_min)
    max_dt = datetime.fromisoformat(clean_max)

    if target_dt < min_dt:
        target_dt = min_dt
    elif target_dt > max_dt:
        target_dt = max_dt

    target_ts = target_dt.isoformat()

    # Fetch snapshot immediately <= target_ts
    cursor.execute(
        """SELECT ts, km_position, speed_kmph, delay_min, current_section, lat, lng
           FROM position_snapshots
           WHERE run_date = ? AND ts <= ?
           ORDER BY ts DESC LIMIT 1""",
        (run_date, target_ts)
    )
    prev_row = cursor.fetchone()

    # Fetch snapshot immediately > target_ts
    cursor.execute(
        """SELECT ts, km_position, speed_kmph, delay_min, current_section, lat, lng
           FROM position_snapshots
           WHERE run_date = ? AND ts > ?
           ORDER BY ts ASC LIMIT 1""",
        (run_date, target_ts)
    )
    next_row = cursor.fetchone()

    # Interpolate position
    if prev_row and next_row:
        t0 = datetime.fromisoformat(prev_row[0].rstrip("Z"))
        t1 = datetime.fromisoformat(next_row[0].rstrip("Z"))
        total_sec = (t1 - t0).total_seconds()
        alpha = (target_dt - t0).total_seconds() / total_sec if total_sec > 0 else 0.0
        alpha = max(0.0, min(1.0, alpha))

        cur_km = round(prev_row[1] + (next_row[1] - prev_row[1]) * alpha, 2)
        cur_speed = round(prev_row[2] + (next_row[2] - prev_row[2]) * alpha, 1)
        cur_delay = round(prev_row[3] + (next_row[3] - prev_row[3]) * alpha, 1)
        cur_lat = round(prev_row[5] + (next_row[5] - prev_row[5]) * alpha, 5)
        cur_lng = round(prev_row[6] + (next_row[6] - prev_row[6]) * alpha, 5)
        cur_section = prev_row[4]
    elif prev_row:
        cur_km = prev_row[1]
        cur_speed = prev_row[2]
        cur_delay = prev_row[3]
        cur_section = prev_row[4]
        cur_lat = prev_row[5]
        cur_lng = prev_row[6]
    elif next_row:
        cur_km = next_row[1]
        cur_speed = next_row[2]
        cur_delay = next_row[3]
        cur_section = next_row[4]
        cur_lat = next_row[5]
        cur_lng = next_row[6]
    else:
        conn.close()
        raise ValueError(f"Unable to locate position for {target_ts}")

    # Fetch station actual arrival times and departure times from section_actuals
    cursor.execute(
        """SELECT section_id, from_code, to_code, actual_entry_time, actual_exit_time, exit_delay_min
           FROM section_actuals
           WHERE run_date = ?
           ORDER BY id ASC""",
        (run_date,)
    )
    actuals_rows = cursor.fetchall()
    conn.close()

    sec_by_to = {r[2]: r for r in actuals_rows}
    sec_by_from = {r[1]: r for r in actuals_rows}

    actual_arrivals = {}
    for r in actuals_rows:
        actual_arrivals[r[2]] = {
            "actual_time": r[4],
            "actual_time_fmt": datetime.fromisoformat(r[4]).strftime("%H:%M"),
            "exit_delay": r[5]
        }

    # Compute live telemetry of Leading Train (Train 12876 Neelachal Exp)
    lead_delay = round(max(4.0, min(58.0, cur_delay * 0.70 + 10.0)), 1)
    headway_gap_km = round(max(3.5, min(40.0, 32.0 - (lead_delay * 0.45) + (cur_delay * 0.15))), 1)
    lead_km = min(1451.0, round(cur_km + headway_gap_km, 2))
    lead_coords = get_coords_at_km(lead_km)
    is_lead_at_station = any(abs(lead_km - s["km"]) < 1.2 for s in STATIONS)
    lead_speed = 0.0 if is_lead_at_station else round(min(110.0, max(25.0, cur_speed * 0.92 + 6.0)), 1)

    # Determine Automatic Block Signal Aspect based on dynamic headway
    if headway_gap_km > 10.0:
        aspect = "GREEN"
        aspect_name = "CLEAR"
        aspect_badge = "🟢 Green (Clear)"
        aspect_color = "#10b981"
        speed_cap = "130 km/h (Line Speed)"
    elif 6.0 < headway_gap_km <= 10.0:
        aspect = "DOUBLE_YELLOW"
        aspect_name = "CAUTION"
        aspect_badge = "🟡 Double Yellow (Caution)"
        aspect_color = "#eab308"
        speed_cap = "75 km/h"
    elif 3.0 < headway_gap_km <= 6.0:
        aspect = "YELLOW"
        aspect_name = "ATTENTION"
        aspect_badge = "🟠 Yellow (Attention)"
        aspect_color = "#f97316"
        speed_cap = "40 km/h"
    else:
        aspect = "RED"
        aspect_name = "STOP / HELD"
        aspect_badge = "🔴 Red (Held at Outer)"
        aspect_color = "#ef4444"
        speed_cap = "0 km/h (Halt)"

    leading_context = {
        "train_no": LEADING_TRAIN_CONFIG["train_no"],
        "name": LEADING_TRAIN_CONFIG["name"],
        "km": lead_km,
        "delay_min": lead_delay,
        "headway_gap_km": headway_gap_km,
    }

    # Generate dynamic ETA predictions from current location with leading train & platform contention context
    upcoming = predictor.predict_etall(
        run_date=run_date,
        current_km=cur_km,
        current_time=target_dt,
        current_delay_min=cur_delay,
        leading_train_context=leading_context
    )

    # Attach actual arrival times for stations
    for i, item in enumerate(upcoming):
        code = item["code"]
        if code in actual_arrivals:
            item["actual_arrival"] = actual_arrivals[code]["actual_time"]
            item["actual_arrival_fmt"] = actual_arrivals[code]["actual_time_fmt"]
        else:
            item["actual_arrival"] = None
            item["actual_arrival_fmt"] = None
        if "status" not in item:
            item["status"] = "approaching" if i == 0 else "upcoming"

    # Identify passed stations with departure time, exit delay, and status
    passed_stations = []
    for stn in STATIONS:
        if stn["km"] <= cur_km:
            stn_code = stn["code"]
            to_sec = sec_by_to.get(stn_code)
            from_sec = sec_by_from.get(stn_code)

            if stn_code == STATIONS[0]["code"]:  # Origin HWH
                act_arr = from_sec[3] if from_sec else None
                act_dep = from_sec[3] if from_sec else None
                exit_delay = 0.0
            else:
                act_arr = to_sec[4] if to_sec else None
                act_dep = from_sec[3] if from_sec else None
                exit_delay = round(to_sec[5], 1) if to_sec else 0.0

            act_arr_fmt = datetime.fromisoformat(act_arr).strftime("%H:%M") if act_arr else None
            act_dep_fmt = datetime.fromisoformat(act_dep).strftime("%H:%M") if act_dep else None

            passed_stations.append({
                "code": stn["code"],
                "name": stn["name"],
                "km": stn["km"],
                "platform": stn.get("platform", 1),
                "actual_arrival": act_arr,
                "actual_arrival_fmt": act_arr_fmt,
                "actual_departure": act_dep,
                "actual_departure_fmt": act_dep_fmt,
                "exit_delay": exit_delay,
                "exit_delay_min": exit_delay,
                "status": "passed"
            })

    current_mps = SECTION_MAP.get(cur_section, {}).get("mps", 130)
    active_section = {
        "section_id": cur_section,
        "km": cur_km,
        "speed_kmph": cur_speed,
        "current_delay_min": cur_delay,
        "current_mps": current_mps
    }

    is_complete = cur_km >= 1450.0

    return {
        "train_no": TRAIN_NUMBER,
        "train_name": TRAIN_NAME,
        "run_date": run_date,
        "simulated_time": target_dt.isoformat(),
        "simulated_time_fmt": target_dt.strftime("%d %b %Y, %H:%M:%S IST"),
        "min_time": min_ts,
        "max_time": max_ts,
        "position": {
            "lat": cur_lat,
            "lng": cur_lng,
            "km": cur_km,
            "speed_kmph": cur_speed,
            "delay_min": cur_delay,
            "current_section": cur_section,
            "section_id": cur_section,
            "current_mps": current_mps
        },
        "active_section": active_section,
        "leading_train": {
            "train_no": LEADING_TRAIN_CONFIG["train_no"],
            "name": LEADING_TRAIN_CONFIG["name"],
            "km": lead_km,
            "lat": lead_coords[0],
            "lng": lead_coords[1],
            "speed_kmph": lead_speed,
            "delay_min": lead_delay,
            "headway_gap_km": headway_gap_km
        },
        "signal_aspect": {
            "code": aspect,
            "name": aspect_name,
            "badge": aspect_badge,
            "color": aspect_color,
            "speed_cap": speed_cap,
            "headway_gap_km": headway_gap_km
        },
        "upcoming_stations": upcoming,
        "passed_stations": passed_stations,
        "is_complete": is_complete,
        "last_updated": datetime.now().isoformat()
    }


if __name__ == "__main__":
    dates = get_available_run_dates()
    print(f"Available runs: {len(dates)} (from {dates[0]} to {dates[-1]})")
    state = get_replay_state(run_date=dates[10])
    print("Initial Replay State:")
    print(" - Simulated time:", state["simulated_time_fmt"])
    print(" - Position:", state["position"])
    print(" - Upcoming stations count:", len(state["upcoming_stations"]))
