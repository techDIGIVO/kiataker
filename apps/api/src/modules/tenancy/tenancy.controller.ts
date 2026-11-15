import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { TenancyService } from "./tenancy.service.js";
import { StaffGuard } from "../admin/staff.guard.js";
import { Public } from "../../common/auth/public.decorator.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";

@Controller("tenancies")
export class TenancyController {
  constructor(private readonly tenancies: TenancyService) {}

  @Post()
  record(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.tenancies.recordExisting(user.sub, body);
  }

  @Get()
  list(@CurrentUser() user: RequestUser, @Query("propertyId") propertyId: string) {
    return this.tenancies.listForProperty(user.sub, propertyId);
  }

  @Get(":id")
  get(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.tenancies.get(user.sub, id);
  }

  @Post(":id/notify")
  notify(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.tenancies.notify(user.sub, id);
  }

  @Post(":id/reconciliations")
  reconcile(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.tenancies.reconcile(user.sub, id);
  }

  // Tenant response arrives through a secure task (no account). Exposed here for the
  // engine slice and local testing; Phase 1 moves it behind the secure-task token.
  @Public()
  @Post(":id/tenant-response")
  tenantResponse(@Param("id") id: string, @Body() body: unknown) {
    return this.tenancies.tenantResponse(id, body);
  }
}

/** Reconciliation concierge surface: staff reconcile a disputed tenancy (StaffGuard). */
@UseGuards(StaffGuard)
@Controller("internal")
export class TenancyAdminController {
  constructor(private readonly tenancies: TenancyService) {}

  @Post("tenancies/:id/reconcile")
  reconcile(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.tenancies.reconcileForStaff(user.sub, id);
  }
}
