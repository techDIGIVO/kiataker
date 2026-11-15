import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { NoticesService } from "./notices.service.js";
import { StaffGuard } from "../admin/staff.guard.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";

@Controller("notices")
export class NoticesController {
  constructor(private readonly notices: NoticesService) {}

  @Get("templates")
  templates() {
    return this.notices.listTemplates();
  }

  @Post()
  instruct(@CurrentUser() user: RequestUser, @Body() body: { tenancyId: string; templateVersionId: string; effectiveDate?: string }) {
    return this.notices.instruct(user.sub, body);
  }

  @Get(":id")
  get(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.notices.getForOwner(user.sub, id);
  }

  @Post(":id/physical-service")
  physical(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.notices.requestPhysicalService(user.sub, id);
  }
}

/** Staff surface: notice detail and concierge physical-service requests. */
@UseGuards(StaffGuard)
@Controller("internal")
export class NoticesAdminController {
  constructor(private readonly notices: NoticesService) {}

  @Get("notices/:id")
  detail(@Param("id") id: string) {
    return this.notices.staffDetail(id);
  }

  @Post("notices/:id/physical-service")
  physical(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.notices.staffRequestPhysicalService(user.sub, id);
  }
}
