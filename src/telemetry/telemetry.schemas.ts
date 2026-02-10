import { z } from "zod";

export const meterTelemetrySchema = z.object({
  meterId: z.string().min(1),
  kwhConsumedAc: z.coerce.number().finite().nonnegative(),
  voltage: z.coerce.number().finite(),
  timestamp: z.coerce.date()
});

export const vehicleTelemetrySchema = z.object({
  vehicleId: z.string().min(1),
  soc: z.coerce.number().int().min(0).max(100),
  kwhDeliveredDc: z.coerce.number().finite().nonnegative(),
  batteryTemp: z.coerce.number().finite(),
  timestamp: z.coerce.date()
});

export type MeterTelemetry = z.infer<typeof meterTelemetrySchema>;
export type VehicleTelemetry = z.infer<typeof vehicleTelemetrySchema>;

export type TelemetryUnion =
  | { kind: "meter"; data: MeterTelemetry }
  | { kind: "vehicle"; data: VehicleTelemetry };
