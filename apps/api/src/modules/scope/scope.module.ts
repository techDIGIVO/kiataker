import { Module } from "@nestjs/common";
import { ScopeController, ScopeAdminController } from "./scope.controller.js";
import { ScopeService } from "./scope.service.js";

@Module({
  controllers: [ScopeController, ScopeAdminController],
  providers: [ScopeService],
  exports: [ScopeService],
})
export class ScopeModule {}
