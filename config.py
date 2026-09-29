"""
Central Configuration for Train ETA Prediction System MVP
Corridor: Train 12301 Howrah Rajdhani (HWH -> NDLS)
"""
import math
import os
from pathlib import Path
from typing import Dict, List, Any

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "train_history.db"
ML_DIR = BASE_DIR / "ml"
ARTIFACTS_DIR = ML_DIR / "artifacts"
DASHBOARD_DIR = BASE_DIR / "dashboard"

TRAIN_NUMBER = "12301"
TRAIN_NAME = "Howrah Rajdhani Express"
SCHEDULED_DEPARTURE_TIME = "16:50:00"  # IST daily

STATIONS: List[Dict[str, Any]] = [
    {"code": "HWH",  "name": "Howrah Jn",                  "km": 0,    "halt_min": 0,  "lat": 22.5830, "lng": 88.3426, "mps": 110, "platform": 9},
    {"code": "BWN",  "name": "Barddhaman Jn",              "km": 100,  "halt_min": 2,  "lat": 23.2324, "lng": 87.8615, "mps": 130, "platform": 1},
    {"code": "ASN",  "name": "Asansol Jn",                 "km": 225,  "halt_min": 2,  "lat": 23.6889, "lng": 86.9661, "mps": 130, "platform": 3},
    {"code": "DHN",  "name": "Dhanbad Jn",                 "km": 259,  "halt_min": 5,  "lat": 23.7957, "lng": 86.4304, "mps": 110, "platform": 2},
    {"code": "GAYA", "name": "Gaya Jn",                    "km": 412,  "halt_min": 5,  "lat": 24.8037, "lng": 85.0006, "mps": 110, "platform": 1},
    {"code": "DDU",  "name": "Pt. Deen Dayal Upadhyaya Jn", "km": 585,  "halt_min": 10, "lat": 25.2785, "lng": 83.1235, "mps": 130, "platform": 3},
    {"code": "PRYJ", "name": "Prayagraj Jn",               "km": 764,  "halt_min": 5,  "lat": 25.4497, "lng": 81.8282, "mps": 130, "platform": 2},
    {"code": "CNB",  "name": "Kanpur Central",             "km": 979,  "halt_min": 5,  "lat": 26.4547, "lng": 80.3507, "mps": 130, "platform": 1},
    {"code": "NDLS", "name": "New Delhi",                  "km": 1451, "halt_min": 0,  "lat": 28.6424, "lng": 77.2195, "mps": 130, "platform": 12},
]

SECTIONS: List[Dict[str, Any]] = [
    {"section_id": "HWH-BWN",  "from_code": "HWH",  "to_code": "BWN",  "distance_km": 100, "scheduled_runtime_min": 75,  "mps": 110},
    {"section_id": "BWN-ASN",  "from_code": "BWN",  "to_code": "ASN",  "distance_km": 125, "scheduled_runtime_min": 90,  "mps": 130},
    {"section_id": "ASN-DHN",  "from_code": "ASN",  "to_code": "DHN",  "distance_km": 34,  "scheduled_runtime_min": 30,  "mps": 110},
    {"section_id": "DHN-GAYA", "from_code": "DHN",  "to_code": "GAYA", "distance_km": 153, "scheduled_runtime_min": 130, "mps": 110},
    {"section_id": "GAYA-DDU", "from_code": "GAYA", "to_code": "DDU", "distance_km": 173, "scheduled_runtime_min": 125, "mps": 130},
    {"section_id": "DDU-PRYJ", "from_code": "DDU",  "to_code": "PRYJ", "distance_km": 179, "scheduled_runtime_min": 125, "mps": 130},
    {"section_id": "PRYJ-CNB", "from_code": "PRYJ", "to_code": "CNB", "distance_km": 215, "scheduled_runtime_min": 140, "mps": 130},
    {"section_id": "CNB-NDLS", "from_code": "CNB",  "to_code": "NDLS", "distance_km": 472, "scheduled_runtime_min": 295, "mps": 130},
]

STATION_MAP: Dict[str, Dict[str, Any]] = {s["code"]: s for s in STATIONS}
SECTION_MAP: Dict[str, Dict[str, Any]] = {sec["section_id"]: sec for sec in SECTIONS}

