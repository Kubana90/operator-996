-- KPI Database Schema for operator-996 Platform
-- PostgreSQL 14+
-- Author: operator-996
-- Purpose: Analytics, Metrics, and KPI Tracking

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;

-- =======================
-- CORE TABLES
-- =======================

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Events Table (TimescaleDB Hypertable)
CREATE TABLE IF NOT EXISTS events (
    id UUID DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb,
    source VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    session_id UUID,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, timestamp)
);

-- Convert events to TimescaleDB hypertable
SELECT create_hypertable('events', 'timestamp', if_not_exists => TRUE);

CREATE INDEX idx_events_user_id ON events(user_id, timestamp DESC);
CREATE INDEX idx_events_type ON events(event_type, timestamp DESC);
CREATE INDEX idx_events_name ON events(event_name);
CREATE INDEX idx_events_session ON events(session_id, timestamp DESC);
CREATE INDEX idx_events_data_gin ON events USING gin(event_data);

-- KPIs Table
CREATE TABLE IF NOT EXISTS kpis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    unit VARCHAR(50),
    target_value NUMERIC(15,2),
    threshold_warning NUMERIC(15,2),
    threshold_critical NUMERIC(15,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_kpis_category ON kpis(category);
CREATE INDEX idx_kpis_active ON kpis(is_active);

-- KPI Measurements (TimescaleDB Hypertable)
CREATE TABLE IF NOT EXISTS kpi_measurements (
    id UUID DEFAULT uuid_generate_v4(),
    kpi_id UUID REFERENCES kpis(id) ON DELETE CASCADE,
    value NUMERIC(15,2) NOT NULL,
    dimension_1 VARCHAR(100),
    dimension_2 VARCHAR(100),
    dimension_3 VARCHAR(100),
    tags JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, timestamp)
);

SELECT create_hypertable('kpi_measurements', 'timestamp', if_not_exists => TRUE);

CREATE INDEX idx_kpi_measurements_kpi ON kpi_measurements(kpi_id, timestamp DESC);
CREATE INDEX idx_kpi_measurements_dims ON kpi_measurements(dimension_1, dimension_2, dimension_3);
CREATE INDEX idx_kpi_measurements_tags_gin ON kpi_measurements USING gin(tags);

-- Biofeedback Metrics (TimescaleDB Hypertable)
CREATE TABLE IF NOT EXISTS biofeedback_metrics (
    id UUID DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL, -- 'heart_rate', 'stress_level', 'focus_score'
    value NUMERIC(10,2) NOT NULL,
    quality_score INTEGER CHECK (quality_score BETWEEN 0 AND 100),
    device_id VARCHAR(100),
    context JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, timestamp)
);

SELECT create_hypertable('biofeedback_metrics', 'timestamp', if_not_exists => TRUE);

CREATE INDEX idx_biofeedback_user ON biofeedback_metrics(user_id, timestamp DESC);
CREATE INDEX idx_biofeedback_type ON biofeedback_metrics(metric_type, timestamp DESC);
CREATE INDEX idx_biofeedback_device ON biofeedback_metrics(device_id);

-- System Metrics (TimescaleDB Hypertable)
CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID DEFAULT uuid_generate_v4(),
    service_name VARCHAR(100) NOT NULL,
    metric_name VARCHAR(255) NOT NULL,
    metric_value NUMERIC(15,4) NOT NULL,
    unit VARCHAR(50),
    hostname VARCHAR(255),
    environment VARCHAR(50),
    labels JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, timestamp)
);

SELECT create_hypertable('system_metrics', 'timestamp', if_not_exists => TRUE);

CREATE INDEX idx_system_metrics_service ON system_metrics(service_name, timestamp DESC);
CREATE INDEX idx_system_metrics_name ON system_metrics(metric_name, timestamp DESC);
CREATE INDEX idx_system_metrics_env ON system_metrics(environment);

-- =======================
-- MATERIALIZED VIEWS
-- =======================

-- Daily User Activity Summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_user_activity AS
SELECT
    date_trunc('day', timestamp) AS activity_date,
    user_id,
    COUNT(*) AS total_events,
    COUNT(DISTINCT event_type) AS unique_event_types,
    COUNT(DISTINCT session_id) AS sessions,
    MIN(timestamp) AS first_activity,
    MAX(timestamp) AS last_activity
FROM events
GROUP BY date_trunc('day', timestamp), user_id;

