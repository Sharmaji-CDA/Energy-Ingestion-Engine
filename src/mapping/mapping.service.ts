import { Injectable } from "@nestjs/common";
import { DbService } from "../db/db.service";

@Injectable()
export class MappingService {
  constructor(private readonly db: DbService) {}

  async upsertMapping(vehicleId: string, meterId: string) {
    await this.db.query(
      `INSERT INTO vehicle_meter_map (vehicle_id, meter_id)
       VALUES ($1, $2)
       ON CONFLICT (vehicle_id) DO UPDATE SET meter_id = EXCLUDED.meter_id`,
      [vehicleId, meterId]
    );
  }

  async getMeterIdForVehicle(vehicleId: string): Promise<string | null> {
    const res = await this.db.query<{ meter_id: string }>(
      `SELECT meter_id FROM vehicle_meter_map WHERE vehicle_id = $1`,
      [vehicleId]
    );
    return res.rowCount ? res.rows[0].meter_id : null;
  }
}
