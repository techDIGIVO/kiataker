import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { TemplatesService } from "./templates.service.js";
import { StaffGuard } from "../admin/staff.guard.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";

/** Template studio (staff). Author and counsel-approve notice/agreement templates (P0-09). */
@UseGuards(StaffGuard)
@Controller("internal")
export class TemplatesAdminController {
  constructor(private readonly templates: TemplatesService) {}

  @Get("board/templates")
  board() {
    return this.templates.board();
  }

  @Post("templates")
  create(@CurrentUser() user: RequestUser, @Body() body: { code: string; name: string; body: string; legalBasis?: string; fields?: string[] }) {
    return this.templates.createTemplate(user.sub, body);
  }

  @Post("templates/:id/versions")
  addVersion(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: { name: string; body: string; legalBasis?: string; fields?: string[] }) {
    return this.templates.addVersion(user.sub, id, body);
  }

  @Post("template-versions/:versionId/approve")
  approve(@CurrentUser() user: RequestUser, @Param("versionId") versionId: string, @Body() body: { counselName?: string }) {
    return this.templates.approve(user.sub, versionId, body?.counselName);
  }

  @Post("template-versions/:versionId/preview")
  preview(@Param("versionId") versionId: string, @Body() body: { values?: Record<string, string> }) {
    return this.templates.preview(versionId, body?.values ?? {});
  }
}
