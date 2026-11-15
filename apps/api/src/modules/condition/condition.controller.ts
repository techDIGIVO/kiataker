import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { ConditionService, type ConditionItem } from "./condition.service.js";
import { StaffGuard } from "../admin/staff.guard.js";
import { Public } from "../../common/auth/public.decorator.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";

/** Landlord surface: capture baseline + exit condition checks and compare them (GJ-08). */
@Controller("condition-checks")
export class ConditionController {
  constructor(private readonly condition: ConditionService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() body: { tenancyId: string; kind?: "BASELINE" | "EXIT"; items?: ConditionItem[] }) {
    return this.condition.create(user.sub, body.tenancyId, body.kind ?? "BASELINE", body.items ?? []);
  }

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.condition.listForOwner(user.sub);
  }

  @Get(":id")
  view(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.condition.view(user.sub, id);
  }

  @Put(":id/items")
  setItems(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: { items: ConditionItem[] }) {
    return this.condition.setItems(user.sub, id, body.items ?? []);
  }

  @Post(":id/send")
  send(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.condition.sendToTenant(user.sub, id);
  }

  @Get(":id/compare")
  compare(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.condition.compare(user.sub, id);
  }
}

/** Public surface: the tenant confirms or disputes a condition check on a secure link. */
@Controller("condition")
export class ConditionConfirmController {
  constructor(private readonly condition: ConditionService) {}

  @Public()
  @Get(":token")
  view(@Param("token") token: string) {
    return this.condition.publicView(token);
  }

  @Public()
  @Post(":token")
  respond(@Param("token") token: string, @Body() body: { kind: "CONFIRM" | "DISPUTE"; note?: string }) {
    return this.condition.tenantRespond(token, body);
  }
}

/** Staff board of condition checks. */
@UseGuards(StaffGuard)
@Controller("internal")
export class ConditionAdminController {
  constructor(private readonly condition: ConditionService) {}

  @Get("board/condition-checks")
  board() {
    return this.condition.board();
  }

  @Get("condition-checks/:id")
  detail(@Param("id") id: string) {
    return this.condition.staffView(id);
  }

  @Post("condition-checks/:id/send")
  send(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.condition.staffSendToTenant(user.sub, id);
  }

  @Get("condition-checks/:id/compare")
  compare(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.condition.staffCompare(user.sub, id);
  }
}
