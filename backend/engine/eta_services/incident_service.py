"""
backend/engine/eta_services/incident_service.py
Incident Management & Traffic Controller Manual Override Service (FIX 6 & FIX 7).
Handles active operational disruptions, cautionary orders, manual ETA overrides by controllers,
slack recovery freeze enforcement, and audit logging.
"""
from datetime import datetime
from typing import Dict, Any, List, Optional
import uuid
from models.eta_models import Incident, IncidentTypeEnum, AuditLog, UserRoleEnum
from engine.eta_config import to_utc, now_utc, format_ist_iso

class IncidentService:
    """
    Manages operational incidents and manual controller overrides.
    """
    _incidents: Dict[str, Incident] = {}
    _audit_logs: List[AuditLog] = []

    @classmethod
    def register_incident(
        cls,
        incident_type: IncidentTypeEnum,
        severity: str = "HIGH",
        delay_impact_min: float = 15.0,
        train_number: Optional[str] = None,
        station_code: Optional[str] = None,
        segment_id: Optional[str] = None,
        freeze_recovery: bool = True,
        notes: Optional[str] = None,
        manual_eta_override: Optional[datetime] = None,
        reported_by: str = "CONTROLLER",
        actor_role: UserRoleEnum = UserRoleEnum.CONTROLLER
    ) -> Incident:
        """
        Creates and activates an incident in the network.
        """
        incident_id = f"INC-{uuid.uuid4().hex[:8].upper()}"
        start_time = now_utc()
        
        override_utc = to_utc(manual_eta_override) if manual_eta_override else None

        incident = Incident(
            incident_id=incident_id,
            train_number=train_number,
            station_code=station_code,
            segment_id=segment_id,
            type=incident_type,
            severity=severity,
            start_time=start_time,
            delay_impact_min=delay_impact_min,
            freeze_recovery=freeze_recovery,
            active=True,
            notes=notes,
            manual_eta_override=override_utc,
            reported_by=reported_by
        )

        cls._incidents[incident_id] = incident

        # Audit log creation
        cls._audit_logs.append(AuditLog(
            actor_id=reported_by,
            role=actor_role.value if hasattr(actor_role, "value") else str(actor_role),
            action="CREATE_INCIDENT",
            entity_type="INCIDENT",
            entity_id=incident_id,
            before_value=None,
            after_value=incident.model_dump(mode="json"),
            reason=f"Incident registered: {incident_type.value} impact +{delay_impact_min}m"
        ))

        return incident

    @classmethod
    def set_manual_override(
        cls,
        train_number: str,
        station_code: str,
        manual_eta: datetime,
        reason: str,
        actor_id: str = "CONTROLLER_01",
        actor_role: UserRoleEnum = UserRoleEnum.CONTROLLER
    ) -> Incident:
        """
        Allows an authorized railway controller to manually override an ETA.
        """
        manual_eta_utc = to_utc(manual_eta)

        # Check if an existing override exists for this train and station
        existing = cls.get_override_for_train_station(train_number, station_code)
        if existing:
            before_dict = existing.model_dump(mode="json")
            existing.manual_eta_override = manual_eta_utc
            existing.notes = reason
            cls._audit_logs.append(AuditLog(
                actor_id=actor_id,
                role=actor_role.value if hasattr(actor_role, "value") else str(actor_role),
                action="UPDATE_MANUAL_OVERRIDE",
                entity_type="INCIDENT",
                entity_id=existing.incident_id,
                before_value=before_dict,
                after_value=existing.model_dump(mode="json"),
                reason=reason
            ))
            return existing

        incident_id = f"OVR-{uuid.uuid4().hex[:8].upper()}"
        incident = Incident(
            incident_id=incident_id,
            train_number=train_number,
            station_code=station_code,
            type=IncidentTypeEnum.UNSCHEDULED_STOP,
            severity="MEDIUM",
            start_time=now_utc(),
            delay_impact_min=0.0,
            freeze_recovery=True,
            manual_eta_override=manual_eta_utc,
            active=True,
            notes=reason,
            reported_by=actor_id
        )
        cls._incidents[incident_id] = incident

        cls._audit_logs.append(AuditLog(
            actor_id=actor_id,
            role=actor_role.value if hasattr(actor_role, "value") else str(actor_role),
            action="SET_MANUAL_OVERRIDE",
            entity_type="INCIDENT",
            entity_id=incident_id,
            before_value=None,
            after_value=incident.model_dump(mode="json"),
            reason=reason
        ))
        return incident

    @classmethod
    def resolve_incident(cls, incident_id: str, actor_id: str = "CONTROLLER_01") -> Optional[Incident]:
        """
        Marks an active incident as resolved.
        """
        incident = cls._incidents.get(incident_id)
        if not incident:
            return None
        
        before_dict = incident.model_dump(mode="json")
        incident.active = False
        incident.expected_end_time = now_utc()

        cls._audit_logs.append(AuditLog(
            actor_id=actor_id,
            role="CONTROLLER",
            action="RESOLVE_INCIDENT",
            entity_type="INCIDENT",
            entity_id=incident_id,
            before_value=before_dict,
            after_value=incident.model_dump(mode="json"),
            reason="Incident cleared and restored to normal operation"
        ))
        return incident

    @classmethod
    def get_active_incidents_for_train(
        cls,
        train_number: str,
        upcoming_stations: Optional[List[str]] = None,
        segment_id: Optional[str] = None
    ) -> List[Incident]:
        """
        Retrieves all active incidents that impact a given train, its current segment, or upcoming stations.
        """
        active = []
        upcoming_set = set(upcoming_stations or [])

        for inc in cls._incidents.values():
            if not inc.active:
                continue
            
            # Direct train match
            if inc.train_number == train_number:
                active.append(inc)
                continue

            # Station match on upcoming route
            if inc.station_code and inc.station_code in upcoming_set:
                active.append(inc)
                continue

            # Segment match
            if segment_id and inc.segment_id == segment_id:
                active.append(inc)
                continue

        return active

    @classmethod
    def get_override_for_train_station(cls, train_number: str, station_code: str) -> Optional[Incident]:
        """
        Checks if there is an active manual ETA override for this specific train and station.
        """
        for inc in cls._incidents.values():
            if inc.active and inc.train_number == train_number and inc.station_code == station_code:
                if inc.manual_eta_override:
                    return inc
        return None

    @classmethod
    def get_audit_logs(cls, limit: int = 50) -> List[AuditLog]:
        return cls._audit_logs[-limit:]

    @classmethod
    def clear_all(cls):
        """Used in test suites to reset in-memory state."""
        cls._incidents.clear()
        cls._audit_logs.clear()
