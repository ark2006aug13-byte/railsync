-- migrations/add_crowdsource_table.sql
CREATE TABLE user_incident_reports (
    id SERIAL PRIMARY KEY,
    train_number VARCHAR(10) NOT NULL,
    reporter_user_id VARCHAR(50),  -- Can be anonymous
    report_type VARCHAR(50) NOT NULL,
    description TEXT,
    latitude DECIMAL(10, 6),
    longitude DECIMAL(10, 6),
    timestamp TIMESTAMP DEFAULT NOW(),
    confidence_score DECIMAL(3, 2) DEFAULT 0.5,
    verified BOOLEAN DEFAULT FALSE,
    verification_count INTEGER DEFAULT 0
);

CREATE TABLE report_types (
    id SERIAL PRIMARY KEY,
    type_code VARCHAR(50) UNIQUE NOT NULL,
    type_name VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL
);

-- Populate report types
INSERT INTO report_types (type_code, type_name, severity) VALUES
('FOG_SEVERE', 'Severe Fog - Visibility < 50m', 'HIGH'),
('FOG_MODERATE', 'Moderate Fog - Visibility 50-200m', 'MEDIUM'),
('CHAIN_PULLING', 'Chain Pulling Incident', 'HIGH'),
('CATTLE_TRACK', 'Cattle on Track', 'MEDIUM'),
('PLATFORM_CROWD', 'Extreme Platform Crowding', 'MEDIUM'),
('SIGNAL_DELAY', 'Extended Signal Wait', 'MEDIUM'),
('TECHNICAL_ISSUE', 'Technical Problem with Train', 'HIGH'),
('MEDICAL_EMERGENCY', 'Medical Emergency', 'HIGH'),
('ACCIDENT', 'Accident Reported', 'CRITICAL');
