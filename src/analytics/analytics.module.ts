import { Module } from "@nestjs/common";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { MappingModule } from "../mapping/mapping.module";

@Module({
  imports: [MappingModule],   // 👈 THIS IS THE FIX
  controllers: [AnalyticsController],
  providers: [AnalyticsService]
})
export class AnalyticsModule {}
