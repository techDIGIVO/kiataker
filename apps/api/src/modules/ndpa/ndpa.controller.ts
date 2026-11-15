import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { NdpaService, type DsrKind } from "./ndpa.service.js";
import { StaffGuard } from "../admin/staff.guard.js";
import { Public } from "../../common/auth/public.decorator.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";

/** Subject surface: a signed-in person raises an access or erasure request about themselves (GJ-19). */
@Controller("data-requests")
export class NdpaController {
  constructor(private readonly ndpa: NdpaService) {}

  @Post()
  raise(@CurrentUser() user: RequestUser, @Body() body: { kind?: DsrKind }) {
    return this.ndpa.raise(user.sub, body.kind === "ERASURE" ? "ERASURE" : "ACCESS", user.sub);
  }
}

/** Public surface: the subject confirms identity on a secure link, then sees or triggers the outcome. */
@Controller("data-request")
export class NdpaPublicController {
  constructor(private readonly ndpa: NdpaService) {}

  @Public()
  @Get(":token")
  view(@Param("token") token: string) {
    return this.ndpa.publicView(token);
  }

  @Public()
  @Post(":token/confirm")
  confirm(@Param("token") token: string) {
    return this.ndpa.confirm(token);
  }
}

/** Staff board of data-subject requests. Staff can raise on a person's behalf and decline a request. */
@UseGuards(StaffGuard)
@Controller("internal")
export class NdpaAdminController {
  constructor(private readonly ndpa: NdpaService) {}

  @Get("board/data-requests")
  board() {
    return this.ndpa.board();
  }

  @Get("data-requests/:id")
  detail(@Param("id") id: string) {
    return this.ndpa.detail(id);
  }

  @Post("data-requests")
  raise(@CurrentUser() user: RequestUser, @Body() body: { subjectId: string; kind?: DsrKind }) {
    return this.ndpa.raise(body.subjectId, body.kind === "ERASURE" ? "ERASURE" : "ACCESS", user.sub);
  }

  @Post("data-requests/:id/refuse")
  refuse(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: { reason: string }) {
    return this.ndpa.refuse(user.sub, id, body.reason);
  }
}
