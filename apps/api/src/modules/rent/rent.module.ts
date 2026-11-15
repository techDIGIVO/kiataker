import { Module } from "@nestjs/common";
import { RentController, RentAdminController } from "./rent.controller.js";
import { RentService } from "./rent.service.js";
import { RentScanner } from "./rent-scanner.service.js";

@Module({
  controllers: [RentController, RentAdminController],
  providers: [RentService, RentScanner],
  exports: [RentService],
})
export class RentModule {}
