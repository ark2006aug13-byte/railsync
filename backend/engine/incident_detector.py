# engine/incident_detector.py
from datetime import datetime, timedelta
import math
from pathlib import Path
import sys
from typing import List, Dict, Optional, Tuple, Any
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import STATIONS


class IncidentDetector:
    """
    Detects anomalous train behavior that may indicate incidents.
    """
    
    def __init__(self):
        self.incident_thresholds = {
            'sudden_stop_speed': 5,  # km/h
            'sudden_stop_duration': 300,  # seconds (5 min)
            'unscheduled_stop_distance_from_station': 2000,  # meters
            'speed_drop_threshold': 50,  # km/h drop in 60 seconds
        }
    
    def detect_anomalies(self, train_telemetry: List[Dict]) -> List[Dict]:
        """
        Analyze telemetry data to detect potential incidents.
        
        Args:
            train_telemetry: List of telemetry points with timestamp, lat, lon, speed
        
        Returns:
            List of detected anomalies with confidence scores
        """
        if not train_telemetry or len(train_telemetry) < 2:
            return []
        
        anomalies = []
        
        # Convert to numpy for efficient processing
        timestamps = np.array([t['timestamp'] for t in train_telemetry])
        speeds = np.array([t.get('speed_kmh', t.get('speed', 0.0)) for t in train_telemetry], dtype=float)
        positions = np.array([
            (t.get('lat', t.get('latitude', 0.0)), t.get('lon', t.get('lng', t.get('longitude', 0.0))))
            for t in train_telemetry
        ])
        
        # Detect sudden stops
        sudden_stops = self._detect_sudden_stops(timestamps, speeds, positions)
        anomalies.extend(sudden_stops)
        
        # Detect speed drops
        speed_drops = self._detect_speed_drops(timestamps, speeds)
        anomalies.extend(speed_drops)
        
        # Detect unscheduled stops
        unscheduled_stops = self._detect_unscheduled_stops(positions, timestamps, speeds)
        anomalies.extend(unscheduled_stops)
        
        return anomalies
    
    def _detect_sudden_stops(self, timestamps, speeds, positions) -> List[Dict]:
        """Detect trains that suddenly stop between stations."""
        incidents = []
        i = 0
        while i < len(speeds) - 1:
            # Check if speed dropped to near zero
            if speeds[i] > 20 and speeds[i+1] < self.incident_thresholds['sudden_stop_speed']:
                # Check if this is sustained
                stop_start = i + 1
                stop_duration = 0
                stop_end = i + 1
                
                for j in range(i + 1, min(i + 50, len(speeds))):
                    if speeds[j] < self.incident_thresholds['sudden_stop_speed']:
                        stop_duration = (timestamps[j] - timestamps[stop_start]).total_seconds()
                        stop_end = j
                    else:
                        break
                
                if stop_duration >= self.incident_thresholds['sudden_stop_duration']:
                    ts = timestamps[stop_start]
                    ts_str = ts.isoformat() if hasattr(ts, 'isoformat') else str(ts)
                    pos_list = [float(positions[stop_start][0]), float(positions[stop_start][1])]
                    incidents.append({
                        'type': 'SUDDEN_STOP',
                        'timestamp': ts_str,
                        'position': pos_list,
                        'confidence': float(self._calculate_stop_confidence(stop_duration)),
                        'possible_causes': [
                            'Chain pulling',
                            'Cattle on track',
                            'Signal red',
                            'Technical failure',
                            'Medical emergency'
                        ],
                        'severity': 'HIGH' if stop_duration > 600 else 'MEDIUM'
                    })
                    i = stop_end
            i += 1
        
        return incidents
    
    def _detect_speed_drops(self, timestamps, speeds) -> List[Dict]:
        """Detect rapid speed drops that may indicate TSR or incident."""
        incidents = []
        i = 0
        while i < len(speeds) - 5:
            # Check 5-point moving average for stability
            initial_speed = float(np.mean(speeds[i:i+2]))
            final_speed = float(np.mean(speeds[i+3:i+5]))
            
            speed_drop = initial_speed - final_speed
            
            if speed_drop > self.incident_thresholds['speed_drop_threshold']:
                time_span = float((timestamps[i+4] - timestamps[i]).total_seconds())
                
                if time_span < 120:  # Drop in less than 2 minutes
                    ts = timestamps[i]
                    ts_str = ts.isoformat() if hasattr(ts, 'isoformat') else str(ts)
                    incidents.append({
                        'type': 'RAPID_SPEED_DROP',
                        'timestamp': ts_str,
                        'initial_speed': round(initial_speed, 1),
                        'final_speed': round(final_speed, 1),
                        'drop_amount': round(speed_drop, 1),
                        'time_span_seconds': round(time_span, 1),
                        'confidence': min(1.0, round(float(speed_drop) / 100.0, 2)),
                        'possible_causes': [
                            'Emergency TSR',
                            'Signal caution',
                            'Track obstruction',
                            'Weather emergency'
                        ],
                        'severity': 'HIGH' if speed_drop > 80 else 'MEDIUM'
                    })
                    i += 4
            i += 1
        
        return incidents

    def _detect_unscheduled_stops(self, positions, timestamps, speeds) -> List[Dict]:
        """Detect trains stopped mid-section far from scheduled station platforms."""
        incidents = []
        min_dist_from_station_m = self.incident_thresholds['unscheduled_stop_distance_from_station']
        
        i = 0
        n = len(speeds)
        while i < n:
            if speeds[i] < self.incident_thresholds['sudden_stop_speed']:
                start_idx = i
                while i < n and speeds[i] < self.incident_thresholds['sudden_stop_speed']:
                    i += 1
                stop_duration = float((timestamps[i-1] - timestamps[start_idx]).total_seconds())
                
                # If stopped for sustained duration (>= 180s)
                if stop_duration >= 180:
                    lat, lon = float(positions[start_idx][0]), float(positions[start_idx][1])
                    min_dist_m = float('inf')
                    nearest_stn = "UNKNOWN"
                    for stn in STATIONS:
                        dy = (lat - stn['lat']) * 111000.0
                        dx = (lon - stn['lng']) * 96000.0
                        dist_m = math.hypot(dx, dy)
                        if dist_m < min_dist_m:
                            min_dist_m = dist_m
                            nearest_stn = stn['code']
                    
                    if min_dist_m > min_dist_from_station_m:
                        ts = timestamps[start_idx]
                        ts_str = ts.isoformat() if hasattr(ts, 'isoformat') else str(ts)
                        incidents.append({
                            'type': 'UNSCHEDULED_MID_SECTION_STOP',
                            'timestamp': ts_str,
                            'position': [lat, lon],
                            'duration_seconds': round(stop_duration, 1),
                            'distance_from_station_meters': round(min_dist_m, 1),
                            'nearest_station': nearest_stn,
                            'confidence': min(0.95, round(0.5 + (min_dist_m / 10000.0), 2)),
                            'possible_causes': [
                                'Alarm chain pull (ACP)',
                                'Loco trip / overhead OHE power failure',
                                'Track defect / rail fracture',
                                'Outer signal detention'
                            ],
                            'severity': 'HIGH' if stop_duration > 600 else 'MEDIUM'
                        })
            else:
                i += 1
        return incidents
    
    def _calculate_stop_confidence(self, duration_seconds: float) -> float:
        """Calculate confidence that a stop is an incident vs scheduled."""
        if duration_seconds < 300:
            return 0.3  # Could be signal
        elif duration_seconds < 600:
            return 0.6  # Likely incident
        else:
            return 0.9  # Almost certainly incident
