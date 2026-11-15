import { Module } from "@nestjs/common";
import { MaintenanceController, KonnectAdminController } from "./maintenance.controller.js";
import { ProviderPublicController, ProviderAdminController } from "./provider.controller.js";
import { MaintenanceService } from "./maintenance.service.js";
import { ProviderService } from "./provider.service.js";
import { ScopeModule } from "../scope/scope.module.js";

@Module({
  imports: [ScopeModule],
  controllers: [MaintenanceController, KonnectAdminController, ProviderPublicController, ProviderAdminController],
  providers: [MaintenanceService, ProviderService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
