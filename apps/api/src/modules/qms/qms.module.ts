import { Module } from "@nestjs/common";
import { QmsAdminController } from "./qms.controller.js";
import { QmsService } from "./qms.service.js";

@Module({
  controllers: [QmsAdminController],
  providers: [QmsService],
  exports: [QmsService],
})
export class QmsModule {}
