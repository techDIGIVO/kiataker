import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { SecureTasksService } from "./secure-tasks.service.js";
import { Public } from "../../common/auth/public.decorator.js";

/** Secure pages (app.kiataker.ng/t/...). Token auth, no account. */
@Public()
@Controller("t")
export class SecureTasksController {
  constructor(private readonly tasks: SecureTasksService) {}

  @Get(":token")
  get(@Param("token") token: string) {
    return this.tasks.get(token);
  }

  @Post(":token/respond")
  respond(@Param("token") token: string, @Body() body: unknown) {
    return this.tasks.respond(token, body);
  }

  @Post(":token/request-new-link")
  requestNewLink(@Param("token") token: string) {
    return this.tasks.requestNewLink(token);
  }
}
