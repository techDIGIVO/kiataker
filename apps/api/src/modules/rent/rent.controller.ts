import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { RentService } from "./rent.service.js";
import { StaffGuard } from "../admin/staff.guard.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";

@Controller()
export class RentController {
  constructor(private readonly rent: RentService) {}

  @Get("tenancies/:id/rent")
  status(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.rent.status(user.sub, id);
  }

  @Post("payments/off-platform")
  record(@CurrentUser() user: RequestUser, @Body() body: { tenancyId: string; amountKobo: string; reference?: string; evidenceRef?: string }) {
    return this.rent.recordOffPlatform(user.sub, body);
  }
}

/** Rent concierge surface: staff record a payment on the landlord's behalf (StaffGuard). */
@UseGuards(StaffGuard)
@Controller("internal")
export class RentAdminController {
  constructor(private readonly rent: RentService) {}

  @Post("rent/record")
  record(@CurrentUser() user: RequestUser, @Body() body: { tenancyId: string; amountKobo: string; reference?: string; evidenceRef?: string }) {
    return this.rent.recordForStaff(user.sub, body);
  }
}
