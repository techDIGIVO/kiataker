import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { StatementService } from "./statement.service.js";
import { StaffGuard } from "../admin/staff.guard.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";

/** Landlord surface: a landlord's own rent statement (Information output, P4). */
@Controller("statements")
export class StatementController {
  constructor(private readonly statements: StatementService) {}

  @Get("me")
  me(@CurrentUser() user: RequestUser) {
    return this.statements.forLandlord(user.sub);
  }
}

/** Staff surface: pull any landlord's statement. */
@UseGuards(StaffGuard)
@Controller("internal")
export class StatementAdminController {
  constructor(private readonly statements: StatementService) {}

  @Get("statements/:landlordId")
  forLandlord(@Param("landlordId") landlordId: string) {
    return this.statements.forLandlord(landlordId);
  }
}
