import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import { meterTelemetrySchema, vehicleTelemetrySchema, TelemetryUnion } from "./telemetry.schemas";

@Injectable()
export class TelemetryIngestPipe implements PipeTransform {
  transform(value: any): TelemetryUnion {
    const hasMeterId = value?.meterId != null;
    const hasVehicleId = value?.vehicleId != null;

    if (hasMeterId && hasVehicleId) {
      throw new BadRequestException("Payload must be either meter stream or vehicle stream, not both.");
    }
    if (!hasMeterId && !hasVehicleId) {
      throw new BadRequestException("Payload must include either meterId or vehicleId.");
    }

    if (hasMeterId) {
      const parsed = meterTelemetrySchema.safeParse(value);
      if (!parsed.success) {
        throw new BadRequestException({ message: "Invalid meter telemetry", issues: parsed.error.flatten() });
      }
      return { kind: "meter", data: parsed.data };
    }

    const parsed = vehicleTelemetrySchema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({ message: "Invalid vehicle telemetry", issues: parsed.error.flatten() });
    }
    return { kind: "vehicle", data: parsed.data };
  }
}
