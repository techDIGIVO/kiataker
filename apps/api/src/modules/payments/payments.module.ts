import { Module } from "@nestjs/common";
import { PaymentsController, PaymentsPublicController, PaymentsAdminController } from "./payments.controller.js";
import { PaymentsService } from "./payments.service.js";
import { PspService } from "./psp.service.js";
import { RentModule } from "../rent/rent.module.js";

@Module({
  imports: [RentModule],
  controllers: [PaymentsController, PaymentsPublicController, PaymentsAdminController],
  providers: [PaymentsService, PspService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
