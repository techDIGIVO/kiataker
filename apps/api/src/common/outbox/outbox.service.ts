import { Injectable } from "@nestjs/common";
import type { Tx } from "../prisma/tx.js";

/**
 * Transactional outbox (§41.3, BP-15). Events commit in the same transaction as the
 * business write. Event names are past tense; a version lives in the payload.
 */
@Injectable()
export class OutboxService {
  async emit(
    tx: Tx,
    type: string,
    aggregateRef: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: { type, aggregateRef, payload: { version: 1, ...payload } },
    });
  }
}
