import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { OriginationService } from "./origination.service.js";
import { StaffGuard } from "../admin/staff.guard.js";
import { Public } from "../../common/auth/public.decorator.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";

/** Landlord surface: originate a new tenancy and drive it through its gates to activation. */
@Controller("originations")
export class OriginationController {
  constructor(private readonly origination: OriginationService) {}

  @Post()
  start(@CurrentUser() user: RequestUser, @Body() body: { propertyId: string; tenant: { name: string; whatsapp?: string; email?: string }; terms: { rentKobo: string; frequency: string; commencementDate: string; expiryDate: string; cautionFeeKobo?: string; noticePeriod?: string } }) {
    return this.origination.start(user.sub, body);
  }

  @Get(":id/gates")
  gates(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.origination.gates(user.sub, id);
  }

  @Post(":id/caution-fee")
  cautionFee(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: { amountKobo?: string; waived?: boolean }) {
    return this.origination.settleCautionFee(user.sub, id, body);
  }

  @Post(":id/activate")
  activate(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.origination.activate(user.sub, id);
  }
}

/** Public surface: the prospective tenant reviews and accepts on a secure link. */
@Controller("originations/accept")
export class OriginationAcceptController {
  constructor(private readonly origination: OriginationService) {}

  @Public()
  @Get(":token")
  view(@Param("token") token: string) {
    return this.origination.publicView(token);
  }

  @Public()
  @Post(":token")
  accept(@Param("token") token: string) {
    return this.origination.tenantAccept(token);
  }
}

/** Staff board of originations in flight and their gates. */
@UseGuards(StaffGuard)
@Controller("internal")
export class OriginationAdminController {
  constructor(private readonly origination: OriginationService) {}

  @Get("board/originations")
  board() {
    return this.origination.board();
  }

  @Post("originations/:id/activate")
  activate(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.origination.staffActivate(user.sub, id);
  }
}
