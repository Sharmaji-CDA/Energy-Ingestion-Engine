import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";

@Controller("/v1/analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("/performance/:vehicleId")
  async performance(@Param("vehicleId") vehicleId: string) {
    const result = await this.analytics.get24hPerformance(vehicleId);
    if (!result) throw new NotFoundException("Vehicle not found or not mapped to a meter.");
    return result;
  }
}
