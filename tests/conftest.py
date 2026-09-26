import asyncio
import inspect
import pytest


def pytest_pyfunc_call(pyfuncitem):
    """
    Ensures async def test functions execute seamlessly using asyncio.run()
    when external pytest plugins are disabled or not installed.
    """
    if inspect.iscoroutinefunction(pyfuncitem.obj):
        funcargs = {arg: pyfuncitem.funcargs[arg] for arg in pyfuncitem._fixtureinfo.argnames}
        asyncio.run(pyfuncitem.obj(**funcargs))
        return True
    return None


@pytest.fixture
def client():
    """FastAPI TestClient shared fixture."""
    from fastapi.testclient import TestClient
    from api.main import app
    return TestClient(app)


@pytest.fixture
def weather_engine():
    """WeatherEngine instance shared fixture."""
    from engine.weather_engine import WeatherEngine
    return WeatherEngine(cache_backend='memory')


@pytest.fixture
def network_tracker():
    """NetworkTracker instance shared fixture."""
    from engine.network_tracker import NetworkTracker
    return NetworkTracker()


@pytest.fixture
def incident_detector():
    """IncidentDetector instance shared fixture."""
    from engine.incident_detector import IncidentDetector
    return IncidentDetector()


@pytest.fixture
def train_predictor():
    """TrainPredictor instance shared fixture."""
    from engine.predictor import TrainPredictor
    from engine.network_tracker import NetworkTracker
    return TrainPredictor(network_tracker=NetworkTracker())


@pytest.fixture
def sample_train():
    """Sample train telemetry dictionary."""
    return {
        'train_number': '12301',
        'speed': 110.0,
        'delay': 15,
        'type': 'RAJDHANI',
        'priority': 1,
        'direction': 'UP'
    }


@pytest.fixture
def sample_section():
    """Sample track section dictionary."""
    return {
        'section_id': 'CNB-ALJN',
        'distance_km': 200.0,
        'current_lat': 26.4499,
        'current_lon': 80.3319,
        'last_station': 'CNB',
        'next_station': 'ALJN',
        'waypoints': [
            {'lat': 26.45, 'lon': 80.33},
            {'lat': 27.89, 'lon': 78.08}
        ]
    }

