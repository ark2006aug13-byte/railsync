"""
backend/engine/eta_services/recovery_engine.py
RecoveryEngine Service.
Implements bounded engineering timetable slack recovery (FIX 1 & FIX 15).
Ensures recovery can never be negative, never exceeds current delay, and is strictly
frozen during adverse weather, TSRs, signal congestion, platform holding, or active incidents.
"""
from typing import Dict, Any, Optional

class RecoveryEngine:
    """
    Computes authentic recoverable timetable slack and bounds recovery.
    """

    @classmethod
    def compute_bounded_recovery(
        cls,
        current_delay: float,
        scheduled_remaining_runtime: float,
        minimum_remaining_runtime: float,
        expected_future_added_delay: float,
        is_dense_fog: bool = False,
        is_active_tsr: bool = False,
        signal_aspect: str = "GREEN",
        is_platform_holding: bool = False,
        is_incident_active: bool = False,
        is_telemetry_stale: bool = False,
        mps_kmph: float = 130.0
    ) -> Dict[str, Any]:
        """
        Evaluates exact bounded timetable slack recovery adhering to Mandatory Fix 1 & 15.
        """
        # 1. Recovery Freeze Conditions
        freeze_reasons = []
        if is_dense_fog:
            freeze_reasons.append("Dense fog speed restrictions prevent high-speed running")
        if is_active_tsr:
            freeze_reasons.append("Active divisional caution orders (TSR) restrict speed")
        if signal_aspect in ("DOUBLE_YELLOW", "YELLOW", "RED"):
            freeze_reasons.append(f"Signal aspect {signal_aspect} requires caution braking")
        if is_platform_holding:
            freeze_reasons.append("Outer queue or platform holding prevents forward progress")
        if is_incident_active:
            freeze_reasons.append("Active operational incident freezes delay recovery")
        if is_telemetry_stale:
            freeze_reasons.append("Stale telemetry reduces confidence; recovery credit suspended")

        if freeze_reasons:
            return {
                "bounded_recovery": 0.0,
                "available_slack": 0.0,
                "is_frozen": True,
                "freeze_reasons": freeze_reasons,
                "reason_text": "Recovery suspended: " + "; ".join(freeze_reasons)
            }

        # 2. Available Remaining Timetable Slack
        raw_slack = max(0.0, scheduled_remaining_runtime - minimum_remaining_runtime)
        
        # Slack efficiency: 85% at 130 km/h, 60% at 110 km/h
        efficiency = 0.85 if mps_kmph >= 130.0 else 0.60
        available_remaining_slack = raw_slack * efficiency

        # 3. Mandatory Fix 1: Exact Mathematical Bound
        recoverable_delay_pool = max(0.0, current_delay)
        future_unavoidable_delay = max(0.0, expected_future_added_delay)

        available_slack_after_future = max(
            0.0,
            available_remaining_slack - future_unavoidable_delay
        )

        bounded_recovery = min(
            recoverable_delay_pool,
            available_slack_after_future
        )

        bounded_recovery = round(max(0.0, bounded_recovery), 1)

        reason_text = (
            f"Recovered {bounded_recovery:.1f}m at {mps_kmph:.0f} km/h line speed "
            f"against available timetable slack ({available_remaining_slack:.1f}m pool)"
            if bounded_recovery > 0
            else "No slack recovery available on current section"
        )

        return {
            "bounded_recovery": bounded_recovery,
            "available_slack": round(available_remaining_slack, 1),
            "is_frozen": False,
            "freeze_reasons": [],
            "reason_text": reason_text
        }
