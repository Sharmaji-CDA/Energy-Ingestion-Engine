# High-Scale Energy Ingestion Engine (NestJS + PostgreSQL)

This repo implements the **core ingestion layer** for two independent 1-minute telemetry streams:

- **Meter stream (Grid side):** `{ meterId, kwhConsumedAc, voltage, timestamp }`
- **Vehicle stream (Vehicle side):** `{ vehicleId, soc, kwhDeliveredDc, batteryTemp, timestamp }`

It persists data into:

- **HOT / Operational store (`*_latest`):** UPSERT for current dashboard state (SoC, last voltage, etc.)
- **COLD / Historical store (`*_readings`):** append-only INSERT into **daily partitioned** tables for long-term analytics

An analytics endpoint returns a **24h performance summary** per vehicle:

`GET /v1/analytics/performance/:vehicleId`

## Why this design works at scale

### 1) Write-heavy ingestion
- History path is append-only (fast inserts).
- Tables are **partitioned by day** on `ts` to keep indexes small and enable partition pruning.

### 2) Read-heavy analytics (no full scan)
- Queries use `(vehicle_id, ts)` and `(meter_id, ts)` indexes.
- Partitioning ensures Postgres prunes irrelevant days when filtering on `ts >= now() - interval '24 hours'`.

### 3) Correlation strategy
The two streams are correlated using `vehicle_meter_map(vehicle_id -> meter_id)`. Fleet ops can pre-provision these mappings, or you can create them via:

`POST /v1/mappings`

> If a vehicle has no mapping, analytics returns 404.

### 4) Energy totals from counter-style kWh values
Both `kwhConsumedAc` and `kwhDeliveredDc` are treated as **monotonic counters** (typical meter/battery energy counters).  
So for the 24h window, totals are computed as `MAX(counter) - MIN(counter)`.

## Quickstart (Docker)

```bash
cp .env.example .env
docker compose up --build
```

API will be available at: `http://localhost:3000`

## API

### Ingest telemetry (polymorphic)

`POST /v1/telemetry`

Meter example:
```bash
curl -X POST http://localhost:3000/v1/telemetry \
  -H "content-type: application/json" \
  -d '{
    "meterId":"meter-1",
    "kwhConsumedAc": 12034.123,
    "voltage": 230.2,
    "timestamp": "2026-02-09T04:00:00.000Z"
  }'
```

Vehicle example:
```bash
curl -X POST http://localhost:3000/v1/telemetry \
  -H "content-type: application/json" \
  -d '{
    "vehicleId":"veh-1",
    "soc": 68,
    "kwhDeliveredDc": 11020.555,
    "batteryTemp": 32.5,
    "timestamp": "2026-02-09T04:00:00.000Z"
  }'
```

### Create correlation mapping

`POST /v1/mappings`

```bash
curl -X POST http://localhost:3000/v1/mappings \
  -H "content-type: application/json" \
  -d '{ "vehicleId":"veh-1", "meterId":"meter-1" }'
```

### 24h analytics

`GET /v1/analytics/performance/:vehicleId`

```bash
curl http://localhost:3000/v1/analytics/performance/veh-1
```

Response:
```json
{
  "vehicleId": "veh-1",
  "meterId": "meter-1",
  "windowHours": 24,
  "acKwh": 12.12,
  "dcKwh": 10.33,
  "efficiencyRatio": 0.8527,
  "avgBatteryTemp": 33.12,
  "fromTs": "2026-02-08T04:00:00.000Z",
  "toTs": "2026-02-09T04:00:00.000Z"
}
```

## Record volume note (14.4M/day)
At **10,000 devices** with **1 reading/minute**:
- 10,000 × 1,440 = **14.4M rows/day** per stream table.
If you ingest both streams for all devices, it becomes ~**28.8M rows/day** total across both history tables.

## Extending to production
- Add automated partition creation job (daily) for future partitions.
- Add retention policy (drop old partitions).
- Add ingestion batching, async queue, and idempotency keys if needed.
