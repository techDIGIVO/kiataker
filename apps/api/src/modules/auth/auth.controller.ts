import { Body, Controller, Get, Post } from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import { Public } from "../../common/auth/public.decorator.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("auth/signup")
  signup(@Body() body: unknown) {
    return this.auth.signup(body);
  }

  @Public()
  @Post("auth/code/send")
  sendCode(@Body() body: unknown) {
    return this.auth.sendCode(body);
  }

  @Public()
  @Post("auth/code/verify")
  verifyCode(@Body() body: unknown) {
    return this.auth.verifyCode(body);
  }

  @Public()
  @Post("auth/login")
  login(@Body() body: unknown) {
    return this.auth.login(body);
  }

  @Public()
  @Post("auth/refresh")
  refresh(@Body() body: { refreshToken: string }) {
    return this.auth.refresh(body.refreshToken);
  }

  @Get("auth/me")
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user.sub);
  }

  @Post("account/agreements")
  acceptTerms(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.auth.acceptTerms(user.sub, body);
  }
}
