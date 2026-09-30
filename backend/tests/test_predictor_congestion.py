# tests/test_predictor_congestion.py
import asyncio
from datetime import datetime
from pathlib import Path
import sys
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from engine.predictor import TrainPredictor
from engine.network_tracker import NetworkTracker
from models.network_state import TrainPosition, SectionOccupancy, NetworkState


def test_train_predictor_network_congestion_penalty():
    """Verify TrainPredictor.calculate_congestion_penalty evaluates proximity, closing speed, and convoy counts."""
    now = datetime(2026, 9, 15, 12, 0, 0)
    tracker = NetworkTracker(db_pool=None)

    # Setup simulated network state with a leading train 8 km ahead running at 70 km/h
    # (Train 12301 running at 115 km/h -> speed diff = 45 km/h > 30 km/h)
    lead_train = TrainPosition(
        train_number="12876",
        latitude=26.46,
        longitude=80.30,  # ~5.1 km west of (26.45, 80.35)
        speed_kmh=70.0,
        timestamp=now,
        section_id="CNB-NDLS",
        delay_minutes=20,
        train_type="EXPRESS",
        priority=3,
        direction="UP",
        last_station="CNB",
        next_station="NDLS"
    )

    sec = SectionOccupancy(
        section_id="CNB-NDLS",
        trains=[lead_train],
        max_capacity=5,
        congestion_level="MODERATE"
    )

    tracker.network_state = NetworkState(
        timestamp=now,
        sections={"CNB-NDLS": sec},
        total_trains=1
    )

    predictor = TrainPredictor(network_tracker=tracker)
    assert predictor.network_tracker is tracker

    current_train = {
        "train_number": "12301",
        "speed": 115.0,
        "delay": 5,
        "type": "RAJDHANI",
        "priority": 1,
        "direction": "UP"
    }

    section = {
        "section_id": "CNB-NDLS",
        "current_lat": 26.45,
        "current_lon": 80.35,
        "last_station": "CNB",
        "next_station": "NDLS"
    }

    # Run async test
    async def run_test():
        pen = await predictor.calculate_congestion_penalty(section, current_train)
        # Distance < 10 km -> 12.0 min, speed_diff = 45 > 30 -> +5.0 min => 17.0 min
        assert pen == 17.0

        # Test no trains ahead (opposite direction)
        down_train = dict(current_train)
        down_train["direction"] = "DOWN"
        pen_down = await predictor.calculate_congestion_penalty(section, down_train)
        assert pen_down == 0.0

    asyncio.run(run_test())

    # Test synchronous version
    pen_sync = predictor.calculate_congestion_penalty_sync(section, current_train)
    assert pen_sync == 17.0
