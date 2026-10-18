"""
backend/engine/eta_services/station_engine.py
StationEngine Service.
Models junction-specific terminal approach micro-graphs, platform conflicts,
outer signal holding queues, and dynamic dwell times (FIX 6, 7, 14).
"""
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple
from engine.eta_config import now_utc, to_utc

# Detailed Junction Approach Micro-Graphs
JUNCTION_MICRO_GRAPHS: Dict[str, Dict[str, Any]] = {
    "NDLS": {
        "name": "New Delhi",
        "throat_distance_km": 5.2,
        "turnout_mps_kmph": 25.0,
        "diamond_crossings_count": 8,
        "base_throat_friction_min": 4.0,
        "crew_change_default": False,
        "loco_reversal_default": False,
        "description": "NDLS Yamuna Bridge / Sadar Bazar throat: scissors crossovers restricted to 25 km/h"
    },
    "HWH": {
        "name": "Howrah Jn",
        "throat_distance_km": 4.8,
        "turnout_mps_kmph": 20.0,
        "diamond_crossings_count": 12,
        "base_throat_friction_min": 5.0,
        "crew_change_default": False,
        "loco_reversal_default": False,
        "description": "Howrah Route Relay Interlocking throat: complex terminal point ladder restricted to 20 km/h"
    },
    "CNB": {
        "name": "Kanpur Central",
        "throat_distance_km": 3.8,
        "turnout_mps_kmph": 30.0,
        "diamond_crossings_count": 6,
        "base_throat_friction_min": 3.2,
        "crew_change_default": True,   # frequent crew change
        "loco_reversal_default": False,
        "description": "Kanpur Central throat: heavy inter-zonal traffic crossing with mandatory crew check"
    },
    "DDU": {
        "name": "Pt. Deen Dayal Upadhyaya Jn",
        "throat_distance_km": 4.0,
        "turnout_mps_kmph": 30.0,
        "diamond_crossings_count": 7,
        "base_throat_friction_min": 3.5,
        "crew_change_default": True,   # crew change hub
        "loco_reversal_default": False,
        "description": "DDU East Yard / Flyover approach: freight corridor separation and crew change throat"
    }
}

