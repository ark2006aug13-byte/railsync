# tests/test_network_state.py
from datetime import datetime
from pathlib import Path
import sys
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from models.network_state import TrainPosition, SectionOccupancy, NetworkState


def test_train_position_and_section_occupancy():
    """Verify TrainPosition instantiation and SectionOccupancy percentage property."""
    now = datetime(2026, 9, 15, 12, 0, 0)
    t1 = TrainPosition(
        train_number="12301",
        latitude=26.45,
        longitude=80.35,
        speed_kmh=115.0,
        timestamp=now,
        section_id="CNB-NDLS",
        delay_minutes=10,
        train_type="RAJDHANI",
        priority=1,
        direction="UP",
        last_station="CNB",
        next_station="NDLS"
    )

    sec = SectionOccupancy(
        section_id="CNB-NDLS",
        trains=[t1],
        max_capacity=5,
        congestion_level="CLEAR"
    )

    assert sec.occupancy_percentage == 20.0  # 1 / 5 * 100

    # Zero capacity safety
    sec_zero = SectionOccupancy(
        section_id="EMPTY-SEC",
        trains=[],
        max_capacity=0,
        congestion_level="CLEAR"
    )
    assert sec_zero.occupancy_percentage == 0.0


def test_network_state_congestion_ahead():
    """Verify NetworkState.get_congestion_ahead detects leading convoy, distance, and risk."""
    now = datetime(2026, 9, 15, 12, 0, 0)

    # Current Train 12301 (UP Rajdhani near CNB, lon ~80.35)
    t_curr = TrainPosition(
        train_number="12301",
        latitude=26.45,
        longitude=80.35,
        speed_kmh=120.0,
        timestamp=now,
        section_id="CNB-TDL",
        delay_minutes=5,
        train_type="RAJDHANI",
        priority=1,
        direction="UP",
        last_station="CNB",
        next_station="NDLS"
    )

    # Leading Train 12876 (UP Neelachal Express ahead, lon ~80.15, slower 80 km/h)
    t_lead = TrainPosition(
        train_number="12876",
        latitude=26.50,
        longitude=80.15,
        speed_kmh=80.0,
        timestamp=now,
        section_id="CNB-TDL",
        delay_minutes=25,
        train_type="EXPRESS",
        priority=3,
        direction="UP",
        last_station="CNB",
        next_station="NDLS"
    )

    # Opposite Direction Train (DOWN direction - should be ignored)
    t_opp = TrainPosition(
        train_number="12302",
        latitude=26.52,
        longitude=80.10,
        speed_kmh=110.0,
        timestamp=now,
        section_id="TDL-CNB",
        delay_minutes=0,
        train_type="RAJDHANI",
        priority=1,
        direction="DOWN",
        last_station="NDLS",
        next_station="CNB"
    )

    sec_up = SectionOccupancy(
        section_id="CNB-TDL",
        trains=[t_curr, t_lead],
        max_capacity=4,
        congestion_level="MODERATE"
    )
    sec_down = SectionOccupancy(
        section_id="TDL-CNB",
        trains=[t_opp],
        max_capacity=4,
        congestion_level="CLEAR"
    )

    net = NetworkState(
        timestamp=now,
        sections={"CNB-TDL": sec_up, "TDL-CNB": sec_down},
        total_trains=3
    )

    congestion = net.get_congestion_ahead(t_curr, lookahead_km=50.0)
    assert congestion["count"] == 1
    assert len(congestion["trains"]) == 1
    ahead_info = congestion["trains"][0]
    assert ahead_info["train"].train_number == "12876"
    assert ahead_info["distance_km"] > 0.0
    assert ahead_info["speed_diff"] == 40.0  # 120 - 80 km/h
    assert congestion["slowest_ahead"]["train"].train_number == "12876"
    assert congestion["congestion_risk"] in ["MODERATE", "HIGH", "SEVERE"]
