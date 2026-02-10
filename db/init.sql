-- High-Scale Energy Ingestion Engine - PostgreSQL schema
-- Hot tables: *_latest (UPSERT)
-- Cold tables: *_readings (append-only history), partitioned by day for pruning
-- Mapping table: vehicle_meter_map to correlate streams

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------
-- Operational (HOT) store
-- ----------------------------

CREATE TABLE IF NOT EXISTS meter_latest (
  meter_id TEXT PRIMARY KEY,
  last_ts TIMESTAMPTZ NOT NULL,
  kwh_consumed_ac NUMERIC(14,6) NOT NULL,
  voltage NUMERIC(10,3) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicle_latest (
  vehicle_id TEXT PRIMARY KEY,
  last_ts TIMESTAMPTZ NOT NULL,
  soc SMALLINT NOT NULL CHECK (soc >= 0 AND soc <= 100),
  kwh_delivered_dc NUMERIC(14,6) NOT NULL,
  battery_temp NUMERIC(6,2) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Correlation mapping (can be pre-provisioned by Fleet Ops or created via API)
CREATE TABLE IF NOT EXISTS vehicle_meter_map (
  vehicle_id TEXT PRIMARY KEY,
  meter_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_meter_map_meter ON vehicle_meter_map (meter_id);

-- ----------------------------
-- Historical (COLD) store
-- Partitioned by day on ts
-- ----------------------------

CREATE TABLE IF NOT EXISTS meter_readings (
  id BIGSERIAL,
  meter_id TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  kwh_consumed_ac NUMERIC(14,6) NOT NULL,
  voltage NUMERIC(10,3) NOT NULL,
  PRIMARY KEY (id, ts)
) PARTITION BY RANGE (ts);

CREATE TABLE IF NOT EXISTS vehicle_readings (
  id BIGSERIAL,
  vehicle_id TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  soc SMALLINT NOT NULL CHECK (soc >= 0 AND soc <= 100),
  kwh_delivered_dc NUMERIC(14,6) NOT NULL,
  battery_temp NUMERIC(6,2) NOT NULL,
  PRIMARY KEY (id, ts)
) PARTITION BY RANGE (ts);

-- Helpful indexes for analytics (per-partition indexes will be created as partitions are created)
-- (vehicle_id, ts) and (meter_id, ts) are the key access patterns for 24h queries.

-- ----------------------------
-- Partition creation utility
-- ----------------------------

DO $$
DECLARE
  d DATE;
  start_date DATE := CURRENT_DATE - COALESCE(NULLIF(current_setting('app.partition_days_past', true), '')::INT, 2);
  end_date   DATE := CURRENT_DATE + COALESCE(NULLIF(current_setting('app.partition_days_future', true), '')::INT, 2);
  p1 TEXT;
  p2 TEXT;
BEGIN
  FOR d IN SELECT generate_series(start_date, end_date, interval '1 day')::date LOOP
    p1 := format('meter_readings_%s', to_char(d, 'YYYYMMDD'));
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF meter_readings FOR VALUES FROM (%L) TO (%L);',
      p1, d::timestamptz, (d + 1)::timestamptz);

    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (meter_id, ts DESC);',
      format('idx_%s_meter_id_ts', p1), p1);

    p2 := format('vehicle_readings_%s', to_char(d, 'YYYYMMDD'));
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF vehicle_readings FOR VALUES FROM (%L) TO (%L);',
      p2, d::timestamptz, (d + 1)::timestamptz);

    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (vehicle_id, ts DESC);',
      format('idx_%s_vehicle_id_ts', p2), p2);
  END LOOP;
END $$;

-- Optional: seed example mapping (comment out in real deployments)
-- INSERT INTO vehicle_meter_map(vehicle_id, meter_id) VALUES ('veh-1', 'meter-1')
-- ON CONFLICT (vehicle_id) DO UPDATE SET meter_id = EXCLUDED.meter_id;
