import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { MaintenanceService } from "./maintenance.service.js";
import { StaffGuard } from "../admin/staff.guard.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";

/** Landlord surface: report issues, accept Quotes and Work. */
@Controller()
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Post("issues")
  report(@CurrentUser() user: RequestUser, @Body() body: { propertyId: string; tenancyId?: string; category: string; description: string; urgency?: string; evidenceRef?: string }) {
    return this.maintenance.report(user.sub, body);
  }

  @Get("issues/:id")
  get(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.maintenance.getIssue(user.sub, id);
  }

  @Post("issues/:id/quotes/:quoteId/accept")
  acceptQuote(@CurrentUser() user: RequestUser, @Param("id") id: string, @Param("quoteId") quoteId: string) {
    return this.maintenance.acceptQuote(user.sub, id, quoteId);
  }

  @Post("work/:id/accept")
  acceptWork(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.maintenance.acceptWork(user.sub, id);
  }
}

/** Konnect / staff surface: admit provider Quotes and submit Work completion. */
@UseGuards(StaffGuard)
@Controller("internal")
export class KonnectAdminController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Post("issues/:id/quotes")
  submitQuote(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: { providerName: string; amountKobo: string; scope: string; assumptions?: string }) {
    return this.maintenance.submitQuote(user.sub, id, body);
  }

  @Post("work/:id/evidence")
  submitWork(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: { evidence?: unknown }) {
    return this.maintenance.submitWorkCompletion(user.sub, id, body);
  }
}
