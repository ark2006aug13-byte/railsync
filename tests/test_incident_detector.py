# tests/test_incident_detector.py
from datetime import datetime, timedelta
from pathlib import Path
import sys
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from engine.incident_detector import IncidentDetector


def test_incident_detector_confidence_levels():
    """Verify stop confidence scaling based on duration."""
    detector = IncidentDetector()
    assert detector._calculate_stop_confidence(120) == 0.3
    assert detector._calculate_stop_confidence(450) == 0.6
    assert detector._calculate_stop_confidence(900) == 0.9


def test_incident_detector_sudden_stop():
    """Verify detection of sustained sudden stop mid-journey."""
    detector = IncidentDetector()
    start_time = datetime(2026, 9, 15, 10, 0, 0)
    
    # 5 points running at 110 km/h (every 30s)
    telemetry = []
    for i in range(5):
        telemetry.append({
            'timestamp': start_time + timedelta(seconds=i * 30),
            'speed_kmh': 110.0,
            'lat': 26.0 + i * 0.01,
            'lon': 81.0 + i * 0.01
        })
    
    # Sudden drop to 0 km/h, held for 12 points (360 seconds > 300s threshold)
    stop_start = start_time + timedelta(seconds=150)
    for j in range(12):
        telemetry.append({
            'timestamp': stop_start + timedelta(seconds=j * 30),
            'speed_kmh': 0.0,
            'lat': 26.05,
            'lon': 81.05
        })

    anomalies = detector.detect_anomalies(telemetry)
    assert len(anomalies) >= 1
    types = [a['type'] for a in anomalies]
    assert 'SUDDEN_STOP' in types
    sudden_stop = next(a for a in anomalies if a['type'] == 'SUDDEN_STOP')
    assert sudden_stop['confidence'] >= 0.6
    assert 'Chain pulling' in sudden_stop['possible_causes']


def test_incident_detector_rapid_speed_drop():
    """Verify rapid deceleration drop (>50 km/h in <120s) detection."""
    detector = IncidentDetector()
    start_time = datetime(2026, 9, 15, 11, 0, 0)
    
    # Drops from 125 km/h to 35 km/h over 4 samples (90 seconds)
    speeds = [125.0, 120.0, 70.0, 35.0, 30.0, 30.0]
    telemetry = []
    for i, spd in enumerate(speeds):
        telemetry.append({
            'timestamp': start_time + timedelta(seconds=i * 20),
            'speed_kmh': spd,
            'lat': 25.5 + i * 0.005,
            'lon': 82.5 + i * 0.005
        })

    anomalies = detector.detect_anomalies(telemetry)
    types = [a['type'] for a in anomalies]
    assert 'RAPID_SPEED_DROP' in types
    drop_item = next(a for a in anomalies if a['type'] == 'RAPID_SPEED_DROP')
    assert drop_item['drop_amount'] >= 50.0
    assert drop_item['time_span_seconds'] <= 120.0


def test_incident_detector_normal_running():
    """Verify normal steady running generates no false positive anomalies."""
    detector = IncidentDetector()
    start_time = datetime(2026, 9, 15, 12, 0, 0)
    
    telemetry = []
    for i in range(10):
        telemetry.append({
            'timestamp': start_time + timedelta(seconds=i * 30),
            'speed_kmh': 115.0 + (i % 3) * 2.0,  # 115-119 km/h steady
            'lat': 25.0 + i * 0.01,
            'lon': 83.0 + i * 0.01
        })

    anomalies = detector.detect_anomalies(telemetry)
    assert len(anomalies) == 0
