# models/network_state.py
from dataclasses import dataclass, field
from datetime import datetime
import math
from typing import List, Dict, Optional


@dataclass
class TrainPosition:
    train_number: str
    latitude: float
    longitude: float
    speed_kmh: float
    timestamp: datetime
    section_id: str
    delay_minutes: int
    train_type: str  # RAJDHANI, EXPRESS, PASSENGER, GOODS
    priority: int  # 1=highest, 7=lowest
    direction: str  # UP or DOWN
    last_station: str
    next_station: str


@dataclass
class SectionOccupancy:
    section_id: str
    trains: List[TrainPosition]
    max_capacity: int  # Based on block sections
    congestion_level: str  # CLEAR, MODERATE, HIGH, SEVERE
    
    @property
    def occupancy_percentage(self) -> float:
        if self.max_capacity <= 0:
            return 0.0
        return (len(self.trains) / self.max_capacity) * 100


@dataclass
class NetworkState:
    timestamp: datetime
    sections: Dict[str, SectionOccupancy]
    total_trains: int
    
    def get_congestion_ahead(self, current_train: TrainPosition, lookahead_km: float = 50) -> Dict:
        """
        Get all trains ahead of current train within lookahead distance.
        """
        ahead_trains = []
        
        for section in self.sections.values():
            for train in section.trains:
                # Check if train is ahead and same direction
                if (train.direction == current_train.direction and
                    self._is_ahead(current_train, train, lookahead_km)):
                    distance_ahead = self._calculate_distance(current_train, train)
                    ahead_trains.append({
                        'train': train,
                        'distance_km': distance_ahead,
                        'speed_diff': current_train.speed_kmh - train.speed_kmh
                    })
        
        # Sort by distance
        ahead_trains.sort(key=lambda x: x['distance_km'])
        risk = self._calculate_congestion_risk(ahead_trains)
        return {
            'count': len(ahead_trains),
            'trains': ahead_trains,
            'slowest_ahead': min(ahead_trains, key=lambda x: x['train'].speed_kmh) if ahead_trains else None,
            'congestion_risk': risk,
            'risk_level': risk
        }

    def _calculate_distance(self, train1: TrainPosition, train2: TrainPosition) -> float:
        """
        Calculates great-circle distance between two trains in kilometers using Haversine formula.
        """
        R = 6371.0  # Earth radius in kilometers
        lat1 = math.radians(train1.latitude)
        lon1 = math.radians(train1.longitude)
        lat2 = math.radians(train2.latitude)
        lon2 = math.radians(train2.longitude)
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat / 2.0) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2.0) ** 2
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return round(R * c, 2)

    def _is_ahead(self, current_train: TrainPosition, other_train: TrainPosition, lookahead_km: float) -> bool:
        """
        Determines whether other_train is ahead of current_train in the line direction
        and within the specified lookahead distance.
        """
        if current_train.train_number == other_train.train_number:
            return False

        dist = self._calculate_distance(current_train, other_train)
        if dist <= 0.05 or dist > lookahead_km:
            return False

        direction = current_train.direction.upper().strip()
        # In Indian Railways:
        # UP trains travel towards Delhi (Northern Railway / Headquarters, longitude decreasing from ~88°E to ~77°E)
        # DOWN trains travel away from Delhi (towards East / South / Howrah, longitude increasing)
        if direction == "UP":
            if abs(other_train.longitude - current_train.longitude) >= 0.01:
                return other_train.longitude < current_train.longitude
            return other_train.latitude >= current_train.latitude
        elif direction == "DOWN":
            if abs(other_train.longitude - current_train.longitude) >= 0.01:
                return other_train.longitude > current_train.longitude
            return other_train.latitude <= current_train.latitude

        return dist <= lookahead_km

    def _calculate_congestion_risk(self, ahead_trains: List[Dict]) -> str:
        """
        Calculates congestion risk level based on convoy proximity and relative closing speed.
        """
        if not ahead_trains:
            return "CLEAR"

        closest = ahead_trains[0]
        min_dist = closest['distance_km']
        speed_diff = closest['speed_diff']

        # Proximity and closing speed evaluation
        if min_dist <= 5.0 or (min_dist <= 10.0 and speed_diff > 25.0):
            return "SEVERE"
        elif min_dist <= 12.0 or speed_diff > 35.0 or len(ahead_trains) >= 3:
            return "HIGH"
        elif min_dist <= 25.0 or speed_diff > 15.0 or len(ahead_trains) >= 2:
            return "MODERATE"
        else:
            return "LOW"
