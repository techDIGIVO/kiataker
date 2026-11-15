import { Module } from "@nestjs/common";
import { CmsService } from "./cms.service.js";
import { UploadsService } from "./uploads.service.js";
import { PublicPagesController, CmsAdminController } from "./cms.controller.js";

@Module({
  controllers: [PublicPagesController, CmsAdminController],
  providers: [CmsService, UploadsService],
})
export class CmsModule {}
