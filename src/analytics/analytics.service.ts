import { Injectable } from "@nestjs/common";
import { DbService } from "../db/db.service";
import { MappingService } from "../mapping/mapping.service";

function toNumber(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly db: DbService, private readonly mapping: MappingService) {}

  async get24hPerformance(vehicleId: string) {
    const meterId = await this.mapping.getMeterIdForVehicle(vehicleId);
    if (!meterId) return null;

    const toTs = new Date();
    const fromTs = new Date(toTs.getTime() - 24 * 60 * 60 * 1000);

    // NOTE: counters are treated as monotonic totals; 24h energy = max - min.
    // With (id, ts) partitioning + (vehicle_id, ts) indexes, this avoids full scans.
    const vehicleAgg = await this.db.query<{
      min_dc: string | null;
      max_dc: string | null;
      avg_temp: string | null;
    }>(
      `SELECT
          MIN(kwh_delivered_dc) AS min_dc,
          MAX(kwh_delivered_dc) AS max_dc,
          AVG(battery_temp)     AS avg_temp
       FROM vehicle_readings
       WHERE vehicle_id = $1 AND ts >= $2 AND ts <= $3`,
      [vehicleId, fromTs, toTs]
    );

    const meterAgg = await this.db.query<{
      min_ac: string | null;
      max_ac: string | null;
    }>(
      `SELECT
          MIN(kwh_consumed_ac) AS min_ac,
          MAX(kwh_consumed_ac) AS max_ac
       FROM meter_readings
       WHERE meter_id = $1 AND ts >= $2 AND ts <= $3`,
      [meterId, fromTs, toTs]
    );

    const v = vehicleAgg.rows[0] ?? { min_dc: null, max_dc: null, avg_temp: null };
    const m = meterAgg.rows[0] ?? { min_ac: null, max_ac: null };

    const minDc = toNumber(v.min_dc);
    const maxDc = toNumber(v.max_dc);
    const minAc = toNumber(m.min_ac);
    const maxAc = toNumber(m.max_ac);

    const dcKwh = minDc != null && maxDc != null && maxDc >= minDc ? maxDc - minDc : 0;
    const acKwh = minAc != null && maxAc != null && maxAc >= minAc ? maxAc - minAc : 0;

    const efficiencyRatio = acKwh > 0 ? dcKwh / acKwh : null;
    const avgBatteryTemp = toNumber(v.avg_temp);

    return {
      vehicleId,
      meterId,
      windowHours: 24,
      acKwh: Number(acKwh.toFixed(6)),
      dcKwh: Number(dcKwh.toFixed(6)),
      efficiencyRatio: efficiencyRatio == null ? null : Number(efficiencyRatio.toFixed(6)),
      avgBatteryTemp: avgBatteryTemp == null ? null : Number(avgBatteryTemp.toFixed(2)),
      fromTs: fromTs.toISOString(),
      toTs: toTs.toISOString()
    };
  }
}
