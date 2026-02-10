import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DbModule } from "./db/db.module";
import { TelemetryModule } from "./telemetry/telemetry.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { MappingModule } from "./mapping/mapping.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    TelemetryModule,
    MappingModule,
    AnalyticsModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
