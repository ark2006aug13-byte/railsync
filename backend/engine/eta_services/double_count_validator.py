"""
backend/engine/eta_services/double_count_validator.py
DoubleCountValidator Service.
Audits the DelayFactorLedger and runtime calculations to ensure that no operational delay
is counted twice across kinematics, weather, signals, throat friction, or platform holding.
"""
from typing import List, Dict, Any, Tuple
from models.eta_models import DelayFactorLedger, ValidationResult

class DoubleCountValidator:
    """
    Validates that delay factors in the ledger do not overlap or duplicate runtime penalties.
    """

    @classmethod
    def validate_ledger(
        cls,
        ledger: List[DelayFactorLedger],
        weather_in_base_runtime: bool = False,
        tsr_in_base_runtime: bool = False
    ) -> ValidationResult:
        issues: List[str] = []

        # 1. Weather speed cap double count check
        if weather_in_base_runtime:
            weather_factors = [f for f in ledger if f.factor_type in ("weather", "weather_fog")]
            if weather_factors:
                issues.append(
                    "Weather delay factor added while weather speed cap is already integrated into minimum runtime."
                )

        # 2. TSR caution speed cap double count check
        if tsr_in_base_runtime:
            tsr_factors = [f for f in ledger if f.factor_type in ("tsr", "caution_order")]
            if tsr_factors:
                issues.append(
                    "TSR delay factor added while TSR speed restriction is already integrated into minimum runtime."
                )

        # 3. Check for overlapping factors within the same overlap_group
        grouped: Dict[str, List[DelayFactorLedger]] = {}
        for factor in ledger:
            grp = factor.overlap_group
            if grp and grp != "none":
                grouped.setdefault(grp, []).append(factor)

        for grp_name, factors in grouped.items():
            if len(factors) > 1:
                # Check pairwise time window overlap
                for i in range(len(factors)):
                    for j in range(i + 1, len(factors)):
                        f1, f2 = factors[i], factors[j]
                        # Disallow summing overlapping windows in the same overlap group
                        if f1.valid_from < f2.valid_to and f2.valid_from < f1.valid_to:
                            # Exception: Recovery is negative credit, but penalties must not duplicate
                            if f1.factor_type != "recovery" and f2.factor_type != "recovery":
                                issues.append(
                                    f"Duplicate overlap in group '{grp_name}': {f1.factor_type} and {f2.factor_type} "
                                    f"compounded across overlapping window ({f1.reason_text} vs {f2.reason_text})."
                                )

        # 4. Platform holding vs Outer signal hold duplication
        platform_holds = [f for f in ledger if f.factor_type == "platform_holding"]
        outer_holds = [f for f in ledger if f.factor_type in ("signal_headway", "outer_queue") and "outer" in f.reason_text.lower()]
        if platform_holds and outer_holds:
            issues.append(
                "Platform holding and Outer signal hold simultaneously applied for identical terminal station approach."
            )

        # 5. Throat movement time vs Platform holding time duplication
        throat_moves = [f for f in ledger if f.factor_type == "throat"]
        if platform_holds and throat_moves:
            # If train is held outside, throat movement cannot be simultaneously active
            for ph in platform_holds:
                for tm in throat_moves:
                    if ph.applied_to_station == tm.applied_to_station and ph.valid_from < tm.valid_to and tm.valid_from < ph.valid_to:
                        issues.append(
                            f"Throat movement time duplicated during active outer platform holding at {ph.applied_to_station}."
                        )

        status = "FAIL" if issues else "PASS"
        return ValidationResult(status=status, issues=issues)
