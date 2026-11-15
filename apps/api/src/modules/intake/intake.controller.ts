import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { IntakeService, type IntakeRow } from "./intake.service.js";
import { StaffGuard } from "../admin/staff.guard.js";
import { Public } from "../../common/auth/public.decorator.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";

/** Staff: capture a bulk intake batch and send it to the landlord to confirm (GJ-23). */
@UseGuards(StaffGuard)
@Controller("internal")
export class IntakeAdminController {
  constructor(private readonly intake: IntakeService) {}

  @Post("intake")
  create(@CurrentUser() user: RequestUser, @Body() body: { landlordId: string; rows: IntakeRow[] }) {
    return this.intake.createBatch(user.sub, body);
  }

  @Post("intake/:id/send")
  send(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.intake.sendToLandlord(user.sub, id);
  }

  @Get("board/intake")
  board() {
    return this.intake.board();
  }
}

/** Public: the landlord reviews and confirms (or rejects) the batch on a secure link. */
@Controller("intake")
export class IntakePublicController {
  constructor(private readonly intake: IntakeService) {}

  @Public()
  @Get(":token")
  view(@Param("token") token: string) {
    return this.intake.landlordView(token);
  }

  @Public()
  @Post(":token/confirm")
  confirm(@Param("token") token: string) {
    return this.intake.confirm(token);
  }

  @Public()
  @Post(":token/reject")
  reject(@Param("token") token: string) {
    return this.intake.reject(token);
  }
}
