"""
ml/build_features.py
Feature engineering pipeline for Train ETA prediction.
Transforms raw section actuals into rich tabular feature vectors.
Uses walk-forward temporal splitting (first 45 runs for train, last 15 for test)
with zero future data leakage.
"""
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Dict, Tuple, List, Any
import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import ARTIFACTS_DIR, DB_PATH, SECTIONS, SECTION_MAP


FEATURE_COLUMNS = [
    "section_code_enc",
    "scheduled_runtime",
    "entry_delay_min",
    "hour_of_day",
    "day_of_week",
    "fog_flag",
    "historical_avg_runtime_section",
    "historical_avg_runtime_train",
    "train_recovery_rate_prev",
    "congestion_proxy"
]
TARGET_COLUMN = "actual_runtime_min"


def load_raw_section_data(db_path: Path = DB_PATH) -> pd.DataFrame:
    conn = sqlite3.connect(db_path)
    query = """
    SELECT 
        id, run_date, section_id, from_code, to_code,
        scheduled_runtime_min, entry_delay_min, actual_runtime_min,
        scheduled_dwell_min, actual_dwell_min, fog_flag,
        congestion_event_flag, exit_delay_min, actual_entry_time, actual_exit_time
    FROM section_actuals
    ORDER BY run_date ASC, id ASC
    """
    df = pd.read_sql_query(query, conn)
    conn.close()
    return df


def engineer_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, LabelEncoder, Dict[str, float]]:
    df = df.copy()

    # Label encode section_id
    le_section = LabelEncoder()
    # Fit encoder on predefined section order from config
    section_order = [s["section_id"] for s in SECTIONS]
    le_section.fit(section_order)
    df["section_code_enc"] = le_section.transform(df["section_id"])

    # Temporal features
    df["scheduled_runtime"] = df["scheduled_runtime_min"]
    df["dt_entry"] = pd.to_datetime(df["actual_entry_time"], format="ISO8601")
    df["hour_of_day"] = df["dt_entry"].dt.hour
    df["dt_run"] = pd.to_datetime(df["run_date"], format="ISO8601")
    df["day_of_week"] = df["dt_run"].dt.dayofweek

    # Calculate run-level sequential features (previous section congestion & recovery trend)
    congestion_proxies = []
    recovery_rates = []

    grouped = df.groupby("run_date", sort=False)
    for run_date, group in grouped:
        delays = group["entry_delay_min"].tolist()
        actual_runtimes = group["actual_runtime_min"].tolist()
        sched_runtimes = group["scheduled_runtime_min"].tolist()

        for idx in range(len(group)):
            # 1. Congestion proxy: actual - scheduled of previous section
            if idx == 0:
                congestion_proxies.append(0.0)
            else:
                prev_delta = actual_runtimes[idx - 1] - sched_runtimes[idx - 1]
                congestion_proxies.append(round(prev_delta, 1))

            # 2. Recovery rate: delay reduced over up to previous 3 sections
            if idx == 0:
                recovery_rates.append(0.0)
            else:
                lookback_idx = max(0, idx - 3)
                # Positive if delay was reduced (recovered time)
                delay_change = delays[lookback_idx] - delays[idx]
                recovery_rates.append(round(delay_change, 1))

    df["congestion_proxy"] = congestion_proxies
    df["train_recovery_rate_prev"] = recovery_rates

    # Expanding historical average runtime per section (strictly past runs to avoid leakage)
    global_section_means = {}
    historical_section_avgs = []

    unique_dates = df["run_date"].unique()
    date_to_prior_history: Dict[str, Dict[str, float]] = {}

    accumulated_runtimes: Dict[str, List[float]] = {sec_id: [] for sec_id in section_order}

    for dt in unique_dates:
        # Snapshot current averages prior to this date
        current_snapshot = {}
        for sec_id in section_order:
            history = accumulated_runtimes[sec_id]
            if history:
                current_snapshot[sec_id] = float(np.mean(history))
            else:
                current_snapshot[sec_id] = float(SECTION_MAP[sec_id]["scheduled_runtime_min"])
        date_to_prior_history[dt] = current_snapshot

        # Now accumulate records from this date
        day_rows = df[df["run_date"] == dt]
        for _, row in day_rows.iterrows():
            accumulated_runtimes[row["section_id"]].append(row["actual_runtime_min"])

    # Map back to df
    for _, row in df.iterrows():
        dt = row["run_date"]
        sec_id = row["section_id"]
        historical_section_avgs.append(round(date_to_prior_history[dt][sec_id], 1))

    df["historical_avg_runtime_section"] = historical_section_avgs
    df["historical_avg_runtime_train"] = historical_section_avgs  # Single train 12301 corridor

    # Store global final means for production inference
    for sec_id in section_order:
        vals = accumulated_runtimes[sec_id]
        global_section_means[sec_id] = round(float(np.mean(vals)), 1) if vals else float(SECTION_MAP[sec_id]["scheduled_runtime_min"])

    return df, le_section, global_section_means


def prepare_train_test_split(df_feat: pd.DataFrame, num_train_runs: int = 45) -> Tuple[pd.DataFrame, pd.DataFrame]:
    unique_dates = sorted(df_feat["run_date"].unique())
    train_dates = unique_dates[:num_train_runs]
    test_dates = unique_dates[num_train_runs:]

    train_df = df_feat[df_feat["run_date"].isin(train_dates)].copy()
    test_df = df_feat[df_feat["run_date"].isin(test_dates)].copy()
    return train_df, test_df


if __name__ == "__main__":
    df_raw = load_raw_section_data()
    df_feat, le, section_means = engineer_features(df_raw)
    train_df, test_df = prepare_train_test_split(df_feat, num_train_runs=45)
    print(f"Loaded {len(df_feat)} records across {df_feat['run_date'].nunique()} runs.")
    print(f"Train split: {len(train_df)} rows ({train_df['run_date'].nunique()} runs)")
    print(f"Test split:  {len(test_df)} rows ({test_df['run_date'].nunique()} runs)")
    print("Features ready:", FEATURE_COLUMNS)
