import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { BuildingService, type UnitUse } from "./building.service.js";
import { StaffGuard } from "../admin/staff.guard.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";

/** Landlord surface: group a mixed-use building and add units of differing use (GJ-24). */
@Controller("buildings")
export class BuildingController {
  constructor(private readonly buildings: BuildingService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() body: { addressRaw: string }) {
    return this.buildings.create(user.sub, body.addressRaw);
  }

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.buildings.listForLandlord(user.sub);
  }

  @Get(":id")
  view(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.buildings.view(user.sub, id);
  }

  @Post(":id/units")
  addUnit(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: { unitUse: UnitUse; label?: string; addressRaw?: string }) {
    return this.buildings.addUnit(user.sub, id, body);
  }
}

/** Staff board of grouped buildings and their unit mix. */
@UseGuards(StaffGuard)
@Controller("internal")
export class BuildingAdminController {
  constructor(private readonly buildings: BuildingService) {}

  @Get("board/buildings")
  board() {
    return this.buildings.board();
  }

  @Post("buildings/:id/units")
  addUnit(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: { unitUse: UnitUse; label?: string; addressRaw?: string }) {
    return this.buildings.staffAddUnit(user.sub, id, body);
  }
}
