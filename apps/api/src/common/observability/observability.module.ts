import { Module } from "@nestjs/common";
import { MetricsController } from "./metrics.controller.js";

/** Exposes the read-only metrics endpoint. MetricsService + ErrorReporter are global (CoreModule). */
@Module({
  controllers: [MetricsController],
})
export class ObservabilityModule {}
