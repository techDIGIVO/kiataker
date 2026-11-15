import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { ScopeService, type SomService } from "./scope.service.js";
import { StaffGuard } from "../admin/staff.guard.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";

/** Landlord surface: view and agree the scope of management for a property (GJ-20). */
@Controller("properties/:propertyId/scope")
export class ScopeController {
  constructor(private readonly scope: ScopeService) {}

  @Get()
  get(@CurrentUser() user: RequestUser, @Param("propertyId") propertyId: string) {
    return this.scope.get(user.sub, propertyId);
  }

  @Put()
  set(@CurrentUser() user: RequestUser, @Param("propertyId") propertyId: string, @Body() body: Partial<Record<SomService, boolean>>) {
    return this.scope.set(user.sub, propertyId, body);
  }
}

/** Staff board of agreed scopes of management. */
@UseGuards(StaffGuard)
@Controller("internal")
export class ScopeAdminController {
  constructor(private readonly scope: ScopeService) {}

  @Get("board/scope")
  board() {
    return this.scope.board();
  }

  @Put("scope/:propertyId")
  set(@CurrentUser() user: RequestUser, @Param("propertyId") propertyId: string, @Body() body: Partial<Record<SomService, boolean>>) {
    return this.scope.staffSet(user.sub, propertyId, body);
  }
}
