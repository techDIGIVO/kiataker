import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ActionService } from "./action.service.js";
import { StaffGuard } from "../admin/staff.guard.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";

@Controller("actions")
export class ActionController {
  constructor(private readonly actions: ActionService) {}

  @Get("summary")
  summary(@CurrentUser() user: RequestUser) {
    return this.actions.summary(user.sub);
  }

  @Get()
  list(@CurrentUser() user: RequestUser, @Query("tab") tab = "act") {
    return this.actions.list(user.sub, tab);
  }

  @Post(":id/acknowledge")
  acknowledge(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.actions.acknowledge(user.sub, id);
  }
}

/** Staff: acknowledge an Act Now item from the admin Operations queue. */
@UseGuards(StaffGuard)
@Controller("internal")
export class ActionAdminController {
  constructor(private readonly actions: ActionService) {}

  @Post("actions/:id/acknowledge")
  acknowledge(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.actions.staffAcknowledge(user.sub, id);
  }
}
