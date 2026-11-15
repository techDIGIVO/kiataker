import { Module } from "@nestjs/common";
import { NdpaController, NdpaPublicController, NdpaAdminController } from "./ndpa.controller.js";
import { NdpaService } from "./ndpa.service.js";

@Module({
  controllers: [NdpaController, NdpaPublicController, NdpaAdminController],
  providers: [NdpaService],
  exports: [NdpaService],
})
export class NdpaModule {}
