import { Injectable } from "@nestjs/common";
import type { Tx } from "../prisma/tx.js";

/** Audit log (§36, DoD). Every write produces an audit entry with actor, action, object. */
@Injectable()
export class AuditService {
  async record(
    tx: Tx,
    input: {
      actor: string;
      action: string;
      objectRef: string;
      seat?: string;
      reason?: string;
      before?: unknown;
      after?: unknown;
      ip?: string;
    },
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actor: input.actor,
        action: input.action,
        objectRef: input.objectRef,
        seat: input.seat,
        reason: input.reason,
        before: (input.before ?? undefined) as object | undefined,
        after: (input.after ?? undefined) as object | undefined,
        ip: input.ip,
      },
    });
  }
}
