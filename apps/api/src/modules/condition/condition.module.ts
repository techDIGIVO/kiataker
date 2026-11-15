import { Module } from "@nestjs/common";
import { ConditionController, ConditionConfirmController, ConditionAdminController } from "./condition.controller.js";
import { ConditionService } from "./condition.service.js";

@Module({
  controllers: [ConditionController, ConditionConfirmController, ConditionAdminController],
  providers: [ConditionService],
  exports: [ConditionService],
})
export class ConditionModule {}
