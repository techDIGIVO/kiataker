import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { Forbidden } from "../../common/errors/domain-errors.js";
import type { RequestUser } from "../../common/auth/current-user.decorator.js";

/** Staff-only guard for the admin (Command Centres). Runs after the global JWT guard. */
@Injectable()
export class StaffGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    if (!req.user || req.user.kind !== "STAFF") throw new Forbidden("Staff access only");
    return true;
  }
}
