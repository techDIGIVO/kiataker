import { Module } from "@nestjs/common";
import { IntakeAdminController, IntakePublicController } from "./intake.controller.js";
import { IntakeService } from "./intake.service.js";
import { PropertyModule } from "../property/property.module.js";
import { TenancyModule } from "../tenancy/tenancy.module.js";

@Module({
  imports: [PropertyModule, TenancyModule],
  controllers: [IntakeAdminController, IntakePublicController],
  providers: [IntakeService],
})
export class IntakeModule {}
