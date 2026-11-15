import { Module } from "@nestjs/common";
import { SchedulerAdminController } from "./scheduler.controller.js";

/** Exposes the job-queue admin endpoints. SchedulerService itself is global (CoreModule). */
@Module({
  controllers: [SchedulerAdminController],
})
export class SchedulerModule {}
