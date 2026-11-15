import { Module } from "@nestjs/common";
import { NoticesController, NoticesAdminController } from "./notices.controller.js";
import { NoticesService } from "./notices.service.js";

@Module({
  controllers: [NoticesController, NoticesAdminController],
  providers: [NoticesService],
  exports: [NoticesService],
})
export class NoticesModule {}