# ---------------------------------------------------------------------------
# Traction & Locomotive Profiles
# ---------------------------------------------------------------------------
LOCOMOTIVE_PROFILES: Dict[str, Dict[str, Any]] = {
    "WAP-7": {
        "type": "Electric",
        "acceleration": 0.35,  # m/s^2
        "deceleration": 0.60,  # m/s^2
        "mps_kmph": 130.0,
    }
}
DEFAULT_LOCOMOTIVE: str = "WAP-7"

# ---------------------------------------------------------------------------
# Train Priority Hierarchy
# ---------------------------------------------------------------------------
TRAIN_PRIORITY_HIERARCHY: Dict[str, Dict[str, Any]] = {
    "12301": {"name": "Howrah Rajdhani", "priority": 1},
    "12302": {"name": "Kolkata Rajdhani", "priority": 1},
    "12367": {"name": "Vikramshila Express", "priority": 2},
    "12876": {"name": "Neelachal Express", "priority": 3},
    "15657": {"name": "Brahmaputra Mail", "priority": 3},
}

# ---------------------------------------------------------------------------
# Track Restrictions, Bottlenecks & Operational Realities
# ---------------------------------------------------------------------------
TERMINAL_THROATS: Dict[str, Dict[str, Any]] = {
    "NDLS": {
        "station_code": "NDLS",
        "station_name": "New Delhi",
        "approach_km_length": 5.0,
        "speed_cap_kmph": 25.0,
        "friction_delay_min": 4.0,
        "reason": "Diamond crossings, points interlocking & NDLS throat speed restricted to 25 km/h",
    },
    "ANVT": {
        "station_code": "ANVT",
        "station_name": "Anand Vihar Terminal",
        "approach_km_length": 4.0,
        "speed_cap_kmph": 25.0,
        "friction_delay_min": 3.5,
        "reason": "East Delhi terminal throat and scissors crossover speed restriction",
    },
    "KYQ": {
        "station_code": "KYQ",
        "station_name": "Kamakhya Jn",
        "approach_km_length": 5.0,
        "speed_cap_kmph": 20.0,
        "friction_delay_min": 4.5,
        "reason": "Brahmaputra approach single-line choke and yard points",
    },
    "HWH": {
        "station_code": "HWH",
        "station_name": "Howrah Jn",
        "approach_km_length": 4.5,
        "speed_cap_kmph": 20.0,
        "friction_delay_min": 4.0,
        "reason": "Howrah yard turnouts and platform throat",
    },
    "CNB": {
        "station_code": "CNB",
        "station_name": "Kanpur Central",
        "approach_km_length": 3.5,
        "speed_cap_kmph": 30.0,
        "friction_delay_min": 2.5,
        "reason": "CNB East/West yard throat interlocking",
    },
    "PRYJ": {
        "station_code": "PRYJ",
        "station_name": "Prayagraj Jn",
        "approach_km_length": 3.0,
        "speed_cap_kmph": 30.0,
        "friction_delay_min": 2.0,
        "reason": "Naini-Prayagraj junction routing",
    },
    "LKO": {
        "station_code": "LKO",
        "station_name": "Lucknow Charbagh",
        "approach_km_length": 4.0,
        "speed_cap_kmph": 25.0,
        "friction_delay_min": 3.0,
        "reason": "Charbagh yard crossovers & speed restricted to 25 km/h",
    },
    "BSB": {
        "station_code": "BSB",
        "station_name": "Varanasi Jn",
        "approach_km_length": 3.5,
        "speed_cap_kmph": 25.0,
        "friction_delay_min": 2.5,
        "reason": "Varanasi yard points & interlocking approach",
    },
    "MMCT": {
        "station_code": "MMCT",
        "station_name": "Mumbai Central",
        "approach_km_length": 5.0,
        "speed_cap_kmph": 20.0,
        "friction_delay_min": 4.0,
        "reason": "Mumbai suburban interlocking & yard throat speed cap 20 km/h",
    },
    "PURI": {
        "station_code": "PURI",
        "station_name": "Puri",
        "approach_km_length": 3.0,
        "speed_cap_kmph": 25.0,
        "friction_delay_min": 2.0,
        "reason": "Terminal loop platform turnouts",
    },
    "DBRG": {
        "station_code": "DBRG",
        "station_name": "Dibrugarh",
        "approach_km_length": 3.5,
        "speed_cap_kmph": 25.0,
        "friction_delay_min": 2.5,
        "reason": "Upper Assam branch points interlocking",
    },
    "RKMP": {
        "station_code": "RKMP",
        "station_name": "Rani Kamalapati",
        "approach_km_length": 3.0,
        "speed_cap_kmph": 30.0,
        "friction_delay_min": 2.0,
        "reason": "World-class terminal yard interlocking",
    },
}

