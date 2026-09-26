-- migrations/add_weather_table.sql
CREATE TABLE weather_snapshots (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    latitude DECIMAL(10, 6) NOT NULL,
    longitude DECIMAL(10, 6) NOT NULL,
    visibility_meters INTEGER,
    precipitation_mm_hr DECIMAL(5, 2),
    temperature_celsius DECIMAL(5, 2),
    humidity_percent DECIMAL(5, 2),
    wind_speed_kmh DECIMAL(5, 2),
    weather_condition VARCHAR(50),
    source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_weather_snapshots_location_time 
ON weather_snapshots(latitude, longitude, timestamp);

CREATE TABLE section_weather_cache (
    section_id VARCHAR(50) PRIMARY KEY,
    last_updated TIMESTAMP NOT NULL,
    avg_visibility INTEGER,
    max_precipitation DECIMAL(5, 2),
    fog_risk_score DECIMAL(3, 2),
    rain_risk_score DECIMAL(3, 2),
    overall_risk_score DECIMAL(3, 2)
);
