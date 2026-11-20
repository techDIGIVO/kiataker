import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { PaymentsService } from "./payments.service.js";
import { StaffGuard } from "../admin/staff.guard.js";
import { Public } from "../../common/auth/public.decorator.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";
import { DevToolsGuard } from "../../common/auth/dev-tools.guard.js";

/** Landlord surface: raise a checkout for a tenant to pay (GJ-12). */
@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("checkout")
  checkout(@CurrentUser() user: RequestUser, @Body() body: { tenancyId: string; chargeId?: string; email?: string }) {
    return this.payments.createCheckout(user.sub, body);
  }
}

/** Public surface: the hosted pay page, the PSP webhook, and the test-mode completion. */
@Controller("payments")
export class PaymentsPublicController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @Get(":reference/public")
  publicCheckout(@Param("reference") reference: string) {
    return this.payments.publicCheckout(reference);
  }

  @Public()
  @Post("webhook")
  webhook(@Req() req: RawBodyRequest<Request>) {
    const raw = req.rawBody?.toString("utf8") ?? JSON.stringify(req.body ?? {});
    const sig = (req.headers["x-paystack-signature"] ?? req.headers["x-kiataker-signature"]) as string | undefined;
    return this.payments.handleWebhook(raw, sig);
  }

  @Public()
  @UseGuards(DevToolsGuard)
  @Post(":reference/dev-complete")
  devComplete(@Param("reference") reference: string) {
    return this.payments.devComplete(reference);
  }
}

/** Staff board: every on-platform payment, its split and status. */
@UseGuards(StaffGuard)
@Controller("internal")
export class PaymentsAdminController {
  constructor(private readonly payments: PaymentsService) {}

  @Get("board/payments")
  board() {
    return this.payments.board();
  }

  @Post("payments/checkout")
  checkout(@CurrentUser() user: RequestUser, @Body() body: { tenancyId: string; chargeId?: string; email?: string }) {
    return this.payments.createCheckoutForStaff(user.sub, body);
  }

  @Post("payments/:reference/refund")
  refund(@CurrentUser() user: RequestUser, @Param("reference") reference: string) {
    return this.payments.refund(user.sub, reference);
  }

  @UseGuards(DevToolsGuard)
  @Post("payments/:reference/dev-complete")
  devComplete(@Param("reference") reference: string) {
    return this.payments.devComplete(reference);
  }
}
