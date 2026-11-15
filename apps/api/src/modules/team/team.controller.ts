import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { TeamService } from "./team.service.js";
import { AccessService } from "./access.service.js";
import { StaffGuard } from "../admin/staff.guard.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";

/** Team and access management (P0-07). Staff-only; mutations are super-admin-only in the service. */
@UseGuards(StaffGuard)
@Controller("internal")
export class TeamController {
  constructor(
    private readonly team: TeamService,
    private readonly access: AccessService,
  ) {}

  /** The current user's own access (centres + super-admin), used by the admin to scope its nav. */
  @Get("me/access")
  myAccess(@CurrentUser() user: RequestUser) {
    return this.access.access(user.sub);
  }

  @Get("command-centres")
  centres() {
    return this.team.commandCentres();
  }

  @Get("team")
  list(@CurrentUser() user: RequestUser) {
    return this.team.listStaff(user.sub);
  }

  @Post("team")
  add(@CurrentUser() user: RequestUser, @Body() body: { displayName: string; email: string; password: string; centreKey: string; role: string }) {
    return this.team.addStaff(user.sub, body);
  }

  @Put("team/:id/status")
  status(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: { status: "ACTIVE" | "SUSPENDED" }) {
    return this.team.setStatus(user.sub, id, body.status);
  }

  @Post("team/:id/centres")
  assign(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: { centreKey: string; role: string }) {
    return this.team.assignCentre(user.sub, id, body.centreKey, body.role);
  }

  @Delete("team/:id/centres/:centreKey")
  unassign(@CurrentUser() user: RequestUser, @Param("id") id: string, @Param("centreKey") centreKey: string) {
    return this.team.unassignCentre(user.sub, id, centreKey);
  }

  @Delete("team/:id")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.team.removeStaff(user.sub, id);
  }
}