TSR_ZONES: List[Dict[str, Any]] = [
    {
        "id": "TSR-PRYJ-CNB-01",
        "section_id": "PRYJ-CNB",
        "start_km": 840.0,
        "end_km": 844.0,
        "speed_cap_kmph": 30.0,
        "reason": "Ballast cleaning & deep screening (Divisional Caution Order)",
        "division": "Prayagraj (NCR)"
    },
    {
        "id": "TSR-DDU-PRYJ-01",
        "section_id": "DDU-PRYJ",
        "start_km": 680.0,
        "end_km": 683.0,
        "speed_cap_kmph": 45.0,
        "reason": "Girder bridge bearing inspection (Divisional Caution Order)",
        "division": "Danapur / Pt Deen Dayal Upadhyaya (ECR)"
    },
    {
        "id": "TSR-CNB-TDL-01",
        "section_id": "CNB-NDLS",
        "start_km": 1120.0,
        "end_km": 1125.0,
        "speed_cap_kmph": 30.0,
        "reason": "Points machine interlocking overhaul (Divisional Caution Order)",
        "division": "Agra / Prayagraj (NCR)"
    }
]

SECTION_SLACK_BUFFERS: Dict[str, Dict[str, Any]] = {
    "CNB-NDLS": {"distance_km": 472, "scheduled_min": 295, "mps_130_min": 225, "slack_buffer_min": 70.0, "max_recoverable_min": 35.0},
    "PRYJ-CNB": {"distance_km": 215, "scheduled_min": 140, "mps_130_min": 105, "slack_buffer_min": 35.0, "max_recoverable_min": 18.0},
    "DDU-PRYJ": {"distance_km": 179, "scheduled_min": 125, "mps_130_min": 88,  "slack_buffer_min": 37.0, "max_recoverable_min": 15.0},
    "GAYA-DDU": {"distance_km": 173, "scheduled_min": 125, "mps_130_min": 85,  "slack_buffer_min": 40.0, "max_recoverable_min": 15.0},
    "DHN-GAYA": {"distance_km": 153, "scheduled_min": 130, "mps_130_min": 92,  "slack_buffer_min": 38.0, "max_recoverable_min": 12.0},
    "BWN-ASN":  {"distance_km": 125, "scheduled_min": 90,  "mps_130_min": 65,  "slack_buffer_min": 25.0, "max_recoverable_min": 10.0},
}

RTIS_CONFIG: Dict[str, Any] = {
    "ping_frequency_seconds": 30,
    "max_staleness_seconds": 120,
    "dead_reckoning_mps_discount": 0.85,
    "telemetry_modes": {
        "LIVE_GPS": "RTIS_HIGH_PRECISION_GPS (ISRO Satellite)",
        "DEAD_RECKONED": "MANUAL_STATION_LOG (Dead-Reckoned Dynamic Position)"
    }
}

WEATHER_SOURCES: Dict[str, Dict[str, Any]] = {
    'openweathermap': {
        'api_key': os.getenv('OPENWEATHER_API_KEY'),
        'endpoint': 'https://api.openweathermap.org/data/2.5/weather',
        'forecast_endpoint': 'https://api.openweathermap.org/data/2.5/forecast',
        'cost': 'freemium',
        'reliability': 'high'
    },
    'imd_india': {
        'endpoint': 'https://mausam.imd.gov.in',
        'cost': 'free',
        'reliability': 'medium',
        'notes': 'Scrape carefully, check robots.txt'
    },
    'airport_metar': {
        'endpoint': 'https://aviationweather.gov/api/data/metar',
        'cost': 'free',
        'reliability': 'high',
        'use_for': 'visibility data'
    }
}

