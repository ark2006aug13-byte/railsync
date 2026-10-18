"""
backend/engine/eta_services/signal_engine.py
SignalEngine Service.
Block-aware signaling simulation with probabilistic headway delays and
dynamic priority overtake probability modeling (FIX 13).
"""
import math
from typing import Dict, Any, Optional, Tuple
from engine.eta_config import ETA_CONFIG

class SignalEngine:
    """
    Evaluates signaling aspect and spatial headway delay probabilistically.
    """

    @classmethod
    def evaluate_signaling_and_overtake(
        cls,
        headway_gap_km: float,
        train_priority: int = 1,
        preceding_priority: int = 3,
        preceding_speed_kmph: float = 85.0,
        following_speed_kmph: float = 120.0,
        loop_line_available: bool = True,
        siding_length_meters: float = 750.0,
        preceding_train_length_meters: float = 540.0,
        has_live_signaling: bool = True
    ) -> Dict[str, Any]:
        """
        Computes probabilistic P50 and P90 signal headway delay and simulates controller overtake.
        """
        if not has_live_signaling:
            # Historical Learned Delay Fallback
            # Based on section density and typical headways on Indian Railways Golden Quadrilateral
            return {
                "aspect": "DOUBLE_YELLOW",
                "aspect_badge": "🟡 Inferred Double Yellow",
                "delay_p50": 2.5,
                "delay_p90": 6.0,
                "overtake_occurred": False,
                "overtake_probability": 0.30,
                "confidence": 0.65,
                "source": "HISTORICAL_LEARNED_MODEL",
                "description": "Historical headway inference: typical caution density on section (+2.5m P50, +6.0m P90)"
            }

        # 1. Base Signal Aspect from Spatial Headway
        if headway_gap_km >= ETA_CONFIG["block_headway_clear_km"]:
            aspect = "GREEN"
            badge = "🟢 Clear Green"
            base_p50 = 0.0
            base_p90 = 0.5
        elif headway_gap_km >= ETA_CONFIG["block_headway_caution_km"]:
            aspect = "DOUBLE_YELLOW"
            badge = f"🟡 Double Yellow (Headway {headway_gap_km:.1f} km)"
            base_p50 = 3.0
            base_p90 = 5.5
        elif headway_gap_km >= ETA_CONFIG["block_headway_attention_km"]:
            aspect = "YELLOW"
            badge = f"🟠 Yellow (Attention {headway_gap_km:.1f} km)"
            base_p50 = 6.5
            base_p90 = 10.0
        else:
            aspect = "RED"
            badge = f"🔴 Red (Stop/Held {headway_gap_km:.1f} km)"
            base_p50 = 11.0
            base_p90 = 16.0

        # 2. Dynamic Overtake Probability Model
        # Conditions: Higher priority following train, loop available, train fits in siding
        overtake_prob = 0.0
        overtake_executed = False
        final_p50 = base_p50
        final_p90 = base_p90
        overtake_note = None

        if train_priority < preceding_priority and loop_line_available and siding_length_meters >= preceding_train_length_meters:
            # Speed differential creates closing rate
            speed_delta = max(0.0, following_speed_kmph - preceding_speed_kmph)
            # Probability model based on urgency and priority gap
            priority_gap = preceding_priority - train_priority  # e.g., 3 - 1 = 2
            overtake_prob = min(0.95, 0.40 + 0.20 * priority_gap + 0.01 * speed_delta)

            if headway_gap_km <= 8.0 and overtake_prob >= ETA_CONFIG["overtake_probability_threshold"]:
                overtake_executed = True
                # Controller routes preceding train onto loop line; caution delay is mitigated
                reduction_ratio = 0.65
                final_p50 = round(base_p50 * (1.0 - reduction_ratio), 1)
                final_p90 = round(base_p90 * 0.50, 1)
                badge = f"🟢 Caution Loop Overtake Active (Headway {headway_gap_km:.1f} km)"
                overtake_note = (
                    f"Priority Overtake: Controller routing lower-priority train (P{preceding_priority}) "
                    f"to loop line (P_overtake={overtake_prob:.2f}). Headway delay mitigated to +{final_p50:.1f}m."
                )

        desc = overtake_note or f"{badge}: Headway {headway_gap_km:.1f} km (+{final_p50:.1f}m P50, +{final_p90:.1f}m P90)"

        return {
            "aspect": aspect,
            "aspect_badge": badge,
            "delay_p50": final_p50,
            "delay_p90": final_p90,
            "overtake_occurred": overtake_executed,
            "overtake_probability": round(overtake_prob, 2),
            "confidence": 0.95,
            "source": "LIVE_BLOCK_SIMULATION",
            "description": desc
        }

    @classmethod
    def simulate_headway(
        cls,
        current_aspect: Any = "GREEN",
        headway_gap_km: float = 18.0,
        train_priority: int = 1,
        segment_length_km: float = 50.0
    ) -> Dict[str, Any]:
        """
        Convenience classmethod for route simulation.
        """
        res = cls.evaluate_signaling_and_overtake(
            headway_gap_km=headway_gap_km,
            train_priority=train_priority,
            preceding_priority=3,
            has_live_signaling=True
        )
        return {
            "aspect": res["aspect"],
            "headway_delay_min": res["delay_p50"],
            "reason_text": res["description"]
        }
