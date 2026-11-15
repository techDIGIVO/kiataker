import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { RenewalService } from "./renewal.service.js";
import { StaffGuard } from "../admin/staff.guard.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";

/** Landlord surface: the renewal window, the renew/decline decision, and the NTQ runway (GJ-22). */
@Controller("renewals")
export class RenewalController {
  constructor(private readonly renewals: RenewalService) {}

  @Get("window")
  window(@CurrentUser() user: RequestUser) {
    return this.renewals.window(user.sub);
  }

  @Get(":tenancyId/runway")
  runway(@CurrentUser() user: RequestUser, @Param("tenancyId") tenancyId: string) {
    return this.renewals.runway(user.sub, tenancyId);
  }

  @Post(":tenancyId/renew")
  renew(@CurrentUser() user: RequestUser, @Param("tenancyId") tenancyId: string, @Body() body: { rentKobo?: string; months?: number }) {
    return this.renewals.renew(user.sub, tenancyId, body);
  }

  @Post(":tenancyId/not-renew")
  notRenew(@CurrentUser() user: RequestUser, @Param("tenancyId") tenancyId: string) {
    return this.renewals.notRenew(user.sub, tenancyId);
  }

  @Post(":tenancyId/advance")
  advance(@CurrentUser() user: RequestUser, @Param("tenancyId") tenancyId: string) {
    return this.renewals.advanceRunway(user.sub, tenancyId);
  }
}

/** Staff board of renewal decisions and Notice to Quit runways. */
@UseGuards(StaffGuard)
@Controller("internal")
export class RenewalAdminController {
  constructor(private readonly renewals: RenewalService) {}

  @Get("board/renewals")
  board() {
    return this.renewals.board();
  }

  @Post("renewals/:tenancyId/renew")
  renew(@CurrentUser() user: RequestUser, @Param("tenancyId") tenancyId: string, @Body() body: { rentKobo?: string; months?: number }) {
    return this.renewals.staffRenew(user.sub, tenancyId, body ?? {});
  }

  @Post("renewals/:tenancyId/not-renew")
  notRenew(@CurrentUser() user: RequestUser, @Param("tenancyId") tenancyId: string) {
    return this.renewals.staffNotRenew(user.sub, tenancyId);
  }

  @Post("renewals/:tenancyId/advance")
  advance(@CurrentUser() user: RequestUser, @Param("tenancyId") tenancyId: string) {
    return this.renewals.staffAdvance(user.sub, tenancyId);
  }
}
