import { CanActivate, Injectable, NotFoundException } from "@nestjs/common";
import { env } from "../config/env.js";

/**
 * Hides dev-only routes (WhatsApp simulator, test payment completion) unless DEV_TOOLS is on.
 * They let a caller act as any phone number or settle a payment without the PSP, so in
 * production they answer 404 as if they did not exist.
 */
@Injectable()
export class DevToolsGuard implements CanActivate {
  canActivate(): boolean {
    if (!env.DEV_TOOLS) throw new NotFoundException();
    return true;
  }
}
