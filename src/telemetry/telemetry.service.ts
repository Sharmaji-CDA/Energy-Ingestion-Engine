import { Injectable } from "@nestjs/common";
import { DbService } from "../db/db.service";
import { MeterTelemetry, VehicleTelemetry } from "./telemetry.schemas";

@Injectable()
export class TelemetryService {
  constructor(private readonly db: DbService) {}

  async ingestMeter(t: MeterTelemetry): Promise<void> {
    // History path (append-only)
    // Partition pruning chooses correct daily partition by ts.
    await this.db.query(
      `INSERT INTO meter_readings (meter_id, ts, kwh_consumed_ac, voltage)
       VALUES ($1, $2, $3, $4)`,
      [t.meterId, t.timestamp, t.kwhConsumedAc, t.voltage]
    );

    // Live path (UPSERT, keep latest reading only)
    await this.db.query(
      `INSERT INTO meter_latest (meter_id, last_ts, kwh_consumed_ac, voltage, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (meter_id) DO UPDATE
         SET last_ts = EXCLUDED.last_ts,
             kwh_consumed_ac = EXCLUDED.kwh_consumed_ac,
             voltage = EXCLUDED.voltage,
             updated_at = now()
       WHERE EXCLUDED.last_ts >= meter_latest.last_ts`,
      [t.meterId, t.timestamp, t.kwhConsumedAc, t.voltage]
    );
  }

  async ingestVehicle(t: VehicleTelemetry): Promise<void> {
    await this.db.query(
      `INSERT INTO vehicle_readings (vehicle_id, ts, soc, kwh_delivered_dc, battery_temp)
       VALUES ($1, $2, $3, $4, $5)`,
      [t.vehicleId, t.timestamp, t.soc, t.kwhDeliveredDc, t.batteryTemp]
    );

    await this.db.query(
      `INSERT INTO vehicle_latest (vehicle_id, last_ts, soc, kwh_delivered_dc, battery_temp, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (vehicle_id) DO UPDATE
         SET last_ts = EXCLUDED.last_ts,
             soc = EXCLUDED.soc,
             kwh_delivered_dc = EXCLUDED.kwh_delivered_dc,
             battery_temp = EXCLUDED.battery_temp,
             updated_at = now()
       WHERE EXCLUDED.last_ts >= vehicle_latest.last_ts`,
      [t.vehicleId, t.timestamp, t.soc, t.kwhDeliveredDc, t.batteryTemp]
    );
  }
}
