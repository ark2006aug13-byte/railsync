# tests/test_network_tracker.py
import asyncio
from datetime import datetime
from pathlib import Path
import sys
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from engine.network_tracker import NetworkTracker
from models.network_state import NetworkState, TrainPosition


def test_network_tracker_congestion_levels():
    """Verify occupancy percentage to congestion level mappings."""
    tracker = NetworkTracker(db_pool=None)
    assert tracker._calculate_congestion_level(current=1, capacity=5) == "CLEAR"     # 20%
    assert tracker._calculate_congestion_level(current=3, capacity=5) == "MODERATE"  # 60%
    assert tracker._calculate_congestion_level(current=4, capacity=5) == "HIGH"      # 80%
    assert tracker._calculate_congestion_level(current=5, capacity=5) == "SEVERE"    # 100%


def test_network_tracker_state_update_and_get():
    """Verify NetworkTracker builds valid NetworkState from simulated active corridor trains."""
    tracker = NetworkTracker(db_pool=None)

    async def run_test():
        state = await tracker.get_network_state()
        assert isinstance(state, NetworkState)
        assert state.total_trains >= 3
        assert "CNB-NDLS" in state.sections
        sec = state.sections["CNB-NDLS"]
        assert len(sec.trains) >= 2
        assert sec.max_capacity > 0
        assert sec.congestion_level in ["CLEAR", "MODERATE", "HIGH", "SEVERE"]

        # Test congestion ahead query
        curr_train = sec.trains[0]
        ahead = state.get_congestion_ahead(curr_train, lookahead_km=60.0)
        assert "count" in ahead
        assert "congestion_risk" in ahead

    asyncio.run(run_test())


def test_network_tracker_start_stop_lifecycle():
    """Verify background task starting and cancellation cleanly shuts down."""
    tracker = NetworkTracker(db_pool=None, update_interval=1)

    async def run_lifecycle():
        await tracker.start()
        assert tracker._update_task is not None
        assert not tracker._update_task.done()
        await asyncio.sleep(0.05)
        await tracker.stop()
        assert tracker._update_task.cancelled() or tracker._update_task.done()

    asyncio.run(run_lifecycle())