STATION_METAR_MAP: Dict[str, str] = {
    "HWH": "VECC",   # Kolkata Bose Intl
    "BWN": "VECC",
    "ASN": "VECC",
    "DHN": "VEGY",
    "GAYA": "VEGY",  # Gaya Airport
    "DDU": "VEBN",   # Varanasi Shastri Intl
    "PRYJ": "VEBN",  # Varanasi / Prayagraj approach
    "CNB": "VILK",   # Lucknow Chaudhary Charan Singh Intl
    "NDLS": "VIDP",  # Delhi Indira Gandhi Intl
    "ANVT": "VIDP",  # Delhi Indira Gandhi Intl
    "KYQ": "VEGT",   # Guwahati Bordoloi Intl
    "BGP": "VEPT",   # Patna Airport
}

TRACK_RESTRICTIONS: Dict[str, Any] = {
    "FOG_BELT": {
        "name": "Gangetic Plain Fog Belt",
        "start_km": 500.0,
        "end_km": 1400.0,
        "speed_cap_kmph": 60.0,
        "active_months": [11, 12, 1, 2],
        "visibility_threshold_m": 300,
    },
    "TERMINAL_THROAT": {
        "station_code": "NDLS",
        "start_km": 1446.0,
        "end_km": 1451.0,
        "speed_cap_kmph": 25.0,
        "friction_delay_min": 4.0,
        "reason": "Diamond crossings & interlocking throat",
    },
    "TERMINAL_THROATS": TERMINAL_THROATS,
    "TSR_ZONES": TSR_ZONES,
    "SECTION_SLACK_BUFFERS": SECTION_SLACK_BUFFERS,
    "RTIS_CONFIG": RTIS_CONFIG,
}

# Preceding/Conflicting Train Configuration (Train 12876 Neelachal Express)
LEADING_TRAIN_CONFIG: Dict[str, Any] = {
    "train_no": "12876",
    "name": "Neelachal Express",
    "priority_level": 3,  # Priority 3 (lower priority than Rajdhani priority 1)
    "scheduled_ahead_min": 28,  # Typically 25-35 minutes ahead on the corridor
    "shared_platforms": {
        "BWN": 1,
        "ASN": 3,
        "DHN": 2,
        "GAYA": 1,
        "DDU": 3,
        "PRYJ": 2,
        "CNB": 1,
        "NDLS": 12
    }
}

# Safety buffer required between preceding train departure & following train arrival on same platform
INTERLOCKING_CLEARANCE_MIN: float = 4.0

# Automatic Block Signalling Headway Thresholds (in km)
HEADWAY_THRESHOLDS: Dict[str, float] = {
    "GREEN": 10.0,         # Gap > 10 km: Clear green aspect, full MPS
    "DOUBLE_YELLOW": 6.0,   # 6.0 km < Gap <= 10 km: Caution, speed capped (+3m delay)
    "YELLOW": 3.0,          # 3.0 km < Gap <= 6 km: Attention, speed capped (+7m delay)
    "RED": 0.0             # Gap <= 3.0 km: Danger, stop until block clears
}