class StationEngine:
    """
    Evaluates junction throat movement, platform occupancy holding, and dynamic dwell times.
    """

    @classmethod
    def evaluate_throat_friction(
        cls,
        station_code: str,
        is_terminal_approach: bool = False
    ) -> Dict[str, Any]:
        """
        Computes station-specific terminal throat movement time.
        Avoids constant +3.5m or +4.0m across all stations.
        """
        if station_code in JUNCTION_MICRO_GRAPHS:
            graph = JUNCTION_MICRO_GRAPHS[station_code]
            return {
                "friction_minutes": graph["base_throat_friction_min"],
                "turnout_mps": graph["turnout_mps_kmph"],
                "is_micro_graph": True,
                "description": graph["description"] + f" (+{graph['base_throat_friction_min']:.1f}m)"
            }

        if is_terminal_approach:
            # Minor terminal fallback
            return {
                "friction_minutes": 2.0,
                "turnout_mps": 30.0,
                "is_micro_graph": False,
                "description": f"{station_code} Terminal approach interlocking (+2.0m)"
            }

        # Regular intermediate through halt has standard sectional interlocking
        return {
            "friction_minutes": 0.0,
            "turnout_mps": 110.0,
            "is_micro_graph": False,
            "description": "Direct platform loop entry without throat congestion"
        }

    @classmethod
    def evaluate_platform_holding(
        cls,
        station_code: str,
        assigned_platform: str,
        train_ready_at_outer_time: datetime,
        occupying_train_no: Optional[str] = None,
        occupying_train_expected_dep: Optional[datetime] = None,
        interlocking_clearance_min: float = 3.0
    ) -> Dict[str, Any]:
        """
        Computes stage-separated platform holding delay at outer signal.
        Holding time = max(0, platform_free_time - train_ready_at_outer).
        """
        if not occupying_train_no or occupying_train_expected_dep is None:
            return {
                "is_held": False,
                "holding_delay_minutes": 0.0,
                "platform_number": assigned_platform,
                "description": f"Platform {assigned_platform} clear for direct berth entry (0.0m hold)"
            }

        ready_utc = to_utc(train_ready_at_outer_time)
        dep_utc = to_utc(occupying_train_expected_dep)
        clearance_time = dep_utc + timedelta(minutes=interlocking_clearance_min)

        if ready_utc < clearance_time:
            holding_sec = (clearance_time - ready_utc).total_seconds()
            holding_min = round(max(0.0, holding_sec / 60.0), 1)
            desc = (
                f"Platform {assigned_platform} occupied by Train {occupying_train_no}. "
                f"Held at Outer Home signal for {holding_min:.1f}m until route clearance."
            )
            return {
                "is_held": True,
                "holding_delay_minutes": holding_min,
                "platform_number": assigned_platform,
                "description": desc
            }

        return {
            "is_held": False,
            "holding_delay_minutes": 0.0,
            "platform_number": assigned_platform,
            "description": f"Platform {assigned_platform} vacated prior to arrival (0.0m hold)"
        }

    @classmethod
    def compute_dynamic_dwell(
        cls,
        station_code: str,
        scheduled_halt_min: float,
        current_arrival_delay_min: float,
        is_crew_change: bool = False,
        is_loco_reversal: bool = False,
        is_passenger_rush_peak: bool = False
    ) -> Dict[str, Any]:
        """
        Computes realistic halt duration and extension.
        Late-running trains have operational pressure to minimize dwell, while
        crew changes or loco reversals impose mandatory physical holding times.
        """
        dwell = scheduled_halt_min
        extensions = []

        if station_code in JUNCTION_MICRO_GRAPHS and JUNCTION_MICRO_GRAPHS[station_code]["crew_change_default"]:
            is_crew_change = True

        if is_loco_reversal:
            extra = 15.0
            dwell = max(dwell, extra)
            extensions.append("Mandatory locomotive reversal and brake continuity test (+15m)")

        if is_crew_change:
            extra = 4.0
            dwell += extra
            extensions.append("Guard and loco crew change handover (+4m)")

        if is_passenger_rush_peak:
            extra = 2.0
            dwell += extra
            extensions.append("Heavy peak boarding crowd (+2m)")

        # Operational compression if train is late (dispatchers expedite unboarding)
        if current_arrival_delay_min > 20.0 and scheduled_halt_min >= 5.0 and not is_loco_reversal:
            compression = min(2.0, scheduled_halt_min - 3.0)
            dwell = max(2.0, dwell - compression)

        extension_min = max(0.0, dwell - scheduled_halt_min)
        desc = "; ".join(extensions) if extensions else f"Normal station halt ({dwell:.0f}m)"

        return {
            "total_dwell_minutes": round(dwell, 1),
            "dwell_extension_minutes": round(extension_min, 1),
            "description": desc
        }

    @classmethod
    def evaluate_station_approach(
        cls,
        station_code: str,
        current_time: Optional[datetime] = None,
        train_number: str = "12301",
        train_priority: int = 1
    ) -> Dict[str, Any]:
        """
        Convenience classmethod for station approach evaluation.
        """
        throat = cls.evaluate_throat_friction(station_code, is_terminal_approach=(station_code in ("NDLS", "HWH", "CSMT", "MAS")))
        holding = cls.evaluate_platform_holding(station_code, assigned_platform="1", train_ready_at_outer_time=current_time or now_utc())

        return {
            "throat_delay_min": throat["friction_minutes"],
            "holding_delay_min": holding["holding_delay_minutes"],
            "platform_conflict": holding["is_held"],
            "reason_text": f"{throat['description']}; {holding['description']}"
        }

    @classmethod
    def predict_dwell_extension(
        cls,
        station_code: str,
        scheduled_dwell_min: float,
        is_delayed: bool = False,
        passenger_load_factor: float = 0.8
    ) -> Dict[str, Any]:
        """
        Convenience classmethod for dwell extension evaluation.
        """
        res = cls.compute_dynamic_dwell(
            station_code=station_code,
            scheduled_halt_min=scheduled_dwell_min,
            current_arrival_delay_min=25.0 if is_delayed else 0.0,
            is_passenger_rush_peak=(passenger_load_factor > 0.85)
        )
        return {
            "dwell_extension_min": res["dwell_extension_minutes"],
            "total_dwell_min": res["total_dwell_minutes"],
            "reason_text": res["description"]
        }
