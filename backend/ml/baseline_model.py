"""
ml/baseline_model.py
Physics baseline model for train section runtime and station dwell.
Uses distance / MPS with operational deceleration/acceleration factor + scheduled dwell.
Serves as the reliable, always-available physical fallback.
"""
from typing import Dict, Any, List
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import SECTIONS, SECTION_MAP, STATION_MAP, STATIONS


class PhysicsBaselineModel:
    """
    Physics-based baseline model.
    Section transit time estimated from distance and Section Maximum Permissible Speed (MPS),
    accounting for realistic speed efficiency (0.80 - 0.88 of MPS on Indian tracks).
    """

    def __init__(self, speed_efficiency: float = 0.82):
        self.speed_efficiency = speed_efficiency

    def predict_section_runtime(self, section_id: str) -> float:
        sec = SECTION_MAP.get(section_id)
        if not sec:
            raise ValueError(f"Unknown section_id: {section_id}")
        dist_km = sec["distance_km"]
        mps = sec["mps"]
        effective_speed = mps * self.speed_efficiency
        # Theoretical physics runtime in minutes
        physics_runtime = (dist_km / effective_speed) * 60.0
        # Blend physics runtime with timetabled scheduled runtime (50/50 blend)
        sched_runtime = sec["scheduled_runtime_min"]
        baseline_pred = (physics_runtime + sched_runtime) / 2.0
        return round(baseline_pred, 1)

    def predict_dwell(self, station_code: str) -> float:
        stn = STATION_MAP.get(station_code)
        if not stn:
            return 2.0
        return float(stn.get("halt_min", 2.0))

    def predict_remaining_sections(self, start_section_idx: int) -> List[Dict[str, Any]]:
        results = []
        for idx in range(start_section_idx, len(SECTIONS)):
            sec = SECTIONS[idx]
            runtime = self.predict_section_runtime(sec["section_id"])
            dwell = self.predict_dwell(sec["to_code"])
            results.append({
                "section_id": sec["section_id"],
                "from_code": sec["from_code"],
                "to_code": sec["to_code"],
                "predicted_runtime_min": runtime,
                "predicted_dwell_min": dwell
            })
        return results


if __name__ == "__main__":
    baseline = PhysicsBaselineModel()
    print("Physics Baseline Predictions per section:")
    for s in SECTIONS:
        rt = baseline.predict_section_runtime(s["section_id"])
        dw = baseline.predict_dwell(s["to_code"])
        print(f" - {s['section_id']}: {rt} min run, {dw} min dwell at {s['to_code']} (Sched: {s['scheduled_runtime_min']}m)")
