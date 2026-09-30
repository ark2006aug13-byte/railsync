"""
data/generate_synthetic.py
Generates 60 days of realistic Indian Railways historical train runs (Train 12301)
with origin delays, fog conditions, congestion events, and driver delay-recovery behavior.
Stores results in data/train_history.db.
"""
import math
import random
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
import sys

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import (
    DB_PATH,
    SCHEDULED_DEPARTURE_TIME,
    SECTIONS,
    STATION_MAP,
    STATIONS,
    TRAIN_NUMBER,
    interpolate_section_track,
)


def init_db(conn: sqlite3.Connection):
    cursor = conn.cursor()
    cursor.execute("DROP TABLE IF EXISTS section_actuals")
    cursor.execute("DROP TABLE IF EXISTS position_snapshots")
    cursor.execute("DROP TABLE IF EXISTS runs")

    cursor.execute("""
    CREATE TABLE runs (
        run_date TEXT PRIMARY KEY,
        train_no TEXT NOT NULL,
        origin_delay_min REAL NOT NULL,
        total_delay_min REAL NOT NULL
    )
    """)

    cursor.execute("""
    CREATE TABLE section_actuals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_date TEXT NOT NULL,
        section_id TEXT NOT NULL,
        from_code TEXT NOT NULL,
        to_code TEXT NOT NULL,
        scheduled_runtime_min REAL NOT NULL,
        entry_delay_min REAL NOT NULL,
        actual_runtime_min REAL NOT NULL,
        scheduled_dwell_min REAL NOT NULL,
        actual_dwell_min REAL NOT NULL,
        fog_flag INTEGER NOT NULL,
        congestion_event_flag INTEGER NOT NULL,
        exit_delay_min REAL NOT NULL,
        actual_entry_time TEXT NOT NULL,
        actual_exit_time TEXT NOT NULL
    )
    """)

    cursor.execute("""
    CREATE TABLE position_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        train_no TEXT NOT NULL,
        run_date TEXT NOT NULL,
        ts TEXT NOT NULL,
        km_position REAL NOT NULL,
        speed_kmph REAL NOT NULL,
        delay_min REAL NOT NULL,
        current_section TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL
    )
    """)

    cursor.execute("CREATE INDEX idx_snapshots_date_ts ON position_snapshots (run_date, ts)")
    cursor.execute("CREATE INDEX idx_actuals_date ON section_actuals (run_date, section_id)")
    conn.commit()


def interpolate_coords(from_stn, to_stn, fraction):
    coords = interpolate_section_track(from_stn["code"], to_stn["code"], fraction)
    return round(coords[0], 5), round(coords[1], 5)


