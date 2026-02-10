import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { TelemetryService } from "./telemetry.service";
import { TelemetryIngestPipe } from "./telemetry.pipe";
import { TelemetryUnion } from "./telemetry.schemas";

@Controller("/v1/telemetry")
export class TelemetryController {
  constructor(private readonly telemetry: TelemetryService) {}

  @Post()
  @HttpCode(202)
  async ingest(@Body(new TelemetryIngestPipe()) payload: TelemetryUnion) {
    if (payload.kind === "meter") {
      await this.telemetry.ingestMeter(payload.data);
      return { accepted: true, kind: "meter" };
    }
    await this.telemetry.ingestVehicle(payload.data);
    return { accepted: true, kind: "vehicle" };
  }
}
