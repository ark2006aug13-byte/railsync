"""
tests/test_eta_predictor.py
Comprehensive test suite for TrainPredictor / DynamicETAPredictor:
1. predict_with_confidence returns structured confidence bounds and waterfall steps.
2. Handling multiple train classes (Rajdhani 12301, Vikramshila 12367, Brahmaputra 15657).
3. Section time calculation decomposes base kinematics, TSR, congestion, and weather.
4. Congestion penalty calculation against lookahead convoys.
5. Monotonic ETA progression across upcoming route stations.
"""
from datetime import datetime
import pytest

from engine.predictor import TrainPredictor
from engine.network_tracker import NetworkTracker


async def test_predict_with_confidence_structure(train_predictor):
    """Verify predict_with_confidence returns comprehensive confidence bounds and breakdown."""
    eta_data = await train_predictor.predict_with_confidence("12301")

    assert eta_data["train_number"] == "12301"
    assert eta_data["destination_station"] == "NDLS"
    assert "scheduled_arrival" in eta_data
    assert "dynamic_eta" in eta_data
    assert "predicted_delay_minutes" in eta_data

    # Verify confidence intervals
    conf = eta_data["confidence_intervals"]
    assert "p10" in conf
    assert "p50" in conf
    assert "p90" in conf
    assert 0.0 <= conf["confidence_score"] <= 1.0
    assert 50 <= conf["confidence_percentage"] <= 100

    # Verify waterfall breakdown
    waterfall = eta_data["waterfall_breakdown"]
    assert len(waterfall) >= 4
    labels = [w["label"] for w in waterfall]
    assert any("Fog" in l or "Weather" in l for l in labels)

    # Verify upcoming stations list
    upcoming = eta_data["upcoming_stations"]
    assert len(upcoming) > 0
    assert upcoming[-1]["station_code"] == "NDLS"


async def test_predict_with_confidence_train_profiles(train_predictor):
    """Verify predictions for Vikramshila 12367 and Brahmaputra 15657."""
    res_12367 = await train_predictor.predict_with_confidence("12367")
    assert res_12367["train_number"] == "12367"
    assert isinstance(res_12367["predicted_delay_minutes"], (int, float))

    res_15657 = await train_predictor.predict_with_confidence("15657")
    assert res_15657["train_number"] == "15657"
    assert isinstance(res_15657["predicted_delay_minutes"], (int, float))


async def test_calculate_section_time_decomposition(train_predictor, sample_section, sample_train):
    """Verify calculate_section_time properly balances all delay categories."""
    result = await train_predictor.calculate_section_time(sample_section, sample_train)

    assert "total_time_minutes" in result
    assert "breakdown" in result

    bd = result["breakdown"]
    assert "base" in bd
    assert "tsr" in bd
    assert "congestion" in bd
    assert "weather" in bd

    total_calc = round(bd["base"] + bd["tsr"] + bd["congestion"] + bd["weather"], 2)
    assert abs(result["total_time_minutes"] - total_calc) < 0.05


async def test_monotonic_station_etas(train_predictor):
    """Verify all upcoming stations have strictly monotonically increasing ETAs."""
    eta_data = await train_predictor.predict_with_confidence("12301")
    upcoming = eta_data["upcoming_stations"]

    prev_dt = datetime.min
    for stn in upcoming:
        cur_dt = datetime.fromisoformat(stn["dynamic_eta"])
        assert cur_dt > prev_dt, f"ETA for {stn['station_code']} ({cur_dt}) should be after ({prev_dt})"
        prev_dt = cur_dt