def generate_synthetic_data(num_days: int = 60, seed: int = 42):
    random.seed(seed)
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    init_db(conn)

    start_date = datetime(2024, 11, 1)  # 60 days spans Nov 1 to Dec 30 (includes Nov 15+ fog)
    all_runs = []
    all_actuals = []
    all_snapshots = []

    for day_idx in range(num_days):
        current_run_date = (start_date + timedelta(days=day_idx)).strftime("%Y-%m-%d")
        dt_run = datetime.strptime(current_run_date, "%Y-%m-%d")

        # 1. Origin delay: 0-120 min, right-skewed (lognormal with median ~8 min, tail up to 120 min)
        raw_origin_delay = random.lognormvariate(2.2, 0.8) - 4.0
        origin_delay_min = max(0.0, min(120.0, raw_origin_delay))
        # 40% chance of being perfectly on time (0 delay)
        if random.random() < 0.40:
            origin_delay_min = 0.0

        current_delay_min = origin_delay_min

        # Parse scheduled departure time on run date
        sched_dep_h, sched_dep_m, sched_dep_s = map(int, SCHEDULED_DEPARTURE_TIME.split(":"))
        train_clock = dt_run.replace(hour=sched_dep_h, minute=sched_dep_m, second=sched_dep_s)
        # Actual departure time from origin
        train_clock += timedelta(minutes=origin_delay_min)

        # Recovery tracking state
        recovery_active = False
        remaining_recovery_min_per_sec = 0.0
        recovery_sections_left = 0

        # Snapshot tracking
        next_snapshot_time = train_clock
        snapshot_interval = timedelta(minutes=2)

        # Record initial snapshot at Howrah
        hwh_stn = STATIONS[0]
        all_snapshots.append((
            TRAIN_NUMBER,
            current_run_date,
            train_clock.isoformat(),
            0.0,
            0.0,
            round(current_delay_min, 1),
            "HWH",
            hwh_stn["lat"],
            hwh_stn["lng"]
        ))
        next_snapshot_time += snapshot_interval

        for sec_idx, sec in enumerate(SECTIONS):
            sec_id = sec["section_id"]
            from_stn = STATION_MAP[sec["from_code"]]
            to_stn = STATION_MAP[sec["to_code"]]
            sched_runtime = sec["scheduled_runtime_min"]
            dist_km = sec["distance_km"]

            # Check fog condition: Nov 15 to Jan 15 for BWN-ASN, ASN-DHN, DHN-GAYA
            is_fog_period = datetime(dt_run.year, 11, 15) <= dt_run <= datetime(dt_run.year + (1 if dt_run.month == 12 else 0), 1, 15)
            is_fog_section = sec_id in ["BWN-ASN", "ASN-DHN", "DHN-GAYA"]
            fog_flag = 1 if (is_fog_period and is_fog_section and random.random() < 0.75) else 0

            fog_mult = random.uniform(1.3, 1.8) if fog_flag else 1.0

            # Random congestion event (15% probability per section): +10 to 40 min
            congestion_flag = 1 if random.random() < 0.15 else 0
            congestion_delay = random.uniform(10.0, 40.0) if congestion_flag else 0.0

            # RECOVERY BEHAVIOR:
            # If train is running late (>20 min) and not currently recovering, initiate recovery over next 3-4 sections
            if current_delay_min > 20.0 and not recovery_active and not fog_flag:
                recovery_active = True
                recovery_sections_left = random.randint(3, 4)
                # Recover 30-50% of delay spread across these sections
                total_recover = current_delay_min * random.uniform(0.30, 0.50)
                remaining_recovery_min_per_sec = total_recover / recovery_sections_left

            # Calculate actual section runtime
            base_runtime = sched_runtime * fog_mult + congestion_delay

            # Apply recovery if active (speed up 5% to 15%)
            if recovery_active and recovery_sections_left > 0 and not fog_flag and not congestion_flag:
                max_allowed_speedup = sched_runtime * random.uniform(0.08, 0.15)
                actual_speedup = min(remaining_recovery_min_per_sec, max_allowed_speedup)
                actual_runtime = max(dist_km / (sec["mps"] / 60.0) * 1.05, base_runtime - actual_speedup)
                recovery_sections_left -= 1
                if recovery_sections_left <= 0 or current_delay_min <= 5.0:
                    recovery_active = False
            else:
                # Normal variation +/- 4% around base
                actual_runtime = base_runtime * random.uniform(0.97, 1.04)

            entry_time = train_clock
            entry_delay = current_delay_min

            # Generate snapshots along this section every 2 min
            sec_start_km = from_stn["km"]
            sec_end_km = to_stn["km"]
            transit_duration = timedelta(minutes=actual_runtime)
            exit_time = entry_time + transit_duration

            # Average speed for the section
            avg_speed = (dist_km / actual_runtime) * 60.0

            while next_snapshot_time < exit_time:
                elapsed_min = (next_snapshot_time - entry_time).total_seconds() / 60.0
                fraction = min(1.0, max(0.0, elapsed_min / actual_runtime))
                cur_km = sec_start_km + dist_km * fraction
                cur_lat, cur_lng = interpolate_coords(from_stn, to_stn, fraction)

                # Realistic speed profile: accelerates, cruises at avg_speed, decelerates near end
                if fraction < 0.10:
                    inst_speed = avg_speed * (0.5 + 5.0 * fraction)
                elif fraction > 0.90:
                    inst_speed = avg_speed * (0.5 + 5.0 * (1.0 - fraction))
                else:
                    inst_speed = avg_speed * random.uniform(0.95, 1.05)
                inst_speed = min(sec["mps"], max(15.0, inst_speed))

                # Section delay evolves linearly from entry delay to exit delay
                cur_delay = entry_delay + (actual_runtime - sched_runtime) * fraction

                all_snapshots.append((
                    TRAIN_NUMBER,
                    current_run_date,
                    next_snapshot_time.isoformat(),
                    round(cur_km, 2),
                    round(inst_speed, 1),
                    round(cur_delay, 1),
                    sec_id,
                    cur_lat,
                    cur_lng
                ))
                next_snapshot_time += snapshot_interval

            # Train arrives at to_stn
            train_clock = exit_time
            section_delay_delta = actual_runtime - sched_runtime
            current_delay_min += section_delay_delta

            # Dwell at station
            sched_halt = to_stn["halt_min"]
            if sched_halt > 0:
                # Dwell time = scheduled_halt + noise (2-10 min; more if late/crowded)
                if current_delay_min > 30.0:
                    dwell_noise = random.uniform(2.0, 8.0)
                else:
                    dwell_noise = random.uniform(0.5, 3.0)
                actual_dwell = sched_halt + dwell_noise
            else:
                actual_dwell = 0.0

            dwell_duration = timedelta(minutes=actual_dwell)
            depart_time = train_clock + dwell_duration

            # Snapshots during dwell (speed = 0)
            while next_snapshot_time < depart_time:
                all_snapshots.append((
                    TRAIN_NUMBER,
                    current_run_date,
                    next_snapshot_time.isoformat(),
                    round(float(to_stn["km"]), 2),
                    0.0,
                    round(current_delay_min, 1),
                    to_stn["code"],
                    to_stn["lat"],
                    to_stn["lng"]
                ))
                next_snapshot_time += snapshot_interval

            train_clock = depart_time
            dwell_delay_delta = actual_dwell - sched_halt
            current_delay_min += dwell_delay_delta

            all_actuals.append((
                current_run_date,
                sec_id,
                sec["from_code"],
                sec["to_code"],
                round(sched_runtime, 1),
                round(entry_delay, 1),
                round(actual_runtime, 1),
                round(float(sched_halt), 1),
                round(actual_dwell, 1),
                fog_flag,
                congestion_flag,
                round(current_delay_min, 1),
                entry_time.isoformat(),
                exit_time.isoformat()
            ))

        all_runs.append((
            current_run_date,
            TRAIN_NUMBER,
            round(origin_delay_min, 1),
            round(current_delay_min, 1)
        ))

    # Bulk insert
    cursor = conn.cursor()
    cursor.executemany(
        "INSERT INTO runs (run_date, train_no, origin_delay_min, total_delay_min) VALUES (?, ?, ?, ?)",
        all_runs
    )
    cursor.executemany(
        """INSERT INTO section_actuals (
            run_date, section_id, from_code, to_code, scheduled_runtime_min,
            entry_delay_min, actual_runtime_min, scheduled_dwell_min, actual_dwell_min,
            fog_flag, congestion_event_flag, exit_delay_min, actual_entry_time, actual_exit_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        all_actuals
    )
    cursor.executemany(
        """INSERT INTO position_snapshots (
            train_no, run_date, ts, km_position, speed_kmph, delay_min, current_section, lat, lng
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        all_snapshots
    )
    conn.commit()
    conn.close()

    print(f"Successfully generated {num_days} days of realistic train runs:")
    print(f" - Runs: {len(all_runs)}")
    print(f" - Section actual records: {len(all_actuals)} (8 sections x {num_days} days)")
    print(f" - Position snapshots: {len(all_snapshots)} (~2-min resolution)")
    print(f" - Stored in: {DB_PATH}")


if __name__ == "__main__":
    generate_synthetic_data(num_days=60, seed=42)
