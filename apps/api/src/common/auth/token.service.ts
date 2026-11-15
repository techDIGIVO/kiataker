import { Injectable } from "@nestjs/common";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AccessClaims {
  sub: string; // participantId
  kind: "LANDLORD" | "REPRESENTATIVE" | "PROVIDER_USER" | "STAFF";
  stepUp?: boolean;
}

@Injectable()
export class TokenService {
  signAccess(claims: AccessClaims): string {
    return jwt.sign(claims, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL });
  }
  signRefresh(sub: string): string {
    return jwt.sign({ sub, t: "refresh" }, env.JWT_REFRESH_SECRET, {
      expiresIn: env.REFRESH_TOKEN_TTL,
    });
  }
  verifyAccess(token: string): AccessClaims {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessClaims;
  }
  verifyRefresh(token: string): { sub: string } {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string };
  }
}
