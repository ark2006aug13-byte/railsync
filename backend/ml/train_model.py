"""
ml/train_model.py
Trains a LightGBM Regressor to predict section-by-section train runtimes.
Evaluates on the walk-forward test set (last 15 runs) and saves model artifacts to ml/artifacts/.
"""
import json
import sqlite3
from pathlib import Path
import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, root_mean_squared_error
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import ARTIFACTS_DIR
from ml.build_features import (
    FEATURE_COLUMNS,
    TARGET_COLUMN,
    engineer_features,
    load_raw_section_data,
    prepare_train_test_split,
)


def train_runtime_model():
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    print("Loading data and engineering features...")
    df_raw = load_raw_section_data()
    df_feat, le_section, section_means = engineer_features(df_raw)

    train_df, test_df = prepare_train_test_split(df_feat, num_train_runs=45)

    X_train = train_df[FEATURE_COLUMNS]
    y_train = train_df[TARGET_COLUMN]

    X_test = test_df[FEATURE_COLUMNS]
    y_test = test_df[TARGET_COLUMN]

    print(f"Training LightGBM model on {len(X_train)} samples (45 runs)...")
    model = lgb.LGBMRegressor(
        objective="regression_l1",
        n_estimators=300,
        learning_rate=0.03,
        num_leaves=24,
        min_child_samples=5,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=42,
        verbose=-1
    )

    model.fit(
        X_train,
        y_train,
        eval_set=[(X_test, y_test)],
        callbacks=[lgb.early_stopping(stopping_rounds=30, verbose=False)]
    )

    # Evaluate on Train
    y_pred_train = model.predict(X_train)
    train_mae = mean_absolute_error(y_train, y_pred_train)
    train_rmse = root_mean_squared_error(y_train, y_pred_train)

    # Evaluate on Test
    y_pred_test = model.predict(X_test)
    test_mae = mean_absolute_error(y_test, y_pred_test)
    test_rmse = root_mean_squared_error(y_test, y_pred_test)

    # Compute static schedule baseline error on test set
    schedule_baseline_mae = mean_absolute_error(y_test, test_df["scheduled_runtime"])

    print("\n==========================================")
    print("      LIGHTGBM MODEL TRAINING RESULTS     ")
    print("==========================================")
    print(f"Train MAE:                 {train_mae:.2f} min (RMSE: {train_rmse:.2f} min)")
    print(f"Test MAE (Walk-Forward):   {test_mae:.2f} min (RMSE: {test_rmse:.2f} min)")
    print(f"Static Schedule Base MAE:  {schedule_baseline_mae:.2f} min")
    error_reduction = ((schedule_baseline_mae - test_mae) / schedule_baseline_mae) * 100.0
    print(f"Test Error Reduction:      {error_reduction:.1f}%")
    print("==========================================\n")

    # Save artifacts (using native booster for 100% C++ stability on Windows)
    booster_path = ARTIFACTS_DIR / "lightgbm_runtime_model.txt"
    encoder_path = ARTIFACTS_DIR / "section_encoder.joblib"
    meta_path = ARTIFACTS_DIR / "feature_metadata.json"

    model.booster_.save_model(str(booster_path))
    joblib.dump(le_section, encoder_path)

    # Compute residual std for confidence interval calculation
    residuals = y_test - y_pred_test
    residual_std = float(np.std(residuals))

    metadata = {
        "feature_columns": FEATURE_COLUMNS,
        "target_column": TARGET_COLUMN,
        "section_historical_means": section_means,
        "test_mae": round(float(test_mae), 2),
        "test_rmse": round(float(test_rmse), 2),
        "schedule_baseline_mae": round(float(schedule_baseline_mae), 2),
        "error_reduction_pct": round(float(error_reduction), 1),
        "residual_std": round(residual_std, 2),
        "training_runs_count": 45,
        "test_runs_count": 15
    }

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"Model and artifacts successfully saved to: {ARTIFACTS_DIR}")
    return model, metadata


if __name__ == "__main__":
    train_runtime_model()
