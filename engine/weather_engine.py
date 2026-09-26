"""
engine/weather_engine.py
Weather Impact Prediction Engine for RailSync.
Integrates real-time weather data (OpenWeatherMap, Airport METAR, IMD/climatological fallback)
and calculates dynamic railway delay penalties for track sections.
"""
import asyncio
from datetime import datetime
import json
import logging
import math
import os
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import urllib.request
import urllib.error

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import WEATHER_SOURCES, STATION_METAR_MAP, STATIONS

logger = logging.getLogger(__name__)


class InMemoryCache:
    """
    Lightweight in-memory cache with TTL expiration.
    Used by default when an external Redis server is not configured.
    """
    def __init__(self):
        self._store: Dict[str, Tuple[str, float]] = {}

    async def get(self, key: str) -> Optional[str]:
        return self.get_sync(key)

    async def set(self, key: str, value: str, ex: int = 1800):
        self.set_sync(key, value, ex)

    def get_sync(self, key: str) -> Optional[str]:
        item = self._store.get(key)
        if item:
            val, expires_at = item
            if datetime.now().timestamp() < expires_at:
                return val
            del self._store[key]
        return None

    def set_sync(self, key: str, value: str, ex: int = 1800):
        self._store[key] = (value, datetime.now().timestamp() + ex)


