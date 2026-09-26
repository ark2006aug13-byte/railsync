# tests/test_weather_engine.py
from pathlib import Path
import sys
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from engine.weather_engine import WeatherEngine


class TestWeatherEngine:
    @pytest.fixture
    def weather_engine(self):
        return WeatherEngine(cache_backend='memory')
    
    async def test_severe_fog_penalty(self, weather_engine):
        """Test severe fog (visibility < 50m) gives 15-20 min delay per 100km"""
        weather = {'visibility': 30, 'precipitation_mm_hr': 0, 'temperature_celsius': 15}
        penalty = weather_engine.calculate_weather_penalty(weather, 100)
        
        assert 15 <= penalty['fog_delay_minutes'] <= 20
        assert penalty['primary_factor'] == 'fog'
    
    async def test_heavy_rain_penalty(self, weather_engine):
        """Test heavy rain (>25mm/hr) gives 5-8 min delay per 100km"""
        weather = {'visibility': 1000, 'precipitation_mm_hr': 30, 'temperature_celsius': 20}
        penalty = weather_engine.calculate_weather_penalty(weather, 100)
        
        assert 5 <= penalty['rain_delay_minutes'] <= 8
        assert penalty['primary_factor'] == 'rain'
    
    async def test_combined_weather_effects(self, weather_engine):
        """Test fog + rain together"""
        weather = {'visibility': 80, 'precipitation_mm_hr': 15, 'temperature_celsius': 18}
        penalty = weather_engine.calculate_weather_penalty(weather, 200)
        
        assert penalty['fog_delay_minutes'] > 0
        assert penalty['rain_delay_minutes'] > 0
        assert penalty['total_weather_delay'] == (
            penalty['fog_delay_minutes'] + penalty['rain_delay_minutes'] + penalty['heat_delay_minutes']
        )
    
    async def test_no_weather_data_graceful_handling(self, weather_engine):
        """Test system handles missing weather data gracefully"""
        weather = {'error': True, 'visibility': None, 'precipitation_mm_hr': None}
        penalty = weather_engine.calculate_weather_penalty(weather, 100)
        
        assert penalty['total_weather_delay'] == 0
        assert penalty['primary_factor'] == 'none'
        assert penalty['confidence'] == 0.5

    async def test_get_weather_for_section(self, weather_engine):
        """Test section-wide spatial weather sampling and worst-case aggregation"""
        waypoints = [
            {'lat': 26.4499, 'lon': 80.3319},
            {'lat': 27.1767, 'lon': 78.0081},
            {'lat': 27.8974, 'lon': 78.0880}
        ]
        sec_weather = await weather_engine.get_weather_for_section(waypoints)
        assert 'visibility' in sec_weather
        assert 'precipitation_mm_hr' in sec_weather
        assert sec_weather['visibility'] > 0

    def test_climatological_fallback_details(self, weather_engine):
        """Test deterministic climatological model values"""
        fb = weather_engine._get_climatological_fallback(26.45, 80.33)
        assert fb['source'] == 'climatological_fallback'
        assert fb['visibility'] > 0
        assert 'temperature_celsius' in fb

    def test_find_nearest_icao(self, weather_engine):
        """Test finding nearest airport ICAO for weather telemetry"""
        icao_delhi = weather_engine._find_nearest_icao(28.6139, 77.2090)
        assert icao_delhi == 'VIDP'

        icao_kolkata = weather_engine._find_nearest_icao(22.5726, 88.3639)
        assert icao_kolkata == 'VECC'

    async def test_in_memory_cache_cycle(self, weather_engine):
        """Test storing and retrieving weather snapshots from memory cache"""
        import json
        snapshot = {
            'source': 'test_cache',
            'visibility': 150.0,
            'precipitation_mm_hr': 5.0,
            'temperature_celsius': 22.0,
            'timestamp': '2026-09-15T12:00:00'
        }
        await weather_engine.cache.set('weather:26.45:80.33', json.dumps(snapshot), ex=1800)
        cached_raw = await weather_engine.cache.get('weather:26.45:80.33')
        assert cached_raw is not None
        cached = json.loads(cached_raw)
        assert cached['source'] == 'test_cache'
        assert cached['visibility'] == 150.0


