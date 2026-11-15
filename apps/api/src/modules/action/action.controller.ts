import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ActionService } from "./action.service.js";
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
