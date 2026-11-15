import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { TokenService } from "./token.service.js";
import { IS_PUBLIC_KEY } from "./public.decorator.js";
import { Unauthenticated } from "../errors/domain-errors.js";

/** Global auth guard. Verifies the bearer access token unless the route is @Public. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new Unauthenticated();
    try {
      const claims = this.tokens.verifyAccess(header.slice(7));
      (req as Request & { user: unknown }).user = claims;
      return true;
    } catch {
      throw new Unauthenticated("Session expired or invalid");
    }
  }
}
