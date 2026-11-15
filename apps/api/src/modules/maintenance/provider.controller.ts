import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ProviderService } from "./provider.service.js";
import { StaffGuard } from "../admin/staff.guard.js";
import { Public } from "../../common/auth/public.decorator.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";

/** Public provider surface: apply, then work from a token-gated workspace (GJ-10). */
@Controller("providers")
export class ProviderPublicController {
  constructor(private readonly providers: ProviderService) {}

  @Public()
  @Post("apply")
  apply(@Body() body: { name: string; services: string; contactEmail?: string; contactPhone?: string }) {
    return this.providers.apply(body);
  }

  @Public()
  @Get("workspace/:token")
  workspace(@Param("token") token: string) {
    return this.providers.workspace(token);
  }

  @Public()
  @Post("workspace/:token/quotes/:issueId")
  quote(@Param("token") token: string, @Param("issueId") issueId: string, @Body() body: { amountKobo: string; scope: string; assumptions?: string }) {
    return this.providers.submitQuote(token, issueId, body);
  }

  @Public()
  @Post("workspace/:token/work/:workId")
  work(@Param("token") token: string, @Param("workId") workId: string, @Body() body: { evidence?: unknown }) {
    return this.providers.submitWork(token, workId, body);
  }
}

/** Staff: review provider applications, admit or reject. */
@UseGuards(StaffGuard)
@Controller("internal")
export class ProviderAdminController {
  constructor(private readonly providers: ProviderService) {}

  @Get("board/providers")
  board() {
    return this.providers.board();
  }

  @Post("providers/:id/admit")
  admit(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.providers.admit(user.sub, id);
  }

  @Post("providers/:id/reject")
  reject(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.providers.reject(user.sub, id);
  }
}
