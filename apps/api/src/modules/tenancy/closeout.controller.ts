import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CloseoutService } from "./closeout.service.js";
import { StaffGuard } from "../admin/staff.guard.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";

/** Landlord surface: close out a tenancy and settle the caution fee (GJ-13). */
@Controller("closeouts")
export class CloseoutController {
  constructor(private readonly closeout: CloseoutService) {}

  @Post()
  start(@CurrentUser() user: RequestUser, @Body() body: { tenancyId: string }) {
    return this.closeout.start(user.sub, body.tenancyId);
  }

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.closeout.listForOwner(user.sub);
  }

  @Get(":id")
  view(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.closeout.view(user.sub, id);
  }

  @Post(":id/deductions")
  deduct(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: { reason: string; amountKobo: string }) {
    return this.closeout.addDeduction(user.sub, id, body);
  }

  @Post(":id/settle")
  settle(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.closeout.settle(user.sub, id);
  }
}

/** Staff board of close-outs and their caution-fee outcomes. */
@UseGuards(StaffGuard)
@Controller("internal")
export class CloseoutAdminController {
  constructor(private readonly closeout: CloseoutService) {}

  @Get("board/closeouts")
  board() {
    return this.closeout.board();
  }

  @Post("closeouts/:id/deductions")
  addDeduction(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: { reason: string; amountKobo: string }) {
    return this.closeout.staffAddDeduction(user.sub, id, body);
  }

  @Post("closeouts/:id/settle")
  settle(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.closeout.staffSettle(user.sub, id);
  }
}
