import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AccessClaims } from "./token.service.js";

export interface RequestUser extends AccessClaims {}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as RequestUser | undefined;
  },
);
