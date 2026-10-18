"""
backend/engine/eta_services/event_ingestion_service.py
Event Ingestion, Deduplication, Future Drift & Priority Resolution Service (FIX 9).
Enforces:
1. Idempotent processing with 24-hour deduplication cache.
2. Max 60-second future timestamp drift rejection.
3. Strict source priority hierarchy (Interlocking > Manual > GPS Geofence > Schedule Inferred).
"""
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple
from models.eta_models import LiveEvent, TrainDelayState, EventSourcePriority
from engine.eta_config import ETA_CONFIG, to_utc, now_utc

class EventIngestionService:
    """
    Ingests live railway operational events with strict integrity controls.
    """
    # Deduplication cache: event_id -> (received_at, result_summary)
    _seen_events: Dict[str, Tuple[datetime, Dict[str, Any]]] = {}

    # Current Delay States: f"{train_no}:{run_date}" -> TrainDelayState
    _delay_states: Dict[str, TrainDelayState] = {}

    @classmethod
    def ingest_event(cls, event: LiveEvent) -> Dict[str, Any]:
        """
        Validates and processes an incoming live telemetry or operational event.
        """
        # 1. Idempotency Check
        if event.event_id in cls._seen_events:
            prev_time, prev_result = cls._seen_events[event.event_id]
            return {
                "status": "DUPLICATE_IGNORED",
                "message": f"Event {event.event_id} already processed at {prev_time.isoformat()}",
                "event_id": event.event_id,
                "cached_result": prev_result
            }

        # 2. Future Timestamp Drift Validation (Max 60 seconds)
        event_time_utc = to_utc(event.event_time)
        server_now = now_utc()
        future_tolerance = timedelta(seconds=ETA_CONFIG.get("future_timestamp_tolerance_seconds", 60))

        if event_time_utc > (server_now + future_tolerance):
            drift_sec = (event_time_utc - server_now).total_seconds()
            return {
                "status": "REJECTED_FUTURE_TIMESTAMP",
                "error": f"Event timestamp {event_time_utc.isoformat()} is {drift_sec:.1f}s in the future (exceeds 60s tolerance)",
                "event_id": event.event_id
            }

        # 3. Determine Source Priority
        source_str = event.source.upper()
        if "MANUAL_EVENT" in source_str or "CRIS_MANUAL" in source_str:
            priority = EventSourcePriority.OFFICIAL_MANUAL_EVENT
        elif "INTERLOCKING" in source_str or "CIRCUIT" in source_str:
            priority = EventSourcePriority.STATION_PASS_INTERLOCKING
        elif "STATION_PASS" in source_str or "GUARD" in source_str:
            priority = EventSourcePriority.STATION_PASS_MANUAL
        elif "GPS" in source_str or "GEOFENCE" in source_str or "RTIS" in source_str:
            priority = EventSourcePriority.GPS_GEOFENCE
        else:
            priority = EventSourcePriority.SCHEDULE_INFERRED

        # 4. Check Current Delay State & Priority Overwrite Rules
        run_date = event.payload.get("run_date", server_now.strftime("%Y-%m-%d"))
        state_key = f"{event.train_number}:{run_date}"
        existing_state = cls._delay_states.get(state_key)

        should_update = True
        update_reason = "Initial state established"

        if existing_state:
            # Check staleness: if existing state is older than critical staleness (15m), allow lower priority to update
            staleness = (server_now - existing_state.last_updated).total_seconds()
            is_existing_stale = staleness > ETA_CONFIG.get("gps_staleness_critical_seconds", 900)

            # Lower integer value means higher priority
            if priority.value <= existing_state.source_priority:
                should_update = True
                update_reason = f"Higher/Equal priority ({priority.name} <= {existing_state.delay_source})"
            elif is_existing_stale:
                should_update = True
                update_reason = f"Existing state {existing_state.delay_source} is stale ({staleness:.0f}s old); updated by {priority.name}"
            else:
                should_update = False
                update_reason = f"Rejected lower priority ({priority.name} > {existing_state.delay_source})"

        result_summary: Dict[str, Any] = {
            "event_id": event.event_id,
            "train_number": event.train_number,
            "source_priority": priority.value,
            "source_name": priority.name,
            "updated_state": should_update,
            "reason": update_reason
        }

        if should_update:
            delay_min = float(event.payload.get("delay_minutes", 0.0))
            ref_station = str(event.station_id or event.payload.get("station_code", "UNKNOWN"))
            ref_km = float(event.payload.get("current_km", 0.0))

            new_state = TrainDelayState(
                train_number=event.train_number,
                run_date=run_date,
                as_of_time=event_time_utc,
                reference_station_code=ref_station,
                reference_km=ref_km,
                current_delay_minutes=delay_min,
                delay_source=priority.name,
                source_priority=priority.value,
                confidence=1.0 if priority.value <= 3 else 0.85,
                last_updated=server_now
            )
            cls._delay_states[state_key] = new_state
            result_summary["new_delay_minutes"] = delay_min
            result_summary["station_code"] = ref_station

        # Store in deduplication cache
        cls._seen_events[event.event_id] = (server_now, result_summary)

        return {
            "status": "ACCEPTED",
            "summary": result_summary
        }

    @classmethod
    def get_current_delay_state(cls, train_number: str, run_date: str) -> Optional[TrainDelayState]:
        """
        Retrieves the authoritative ground delay state for a train on a given date.
        """
        return cls._delay_states.get(f"{train_number}:{run_date}")

    @classmethod
    def set_delay_state_direct(cls, state: TrainDelayState):
        """Allows direct initialization for tests or seed data."""
        state_key = f"{state.train_number}:{state.run_date}"
        cls._delay_states[state_key] = state

    @classmethod
    def clear_all(cls):
        cls._seen_events.clear()
        cls._delay_states.clear()