class WeatherEngine:
    """
    Integrates weather data and calculates delay penalties for train sections.
    """

    def __init__(self, cache_backend=None, cache_ttl: int = 1800):
        # If cache_backend is 'redis', 'memory', 'inmemory', or None, use InMemoryCache
        if cache_backend is None or cache_backend in ('redis', 'memory', 'inmemory'):
            self.cache = InMemoryCache()
        else:
            self.cache = cache_backend

        self.ttl = cache_ttl  # 30 min cache for weather data
        self.fog_thresholds = {
            'severe': 50,    # meters - +15-20 min per 100km
            'heavy': 100,    # meters - +8-12 min per 100km
            'moderate': 200, # meters - +3-5 min per 100km
            'light': 500     # meters - +1-2 min per 100km
        }
        self.rain_thresholds = {
            'severe': 50,    # mm/hr - +10-15 min
            'heavy': 25,     # mm/hr - +5-8 min
            'moderate': 10,  # mm/hr - +2-4 min
            'light': 5       # mm/hr - +1-2 min
        }

    async def get_weather_for_section(self, section_waypoints: List[dict]) -> dict:
        """
        Get aggregated weather data for a track section (async).
        Returns worst-case conditions across the section.
        """
        if not section_waypoints:
            return self._get_climatological_fallback(25.0, 82.0)

        # Get weather for multiple points along the section (sample every 10th or at least start/mid/end)
        sampled = section_waypoints[::10] if len(section_waypoints) >= 10 else section_waypoints
        if not sampled:
            sampled = section_waypoints

        weather_points = []
        for waypoint in sampled:
            lat = waypoint.get('lat', waypoint.get('latitude', 0.0))
            lon = waypoint.get('lon', waypoint.get('lng', waypoint.get('longitude', 0.0)))
            weather = await self._fetch_weather(lat, lon)
            weather_points.append(weather)

        return self._aggregate_worst_case(weather_points)

    def get_weather_for_section_sync(self, section_waypoints: List[dict]) -> dict:
        """
        Synchronous wrapper for get_weather_for_section to integrate with synchronous engines.
        """
        if not section_waypoints:
            return self._get_climatological_fallback(25.0, 82.0)

        sampled = section_waypoints[::10] if len(section_waypoints) >= 10 else section_waypoints
        if not sampled:
            sampled = section_waypoints

        weather_points = []
        for waypoint in sampled:
            lat = waypoint.get('lat', waypoint.get('latitude', 0.0))
            lon = waypoint.get('lon', waypoint.get('lng', waypoint.get('longitude', 0.0)))
            weather = self._fetch_weather_sync(lat, lon)
            weather_points.append(weather)

        return self._aggregate_worst_case(weather_points)

    async def _fetch_weather(self, lat: float, lon: float) -> dict:
        """
        Fetch weather with fallback chain (async):
        1. Cache (Redis / In-memory)
        2. OpenWeatherMap API
        3. Airport METAR (aviationweather.gov)
        4. Climatological Fallback
        """
        cache_key = f"weather:{lat:.2f}:{lon:.2f}"

        # Try cache first
        try:
            cached = await self.cache.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            logger.debug(f"Cache get error: {e}")

        # Try OpenWeatherMap
        owm_key = WEATHER_SOURCES['openweathermap'].get('api_key')
        if owm_key:
            try:
                weather = await self._fetch_openweathermap(lat, lon, owm_key)
                await self.cache.set(cache_key, json.dumps(weather), ex=self.ttl)
                return weather
            except Exception as e:
                logger.warning(f"OpenWeatherMap failed: {e}")

        # Try Airport METAR
        try:
            weather = self._fetch_metar_weather(lat, lon)
            if weather and not weather.get('error'):
                await self.cache.set(cache_key, json.dumps(weather), ex=self.ttl)
                return weather
        except Exception as e:
            logger.warning(f"Airport METAR fetch failed: {e}")

        # Fallback to Climatological Fallback
        weather = self._get_climatological_fallback(lat, lon)
        try:
            await self.cache.set(cache_key, json.dumps(weather), ex=self.ttl)
        except Exception:
            pass
        return weather

    def _fetch_weather_sync(self, lat: float, lon: float) -> dict:
        """
        Synchronous weather fetching through the fallback chain.
        """
        cache_key = f"weather:{lat:.2f}:{lon:.2f}"

        # 1. Try cache
        if hasattr(self.cache, "get_sync"):
            cached = self.cache.get_sync(cache_key)
            if cached:
                return json.loads(cached)

        # 2. Try OpenWeatherMap if key is present
        owm_key = WEATHER_SOURCES['openweathermap'].get('api_key')
        if owm_key:
            try:
                weather = self._fetch_openweathermap_sync(lat, lon, owm_key)
                if hasattr(self.cache, "set_sync"):
                    self.cache.set_sync(cache_key, json.dumps(weather), ex=self.ttl)
                return weather
            except Exception as e:
                logger.warning(f"OpenWeatherMap sync failed: {e}")

        # 3. Try Airport METAR (free public data)
        try:
            weather = self._fetch_metar_weather(lat, lon)
            if weather and not weather.get('error'):
                if hasattr(self.cache, "set_sync"):
                    self.cache.set_sync(cache_key, json.dumps(weather), ex=self.ttl)
                return weather
        except Exception as e:
            logger.warning(f"Airport METAR sync failed: {e}")

        # 4. Climatological fallback
        fallback = self._get_climatological_fallback(lat, lon)
        if hasattr(self.cache, "set_sync"):
            self.cache.set_sync(cache_key, json.dumps(fallback), ex=self.ttl)
        return fallback

    async def _fetch_openweathermap(self, lat: float, lon: float, api_key: str) -> dict:
        """Asynchronous call to OpenWeatherMap REST API."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._fetch_openweathermap_sync, lat, lon, api_key)

    def _fetch_openweathermap_sync(self, lat: float, lon: float, api_key: str) -> dict:
        """Synchronous call to OpenWeatherMap REST API."""
        endpoint = WEATHER_SOURCES['openweathermap']['endpoint']
        url = f"{endpoint}?lat={lat}&lon={lon}&appid={api_key}&units=metric"
        req = urllib.request.Request(url, headers={"User-Agent": "RailSync/2.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))

        visibility_m = float(data.get('visibility', 10000))
        temp_c = float(data.get('main', {}).get('temp', 28.0))
        wind_kmph = float(data.get('wind', {}).get('speed', 0.0)) * 3.6
        rain_info = data.get('rain', {})
        rain_mm = float(rain_info.get('1h', rain_info.get('3h', 0.0)))
        desc = data.get('weather', [{}])[0].get('description', 'Clear').capitalize()

        return {
            'source': 'openweathermap',
            'latitude': lat,
            'longitude': lon,
            'visibility': visibility_m,
            'precipitation_mm_hr': rain_mm,
            'temperature_celsius': temp_c,
            'wind_speed_kmph': round(wind_kmph, 1),
            'description': desc,
            'timestamp': datetime.now().isoformat()
        }

    def _find_nearest_icao(self, lat: float, lon: float) -> str:
        """Finds the nearest Indian corridor airport ICAO code for given coordinate."""
        corridor_airports = {
            "VIDP": (28.56, 77.10),   # Delhi (NDLS, ANVT)
            "VILK": (26.76, 80.88),   # Lucknow (CNB corridor)
            "VEBN": (25.45, 82.86),   # Varanasi (DDU, PRYJ)
            "VEGY": (24.74, 84.94),   # Gaya (GAYA)
            "VEPT": (25.59, 85.09),   # Patna (PNBE, BGP)
            "VECC": (22.65, 88.45),   # Kolkata (HWH, BWN, ASN)
            "VEGT": (26.11, 91.59),   # Guwahati (KYQ)
        }
        best_icao = "VIDP"
        min_dist = float('inf')
        for icao, (a_lat, a_lon) in corridor_airports.items():
            d = math.hypot(lat - a_lat, lon - a_lon)
            if d < min_dist:
                min_dist = d
                best_icao = icao
        return best_icao

    def _fetch_metar_weather(self, lat: float, lon: float) -> dict:
        """
        Fetches live real-world visibility and atmospheric data from aviationweather.gov METAR.
        Converts nautical / aviation units to standard metric units.
        """
        icao = self._find_nearest_icao(lat, lon)
        endpoint = WEATHER_SOURCES['airport_metar']['endpoint']
        url = f"{endpoint}?ids={icao}&format=json"

        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 RailSync/2.0"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            raw_text = resp.read().decode('utf-8')
            items = json.loads(raw_text)
            if not items:
                raise ValueError(f"No METAR report for ICAO {icao}")
            d = items[0]

        # Convert visibility from statute miles to meters (1 statute mile = 1609.34 meters)
        visib_miles = float(d.get('visib', 6.0)) if d.get('visib') is not None else 6.0
        visib_meters = round(visib_miles * 1609.34, 0)

        # Temperature in Celsius
        temp_c = float(d.get('temp', 28)) if d.get('temp') is not None else 28.0

        # Wind speed in knots converted to km/h (1 knot = 1.852 km/h)
        wspd_knots = float(d.get('wspd', 5)) if d.get('wspd') is not None else 5.0
        wspd_kmph = round(wspd_knots * 1.852, 1)

        # Weather string interpretation (e.g. 'HZ', 'FG', '-RA', '+TSRA')
        wx_str = d.get('wxString', '') or ''
        precip_mm = 0.0
        if 'TSRA' in wx_str or '+RA' in wx_str:
            precip_mm = 30.0  # Heavy rain / thunderstorm
        elif 'RA' in wx_str:
            precip_mm = 8.0   # Moderate rain
        elif '-RA' in wx_str or 'DZ' in wx_str:
            precip_mm = 2.0   # Light drizzle

        desc = f"METAR {icao}: {wx_str or 'Fair'}, Vis {int(visib_meters)}m, {temp_c:.0f}°C"

        return {
            'source': f"airport_metar:{icao}",
            'latitude': lat,
            'longitude': lon,
            'visibility': visib_meters,
            'precipitation_mm_hr': precip_mm,
            'temperature_celsius': temp_c,
            'wind_speed_kmph': wspd_kmph,
            'description': desc,
            'timestamp': datetime.now().isoformat()
        }

    def _get_climatological_fallback(self, lat: float, lon: float) -> dict:
        """
        Tier 3 Climatological fallback model when all network services are unreachable.
        Incorporates Indian Railways seasonal Gangetic Plain patterns.
        """
        now = datetime.now()
        month = now.month

        # Winter Gangetic Plain Fog Belt (Nov - Feb, KM 500-1400 corridor, lat 24-29)
        if month in [11, 12, 1, 2] and 24.0 <= lat <= 29.0:
            visib_meters = 250.0  # Dense winter fog
            temp_c = 11.0
            precip_mm = 0.0
            desc = "Dense Gangetic Fog Belt (Climatological Model)"
        elif month in [6, 7, 8, 9]:
            # Monsoon Season
            visib_meters = 2500.0
            temp_c = 29.0
            precip_mm = 12.0  # Monsoon rain
            desc = "Monsoon Rain & Wet Rail Conditions (Climatological Model)"
        elif month in [4, 5]:
            # Peak Summer
            visib_meters = 4000.0
            temp_c = 43.0     # High ambient temperature
            precip_mm = 0.0
            desc = "Summer Heat Wave (Climatological Model)"
        else:
            visib_meters = 5000.0
            temp_c = 26.0
            precip_mm = 0.0
            desc = "Clear Seasonal Running (Climatological Model)"

        return {
            'source': 'climatological_fallback',
            'latitude': lat,
            'longitude': lon,
            'visibility': visib_meters,
            'precipitation_mm_hr': precip_mm,
            'temperature_celsius': temp_c,
            'wind_speed_kmph': 12.0,
            'description': desc,
            'timestamp': now.isoformat()
        }

    def _aggregate_worst_case(self, weather_points: List[dict]) -> dict:
        """
        Aggregates multiple weather samples along a track section to find the worst-case condition.
        """
        if not weather_points:
            return self._get_climatological_fallback(25.0, 82.0)

        min_vis = float('inf')
        max_rain = 0.0
        max_temp = -100.0
        max_wind = 0.0
        sources = set()
        descs = []

        for wp in weather_points:
            vis = wp.get('visibility')
            if vis is not None and vis < min_vis:
                min_vis = vis
            rain = wp.get('precipitation_mm_hr')
            if rain is not None and rain > max_rain:
                max_rain = rain
            temp = wp.get('temperature_celsius')
            if temp is not None and temp > max_temp:
                max_temp = temp
            wind = wp.get('wind_speed_kmph')
            if wind is not None and wind > max_wind:
                max_wind = wind
            if wp.get('source'):
                sources.add(wp['source'])
            if wp.get('description'):
                descs.append(wp['description'])

        worst_desc = descs[0] if descs else "Aggregated Section Weather"

        return {
            'source': ",".join(sources) if sources else "aggregated",
            'visibility': min_vis if min_vis != float('inf') else 5000.0,
            'precipitation_mm_hr': max_rain,
            'temperature_celsius': max_temp if max_temp != -100.0 else 28.0,
            'wind_speed_kmph': max_wind,
            'description': worst_desc,
            'samples_count': len(weather_points)
        }

    def calculate_weather_penalty(self, weather_data: dict, section_distance_km: float) -> dict:
        """
        Calculate delay penalty based on weather conditions.
        
        Returns:
            {
                'fog_delay_minutes': float,
                'rain_delay_minutes': float,
                'heat_delay_minutes': float,
                'total_weather_delay': float,
                'primary_factor': str,
                'confidence': float
            }
        """
        fog_delay = 0.0
        rain_delay = 0.0
        heat_delay = 0.0
        
        # Fog penalty calculation
        visibility = weather_data.get('visibility')
        if visibility is not None:
            if visibility < self.fog_thresholds['severe']:
                fog_delay = (section_distance_km / 100.0) * 17.5  # avg of 15-20 min
            elif visibility < self.fog_thresholds['heavy']:
                fog_delay = (section_distance_km / 100.0) * 10.0
            elif visibility < self.fog_thresholds['moderate']:
                fog_delay = (section_distance_km / 100.0) * 4.0
            elif visibility < self.fog_thresholds['light']:
                fog_delay = (section_distance_km / 100.0) * 1.5
        
        # Rain penalty calculation
        precipitation = weather_data.get('precipitation_mm_hr')
        if precipitation is not None:
            if precipitation > self.rain_thresholds['severe']:
                rain_delay = (section_distance_km / 100.0) * 12.5
            elif precipitation > self.rain_thresholds['heavy']:
                rain_delay = (section_distance_km / 100.0) * 6.5
            elif precipitation > self.rain_thresholds['moderate']:
                rain_delay = (section_distance_km / 100.0) * 3.0
            elif precipitation > self.rain_thresholds['light']:
                rain_delay = (section_distance_km / 100.0) * 1.5
        
        # Heat penalty (track buckling risk)
        temp = weather_data.get('temperature_celsius')
        if temp and temp > 50:  # Rail temperature can be 15-20°C higher than air
            heat_delay = (section_distance_km / 100.0) * 5.0
        
        total = fog_delay + rain_delay + heat_delay
        
        # Determine primary factor
        factors = {
            'fog': fog_delay,
            'rain': rain_delay,
            'heat': heat_delay
        }
        primary = max(factors, key=factors.get) if max(factors.values()) > 0 else 'none'
        
        return {
            'fog_delay_minutes': round(fog_delay, 1),
            'rain_delay_minutes': round(rain_delay, 1),
            'heat_delay_minutes': round(heat_delay, 1),
            'total_weather_delay': round(total, 1),
            'primary_factor': primary,
            'confidence': 0.85 if visibility or precipitation else 0.5
        }


# Global singleton instance
weather_engine = WeatherEngine()
