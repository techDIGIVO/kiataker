import { Module } from "@nestjs/common";
import { PropertyController } from "./property.controller.js";
import { PropertyService } from "./property.service.js";
import { BuildingController, BuildingAdminController } from "./building.controller.js";
import { BuildingService } from "./building.service.js";

@Module({
  controllers: [PropertyController, BuildingController, BuildingAdminController],
  providers: [PropertyService, BuildingService],
  exports: [PropertyService, BuildingService],
})
export class PropertyModule {}
