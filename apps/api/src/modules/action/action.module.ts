import { Module } from "@nestjs/common";
import { ActionController } from "./action.controller.js";
import { ActionService } from "./action.service.js";
import { ActionProjector } from "./action-projector.service.js";

@Module({
  controllers: [ActionController],
  providers: [ActionService, ActionProjector],
  exports: [ActionService],
})
export class ActionModule {}