CREATE UNIQUE INDEX idx_mv_daily_user_activity ON mv_daily_user_activity(activity_date, user_id);

-- Hourly KPI Aggregates
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_hourly_kpi_stats AS
SELECT
    time_bucket('1 hour', timestamp) AS hour,
    kpi_id,
    AVG(value) AS avg_value,
    MIN(value) AS min_value,
    MAX(value) AS max_value,
    STDDEV(value) AS stddev_value,
    COUNT(*) AS measurement_count
FROM kpi_measurements
GROUP BY time_bucket('1 hour', timestamp), kpi_id;

CREATE UNIQUE INDEX idx_mv_hourly_kpi_stats ON mv_hourly_kpi_stats(hour, kpi_id);

-- =======================
-- CONTINUOUS AGGREGATES (TimescaleDB)
-- =======================

-- 5-Minute Rolling Averages for Biofeedback
CREATE MATERIALIZED VIEW IF NOT EXISTS biofeedback_5min_avg
WITH (timescaledb.continuous) AS
SELECT
    user_id,
    metric_type,
    time_bucket('5 minutes', timestamp) AS bucket,
    AVG(value) AS avg_value,
    MIN(value) AS min_value,
    MAX(value) AS max_value,
    COUNT(*) AS sample_count
FROM biofeedback_metrics
GROUP BY user_id, metric_type, bucket;

-- 1-Minute System Metrics Aggregates
CREATE MATERIALIZED VIEW IF NOT EXISTS system_metrics_1min
WITH (timescaledb.continuous) AS
SELECT
    service_name,
    metric_name,
    time_bucket('1 minute', timestamp) AS bucket,
    AVG(metric_value) AS avg_value,
    MAX(metric_value) AS max_value,
    MIN(metric_value) AS min_value,
    COUNT(*) AS sample_count
FROM system_metrics
GROUP BY service_name, metric_name, bucket;

-- =======================
-- FUNCTIONS
-- =======================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update trigger to relevant tables
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER kpis_updated_at BEFORE UPDATE ON kpis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =======================
-- DATA RETENTION POLICIES
-- =======================

-- Retain events for 90 days
SELECT add_retention_policy('events', INTERVAL '90 days', if_not_exists => TRUE);

-- Retain raw biofeedback for 30 days
SELECT add_retention_policy('biofeedback_metrics', INTERVAL '30 days', if_not_exists => TRUE);

-- Retain raw system metrics for 7 days
SELECT add_retention_policy('system_metrics', INTERVAL '7 days', if_not_exists => TRUE);

-- Retain KPI measurements for 365 days
SELECT add_retention_policy('kpi_measurements', INTERVAL '365 days', if_not_exists => TRUE);

-- =======================
-- REFRESH POLICIES
-- =======================

-- Refresh continuous aggregates
SELECT add_continuous_aggregate_policy('biofeedback_5min_avg',
    start_offset => INTERVAL '1 hour',
    end_offset => INTERVAL '5 minutes',
    schedule_interval => INTERVAL '5 minutes',
    if_not_exists => TRUE);

SELECT add_continuous_aggregate_policy('system_metrics_1min',
    start_offset => INTERVAL '30 minutes',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute',
    if_not_exists => TRUE);

-- =======================
-- SAMPLE DATA INSERTION
-- =======================

-- Insert sample KPIs
INSERT INTO kpis (name, category, description, unit, target_value, threshold_warning, threshold_critical)
VALUES
    ('API Response Time', 'performance', 'Average API response time', 'ms', 200, 500, 1000),
    ('Error Rate', 'reliability', 'Percentage of failed requests', '%', 0.1, 1, 5),
    ('Active Users', 'engagement', 'Number of active users', 'count', 1000, 500, 100),
    ('System CPU Usage', 'infrastructure', 'CPU utilization percentage', '%', 70, 80, 90),
    ('Database Connections', 'infrastructure', 'Active database connections', 'count', 50, 80, 100)
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO operator996_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO operator996_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO operator996_user;

-- Comments
COMMENT ON TABLE events IS 'Time-series event tracking for all user interactions';
COMMENT ON TABLE kpis IS 'Key Performance Indicator definitions';
COMMENT ON TABLE kpi_measurements IS 'Time-series measurements for all KPIs';
COMMENT ON TABLE biofeedback_metrics IS 'Biofeedback sensor data from users';
COMMENT ON TABLE system_metrics IS 'System and infrastructure metrics';
