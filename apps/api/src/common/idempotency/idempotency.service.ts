import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * Idempotency (§28.2, DoD). Every mutating command takes an Idempotency-Key.
 * Retries never duplicate obligations, fees, messages or Work.
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  hashRequest(body: unknown): string {
    return createHash("sha256").update(JSON.stringify(body ?? {})).digest("hex");
  }

  /** Returns a stored response for a replayed key, else runs fn and records the result. */
  async run<T>(
    key: string | undefined,
    actor: string,
    requestHash: string,
    fn: () => Promise<T>,
  ): Promise<{ result: T; replayed: boolean }> {
    if (!key) {
      return { result: await fn(), replayed: false };
    }
    const existing = await this.prisma.idempotencyKey.findUnique({ where: { key } });
    if (existing) {
      return { result: existing.responseRef as T, replayed: true };
    }
    const result = await fn();
    await this.prisma.idempotencyKey.create({
      data: {
        key,
        actor,
        requestHash,
        responseRef: (result ?? null) as object,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return { result, replayed: false };
  }
}
