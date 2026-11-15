import { Module } from "@nestjs/common";
import { TenancyController, TenancyAdminController } from "./tenancy.controller.js";
import { OriginationController, OriginationAcceptController, OriginationAdminController } from "./origination.controller.js";
import { CloseoutController, CloseoutAdminController } from "./closeout.controller.js";
import { RenewalController, RenewalAdminController } from "./renewal.controller.js";
import { TenancyService } from "./tenancy.service.js";
import { OriginationService } from "./origination.service.js";
import { CloseoutService } from "./closeout.service.js";
import { RenewalService } from "./renewal.service.js";
import { RentModule } from "../rent/rent.module.js";

@Module({
  imports: [RentModule],
  controllers: [TenancyController, TenancyAdminController, OriginationController, OriginationAcceptController, OriginationAdminController, CloseoutController, CloseoutAdminController, RenewalController, RenewalAdminController],
  providers: [TenancyService, OriginationService, CloseoutService, RenewalService],
  exports: [TenancyService, OriginationService, CloseoutService, RenewalService],
})
export class TenancyModule {}
