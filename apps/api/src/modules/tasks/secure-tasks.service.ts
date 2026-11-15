import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { CryptoService } from "../../common/crypto/crypto.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { TenancyService } from "../tenancy/tenancy.service.js";
import { NoticesService } from "../notices/notices.service.js";
import { NotFound, Conflict } from "../../common/errors/domain-errors.js";
import { env } from "../../common/config/env.js";
import type { SecureTask } from "@kiataker/db";

const MAX_ATTEMPTS = 10;

/**
 * Secure page engine (PRD §14, P1-05, SEC-01..SEC-11). One time-limited task with no
 * account (tenants, guarantors, witnesses) or an authenticated step (landlords). Tokens
 * are hashed at rest, expire in 7 days, can be revoked, superseded and rate-limited.
 */
@Injectable()
export class SecureTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly tenancy: TenancyService,
    private readonly notices: NoticesService,
  ) {}

  private async resolve(token: string): Promise<SecureTask> {
    const task = await this.prisma.secureTask.findUnique({
      where: { tokenHash: this.crypto.valueHash(token) },
    });
    if (!task) throw new NotFound("This link is not valid");
    if (task.revokedAt) throw new Conflict("This link was revoked");
    if (task.supersededBy) throw new Conflict("A newer link has replaced this one");
    if (task.expiresAt < new Date()) throw new Conflict("This link has expired. Request a new one.");
    if (task.verifiedAt) throw new Conflict("This link was already used");
    if (task.attempts >= MAX_ATTEMPTS) throw new Conflict("Too many attempts. Request a new link.");
    return task;
  }

  /** What the secure page shows the visitor (page states: active, else resolve throws). */
  async get(token: string) {
    const task = await this.resolve(token);
    return {
      purpose: task.purpose,
      recipientRole: task.recipientRole,
      subjectRef: task.subjectRef,
      expiresAt: task.expiresAt.toISOString(),
      state: "active" as const,
    };
  }

  /**
   * Act on a secure page: a tenant confirms/disputes/corrects (BP-19), or a landlord
   * approves a notice (the higher-risk step that hands off from chat to a secure page, BP-09).
   */
  async respond(token: string, body: unknown) {
    const task = await this.resolve(token);
    await this.prisma.secureTask.update({
      where: { id: task.id },
      data: { attempts: { increment: 1 } },
    });

    let result: unknown;
    let actor = "tenant";
    if (task.purpose === "TENANT_CONFIRM") {
      result = await this.tenancy.tenantResponse(task.subjectRef.replace("tenancy:", ""), body);
    } else if (task.purpose === "APPROVE_NOTICE") {
      actor = "landlord";
      result = await this.notices.approveAndDispatch(task.subjectRef.replace("notice:", ""), "landlord");
    } else {
      throw new Conflict("This link is not for a response");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.secureTask.update({ where: { id: task.id }, data: { verifiedAt: new Date() } });
      await tx.taskResponse.create({ data: { taskId: task.id, kind: "RESPOND", payload: body as object } });
      await this.audit.record(tx, { actor, action: "secure_task.respond", objectRef: `secure_task:${task.id}` });
    });
    return result;
  }

  /** Issue a fresh link and supersede the old one (SEC-04). */
  async requestNewLink(token: string): Promise<{ reissued: true; token?: string }> {
    const old = await this.prisma.secureTask.findUnique({
      where: { tokenHash: this.crypto.valueHash(token) },
    });
    if (!old) throw new NotFound("This link is not valid");
    if (old.verifiedAt) throw new Conflict("This task is already complete");

    const newToken = randomBytes(24).toString("hex");
    const created = await this.prisma.secureTask.create({
      data: {
        purpose: old.purpose,
        recipientRole: old.recipientRole,
        destinationHash: old.destinationHash,
        subjectRef: old.subjectRef,
        documentVersionId: old.documentVersionId,
        documentHash: old.documentHash,
        tokenHash: this.crypto.valueHash(newToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    await this.prisma.secureTask.update({
      where: { id: old.id },
      data: { supersededBy: created.id },
    });
    return { reissued: true, ...(env.WHATSAPP_ADAPTER === "fake" ? { token: newToken } : {}) };
  }
}
