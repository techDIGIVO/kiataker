import { Module } from "@nestjs/common";
import { TeamController } from "./team.controller.js";
import { TeamService } from "./team.service.js";
import { AccessService } from "./access.service.js";

@Module({
  controllers: [TeamController],
  providers: [TeamService, AccessService],
  exports: [AccessService],
})
export class TeamModule {}
