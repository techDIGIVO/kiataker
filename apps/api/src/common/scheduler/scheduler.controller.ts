import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { SchedulerService } from "./scheduler.service.js";
import { StaffGuard } from "../../modules/admin/staff.guard.js";

/** Staff view of the durable job queue, with manual enqueue + process (P0-05). */
@UseGuards(StaffGuard)
@Controller("internal")
export class SchedulerAdminController {
  constructor(private readonly scheduler: SchedulerService) {}

  @Get("board/jobs")
  board() {
    return this.scheduler.board();
  }

  @Post("jobs")
  enqueue(@Body() body: { kind?: string; subjectRef?: string; runAt?: string }) {
    return this.scheduler.enqueue(body.kind ?? "noop", body.subjectRef, body.runAt ? new Date(body.runAt) : undefined);
  }

  @Post("jobs/process")
  process() {
    return this.scheduler.processDue();
  }
}
