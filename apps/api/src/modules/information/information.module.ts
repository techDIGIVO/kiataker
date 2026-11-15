import { Module } from "@nestjs/common";
import { StatementController, StatementAdminController } from "./statement.controller.js";
import { StatementService } from "./statement.service.js";

@Module({
  controllers: [StatementController, StatementAdminController],
  providers: [StatementService],
  exports: [StatementService],
})
export class InformationModule {}
