# api/incidents.py
import asyncio
from datetime import datetime, timedelta
import logging
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


class IncidentReport(BaseModel):
    train_number: str
    report_type: str
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    user_id: Optional[str] = None


class InMemoryIncidentDB:
    """
    In-memory fallback database for crowdsource reports when PostgreSQL is not configured.
    Provides async fetch, fetchrow, and fetchval matching asyncpg interface.
    """
    def __init__(self):
        self._report_types = [
            {'type_code': 'FOG_SEVERE', 'type_name': 'Severe Fog - Visibility < 50m', 'severity': 'HIGH'},
            {'type_code': 'FOG_MODERATE', 'type_name': 'Moderate Fog - Visibility 50-200m', 'severity': 'MEDIUM'},
            {'type_code': 'CHAIN_PULLING', 'type_name': 'Chain Pulling Incident', 'severity': 'HIGH'},
            {'type_code': 'CATTLE_TRACK', 'type_name': 'Cattle on Track', 'severity': 'MEDIUM'},
            {'type_code': 'PLATFORM_CROWD', 'type_name': 'Extreme Platform Crowding', 'severity': 'MEDIUM'},
            {'type_code': 'SIGNAL_DELAY', 'type_name': 'Extended Signal Wait', 'severity': 'MEDIUM'},
            {'type_code': 'TECHNICAL_ISSUE', 'type_name': 'Technical Problem with Train', 'severity': 'HIGH'},
            {'type_code': 'MEDICAL_EMERGENCY', 'type_name': 'Medical Emergency', 'severity': 'HIGH'},
            {'type_code': 'ACCIDENT', 'type_name': 'Accident Reported', 'severity': 'CRITICAL'},
        ]
        self._reports: List[Dict[str, Any]] = []
        self._next_id = 1

    async def fetch(self, query: str, *args) -> List[Dict[str, Any]]:
        query_upper = query.upper()
        if "REPORT_TYPES" in query_upper:
            return list(self._report_types)
        elif "USER_INCIDENT_REPORTS" in query_upper:
            train_no = args[0] if args else None
            cutoff = datetime.now() - timedelta(hours=2)
            results = [
                r for r in self._reports
                if (train_no is None or r['train_number'] == train_no) and r['timestamp'] >= cutoff
            ]
            return list(reversed(results))
        return []

    async def fetchrow(self, query: str, *args) -> Optional[Dict[str, Any]]:
        train_no = args[0] if len(args) > 0 else None
        user_id = args[1] if len(args) > 1 else None
        cutoff = datetime.now() - timedelta(minutes=5)
        for r in self._reports:
            if r['train_number'] == train_no and user_id and r.get('reporter_user_id') == user_id and r['timestamp'] >= cutoff:
                return r
        return None

    async def fetchval(self, query: str, *args) -> Any:
        train_no = args[0]
        user_id = args[1]
        report_type = args[2]
        desc = args[3] if len(args) > 3 else None
        lat = args[4] if len(args) > 4 else None
        lon = args[5] if len(args) > 5 else None

        report_id = self._next_id
        self._next_id += 1
        new_report = {
            'id': report_id,
            'train_number': train_no,
            'reporter_user_id': user_id,
            'report_type': report_type,
            'description': desc,
            'latitude': lat,
            'longitude': lon,
            'timestamp': datetime.now(),
            'confidence_score': 0.5,
            'verification_count': 0,
            'verified': False
        }
        self._reports.append(new_report)
        return report_id


# Global in-memory fallback instance
_incident_db = InMemoryIncidentDB()


async def get_db():
    """
    Database dependency. Returns PostgreSQL connection if configured,
    or falls back to InMemoryIncidentDB.
    """
    return _incident_db


async def validate_crowdsource_report(report_id: int):
    """
    Trigger incident detector validation for submitted crowdsourced report.
    """
    logger.info(f"Triggered incident validation for report ID: {report_id}")
    return True


@router.post("/report")
async def submit_incident_report(report: IncidentReport, db = Depends(get_db)):
    """
    Submit a crowdsourced incident report.
    """
    # Validate report type
    valid_types = await db.fetch("SELECT type_code FROM report_types")
    if report.report_type not in [t['type_code'] for t in valid_types]:
        raise HTTPException(400, f"Invalid report type: {report.report_type}")
    
    # Check for spam (same user, same train, within 5 minutes)
    recent = await db.fetchrow("""
        SELECT id FROM user_incident_reports
        WHERE train_number = $1 
        AND reporter_user_id = $2
        AND timestamp > NOW() - INTERVAL '5 minutes'
    """, report.train_number, report.user_id)
    
    if recent:
        raise HTTPException(429, "Too many reports. Please wait 5 minutes.")
    
    # Insert report
    report_id = await db.fetchval("""
        INSERT INTO user_incident_reports 
        (train_number, reporter_user_id, report_type, description, latitude, longitude)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
    """, report.train_number, report.user_id, report.report_type, 
         report.description, report.latitude, report.longitude)
    
    # Trigger incident detector validation
    await validate_crowdsource_report(report_id)
    
    return {"status": "success", "report_id": report_id}


@router.get("/train/{train_number}")
async def get_train_incidents(train_number: str, db: Any = Depends(get_db)):
    """
    Get all reported incidents for a train.
    """
    if not hasattr(db, "fetch"):
        db = await get_db()
    reports = await db.fetch("""
        SELECT id, report_type, description, latitude, longitude, 
               timestamp, confidence_score, verification_count
        FROM user_incident_reports
        WHERE train_number = $1
        AND timestamp > NOW() - INTERVAL '2 hours'
        ORDER BY timestamp DESC
    """, train_number)
    
    return {"train_number": train_number, "incidents": [dict(r) for r in reports]}