# Authentic high-density railway track waypoints tracing the Indian Railways Grand Chord mainline
DETAILED_TRACK_WAYPOINTS = [
    [22.5830, 88.3426],  # Howrah (HWH)
    [22.6245, 88.3512],  # Lilluah
    [22.7523, 88.3429],  # Serampore
    [22.9234, 88.3756],  # Bandel Jn
    [23.0812, 88.2412],  # Boinchi
    [23.1812, 88.1123],  # Memari
    [23.2324, 87.8615],  # Barddhaman Jn (BWN)
    [23.3321, 87.6912],  # Galsi
    [23.4478, 87.4623],  # Panagarh
    [23.5012, 87.3123],  # Durgapur
    [23.5823, 87.1892],  # Andal Jn
    [23.6123, 87.1123],  # Raniganj
    [23.6889, 86.9661],  # Asansol Jn (ASN)
    [23.7234, 86.8790],  # Sitarampur Jn
    [23.7312, 86.8523],  # Kulti
    [23.7467, 86.8123],  # Barakar
    [23.7623, 86.7234],  # Mugma
    [23.7812, 86.5812],  # Pradhankhanta
    [23.7957, 86.4304],  # Dhanbad Jn (DHN)
    [23.8123, 86.3523],  # Tetulmari
    [23.8714, 86.1558],  # NSCB Gomoh Jn
    [23.9785, 86.0331],  # Parasnath
    [24.0812, 85.9212],  # Chaube
    [24.1678, 85.8335],  # Hazaribagh Road
    [24.3123, 85.7423],  # Parsabad
    [24.4695, 85.5947],  # Koderma Jn
    [24.5234, 85.4912],  # Gujhandi (Ghat Section Entry)
    [24.5823, 85.3412],  # Gurpa (Ghat Summit)
    [24.6723, 85.1923],  # Paharpur
    [24.8037, 85.0006],  # Gaya Jn (GAYA)
    [24.8423, 84.8823],  # Kastha
    [24.8723, 84.7823],  # Guraru
    [24.8212, 84.6423],  # Rafiganj
    [24.8423, 84.3912],  # Anugraha Narayan Road
    [24.9125, 84.1842],  # Dehri-on-Sone
    [24.9542, 84.0289],  # Sasaram Jn
    [25.0423, 83.6123],  # Kudra
    [25.0623, 83.5712],  # Bhabua Road
    [25.1223, 83.4312],  # Durgauti
    [25.2123, 83.2712],  # Chandauli Majhwar
    [25.2785, 83.1235],  # Pt. Deen Dayal Upadhyaya Jn (DDU)
    [25.2623, 83.0812],  # Vyasnagar
    [25.1323, 82.8912],  # Chunar Jn
    [25.1462, 82.5694],  # Mirzapur
    [25.1623, 82.5012],  # Vindhyachal
    [25.2423, 82.2612],  # Manda Road
    [25.2923, 82.0912],  # Meja Road
    [25.3923, 81.8712],  # Naini Jn
    [25.4497, 81.8282],  # Prayagraj Jn (PRYJ)
    [25.4523, 81.7912],  # Subedarganj
    [25.4823, 81.6512],  # Manauri
    [25.5523, 81.5012],  # Bharwari
    [25.6523, 81.3212],  # Sirathu
    [25.7723, 81.1112],  # Khaga
    [25.9284, 80.8128],  # Fatehpur
    [26.0423, 80.6512],  # Malwan
    [26.1523, 80.5212],  # Bindki Road
    [26.3523, 80.4412],  # Ruma
    [26.4023, 80.4012],  # Chakeri
    [26.4547, 80.3507],  # Kanpur Central (CNB)
    [26.4723, 80.2412],  # Panki Dham
    [26.4923, 79.9112],  # Rura
    [26.5623, 79.7412],  # Jhinjhak
    [26.6023, 79.4612],  # Phaphund
    [26.7423, 79.2312],  # Bharthana
    [26.7768, 79.0232],  # Etawah Jn (ETW)
    [26.8823, 78.8912],  # Jaswantnagar
    [27.1023, 78.5812],  # Shikohabad Jn
    [27.1523, 78.4012],  # Firozabad
    [27.2075, 78.2435],  # Tundla Jn (TDL)
    [27.3223, 78.1812],  # Barhan Jn
    [27.4623, 78.1312],  # Jalesar Road
    [27.5923, 78.0512],  # Hathras Jn
    [27.8974, 78.0772],  # Aligarh Jn (ALJN)
    [28.0223, 77.9612],  # Somna
    [28.2523, 77.8512],  # Khurja Jn
    [28.4523, 77.6912],  # Sikandrabad
    [28.5523, 77.5612],  # Dadri
    [28.6678, 77.4338],  # Ghaziabad Jn (GZB)
    [28.6712, 77.3712],  # Sahibabad Jn
    [28.6512, 77.3112],  # Anand Vihar
    [28.6278, 77.2456],  # Tilak Bridge
    [28.6323, 77.2312],  # Shivaji Bridge
    [28.6424, 77.2195],  # New Delhi (NDLS)
]

