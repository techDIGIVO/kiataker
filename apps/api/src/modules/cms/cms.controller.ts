import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { CmsService } from "./cms.service.js";
import { UploadsService } from "./uploads.service.js";
import { Public } from "../../common/auth/public.decorator.js";
import { StaffGuard } from "../admin/staff.guard.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";

/** Public: the published page content the landing site renders. */
@Controller("pages")
export class PublicPagesController {
  constructor(private readonly cms: CmsService) {}

  @Public()
  @Get(":slug")
  getPublished(@Param("slug") slug: string) {
    return this.cms.getPublished(slug);
  }
}

/** Staff: the CMS builder backend (load draft, save, publish, media). */
@UseGuards(StaffGuard)
@Controller("internal")
export class CmsAdminController {
  constructor(
    private readonly cms: CmsService,
    private readonly uploads: UploadsService,
  ) {}

  @Get("pages/:slug")
  get(@Param("slug") slug: string) {
    return this.cms.getForAdmin(slug);
  }

  @Put("pages/:slug")
  save(@CurrentUser() user: RequestUser, @Param("slug") slug: string, @Body() body: { title: string; draft: unknown }) {
    return this.cms.saveDraft(slug, body, user.sub);
  }

  @Post("pages/:slug/publish")
  publish(@CurrentUser() user: RequestUser, @Param("slug") slug: string) {
    return this.cms.publish(slug, user.sub);
  }

  @Get("media")
  media() {
    return this.cms.listMedia();
  }

  @Post("uploads")
  upload(@CurrentUser() user: RequestUser, @Body() body: { filename?: string; mimeType: string; dataBase64: string }) {
    return this.uploads.upload(body, user.sub);
  }
}
