import { Module } from "@nestjs/common";
import { TemplatesAdminController } from "./templates.controller.js";
import { TemplatesService } from "./templates.service.js";
import { NoticesModule } from "../notices/notices.module.js";

@Module({
  imports: [NoticesModule],
  controllers: [TemplatesAdminController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