SCHEDULED_TIMELINE: Dict[str, Dict[str, int]] = {}
current_offset = 0
for i, stn in enumerate(STATIONS):
    code = stn["code"]
    if i == 0:
        SCHEDULED_TIMELINE[code] = {"arr_min": 0, "dep_min": 0}
    else:
        sec = SECTIONS[i - 1]
        arr_offset = current_offset + sec["scheduled_runtime_min"]
        dep_offset = arr_offset + stn["halt_min"]
        SCHEDULED_TIMELINE[code] = {"arr_min": arr_offset, "dep_min": dep_offset}
        current_offset = dep_offset

# Map of Station code to its exact index in DETAILED_TRACK_WAYPOINTS
STATION_WAYPOINT_INDICES: Dict[str, int] = {
    "HWH": 0, "BWN": 6, "ASN": 12, "DHN": 18,
    "GAYA": 29, "DDU": 40, "PRYJ": 48, "CNB": 59, "NDLS": 83
}

def haversine_dist_km(c1: List[float], c2: List[float]) -> float:
    """Computes great-circle distance between two [lat, lng] coordinates in kilometers."""
    lat1, lon1 = math.radians(c1[0]), math.radians(c1[1])
    lat2, lon2 = math.radians(c2[0]), math.radians(c2[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
    return 6371.0 * 2.0 * math.asin(math.sqrt(a))

def interpolate_section_track(from_code: str, to_code: str, fraction: float) -> List[float]:
    """
    Interpolates along the authentic railway track geometry between two stations.
    Returns [lat, lng] smoothly tracing the actual track curves instead of a straight chord.
    """
    idx_start = STATION_WAYPOINT_INDICES.get(from_code, 0)
    idx_end = STATION_WAYPOINT_INDICES.get(to_code, len(DETAILED_TRACK_WAYPOINTS) - 1)
    sub_pts = DETAILED_TRACK_WAYPOINTS[idx_start : idx_end + 1]
    
    if len(sub_pts) == 1 or fraction <= 0.0:
        return sub_pts[0]
    if fraction >= 1.0:
        return sub_pts[-1]

    cum_dists = [0.0]
    for i in range(len(sub_pts) - 1):
        cum_dists.append(cum_dists[-1] + haversine_dist_km(sub_pts[i], sub_pts[i + 1]))

    total_d = cum_dists[-1]
    target_d = fraction * total_d

    for i in range(len(sub_pts) - 1):
        if cum_dists[i] <= target_d <= cum_dists[i + 1]:
            seg_len = cum_dists[i + 1] - cum_dists[i]
            alpha = (target_d - cum_dists[i]) / seg_len if seg_len > 0 else 0.0
            lat = sub_pts[i][0] + (sub_pts[i + 1][0] - sub_pts[i][0]) * alpha
            lng = sub_pts[i][1] + (sub_pts[i + 1][1] - sub_pts[i][1]) * alpha
            return [round(lat, 5), round(lng, 5)]

    return sub_pts[-1]

def get_coords_at_km(km: float) -> List[float]:
    """
    Returns exact [lat, lng] along the Grand Chord corridor geometry for any km position.
    """
    if km <= 0:
        return [STATIONS[0]["lat"], STATIONS[0]["lng"]]
    if km >= STATIONS[-1]["km"]:
        return [STATIONS[-1]["lat"], STATIONS[-1]["lng"]]
    for i in range(len(STATIONS) - 1):
        if STATIONS[i]["km"] <= km <= STATIONS[i + 1]["km"]:
            span = STATIONS[i + 1]["km"] - STATIONS[i]["km"]
            frac = (km - STATIONS[i]["km"]) / span if span > 0 else 0.0
            return interpolate_section_track(STATIONS[i]["code"], STATIONS[i + 1]["code"], frac)
    return [STATIONS[-1]["lat"], STATIONS[-1]["lng"]]


