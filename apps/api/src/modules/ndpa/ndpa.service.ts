import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { CryptoService } from "../../common/crypto/crypto.service.js";
import { OutboxService } from "../../common/outbox/outbox.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { ControlsService } from "../../common/controls/controls.service.js";
import { NotFound, Conflict } from "../../common/errors/domain-errors.js";
import { env } from "../../common/config/env.js";

export type DsrKind = "ACCESS" | "ERASURE";

/**
 * NDPA data-subject rights (PRD §34, GJ-19, NDPA 2023 ss.34-37). A person can ask for a copy
 * of the personal data Kiataker holds about them (access) or for it to be erased. Identity is
 * proven on a secure link (BP-09) before anything is disclosed or erased. Erasure anonymises
 * the person but keeps records Kiataker must retain under a legal basis, and says so plainly.
 * The whole feature sits behind a platform control and fails closed (BP-08).
 */
@Injectable()
export class NdpaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly controls: ControlsService,
  ) {}

  private async byToken(token: string) {
    const r = await this.prisma.dataSubjectRequest.findFirst({ where: { verifyTokenHash: this.crypto.valueHash(token) } });
    if (!r) throw new NotFound("This link is not valid");
    return r;
  }

  /** Raise a request. The subject (or staff on their behalf) gets a secure link to confirm. */
  async raise(subjectId: string, kind: DsrKind, raisedBy?: string) {
    await this.controls.assertEnabled("compliance.ndpa");
    const subject = await this.prisma.participant.findUnique({ where: { id: subjectId } });
    if (!subject) throw new NotFound("We could not find that person");
    const reference = `KT-DSR-${randomBytes(4).toString("hex").toUpperCase()}`;
    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.$transaction(async (tx) => {
      const r = await tx.dataSubjectRequest.create({
        data: { reference, kind, subjectId, subjectName: subject.displayName, status: "RECEIVED", verifyTokenHash: this.crypto.valueHash(token), verifyExpiresAt: expiresAt, raisedBy: raisedBy ?? subjectId },
      });
      await this.outbox.emit(tx, "ndpa.request_raised", r.id, { kind, reference });
      await this.audit.record(tx, { actor: raisedBy ?? subjectId, action: "ndpa.raise", objectRef: `dsr:${r.id}`, after: { kind, reference } });
    });
    return { reference, kind, confirmUrl: `${env.WEB_BASE_URL}/data-request/${token}`, token: env.WHATSAPP_ADAPTER === "fake" ? token : undefined };
  }

  /** The subject's view of their request on the secure link. Shows the disclosed copy once fulfilled. */
  async publicView(token: string) {
    const r = await this.byToken(token);
    return {
      reference: r.reference,
      kind: r.kind,
      subjectName: r.subjectName,
      status: r.status,
      fulfilled: r.status === "FULFILLED",
      package: r.status === "FULFILLED" ? (r.package as unknown) : null,
      fulfilledAt: r.fulfilledAt?.toISOString() ?? null,
    };
  }

  /** The subject confirms on the secure link. Access discloses the copy; erasure anonymises. Idempotent. */
  async confirm(token: string) {
    await this.controls.assertEnabled("compliance.ndpa");
    const r = await this.byToken(token);
    if (r.verifyExpiresAt && r.verifyExpiresAt < new Date()) throw new Conflict("This link has expired");
    if (r.status === "REFUSED") throw new Conflict("This request was declined. Our team will be in touch.");
    if (r.status === "FULFILLED") return this.publicView(token);

    const pkg = r.kind === "ERASURE" ? await this.performErasure(r.subjectId) : await this.buildAccessPackage(r.subjectId);
    await this.prisma.$transaction(async (tx) => {
      await tx.dataSubjectRequest.update({ where: { id: r.id }, data: { status: "FULFILLED", verifiedAt: new Date(), fulfilledAt: new Date(), package: pkg as object } });
      await this.outbox.emit(tx, r.kind === "ERASURE" ? "ndpa.erasure_fulfilled" : "ndpa.access_fulfilled", r.id, { reference: r.reference });
      await this.audit.record(tx, { actor: r.subjectId, action: r.kind === "ERASURE" ? "ndpa.erase" : "ndpa.access", objectRef: `dsr:${r.id}`, reason: "confirmed on secure link", after: { reference: r.reference } });
    });
    return this.publicView(token);
  }

  /** Gather the personal data Kiataker holds about a person into one disclosable copy. */
  private async buildAccessPackage(subjectId: string) {
    const subject = await this.prisma.participant.findUnique({
      where: { id: subjectId },
      include: { contactPoints: true, propertyLinks: true, termsAcceptances: true },
    });
    if (!subject) throw new NotFound("We could not find that person");

    const contactPoints = subject.contactPoints.map((c) => ({ channel: c.channel, value: this.safeDecrypt(c.valueEncrypted), verified: !!c.verifiedAt, primary: c.primary }));
    const addresses = contactPoints.filter((c) => c.channel === "WHATSAPP" && c.value).map((c) => c.value);

    const properties = [];
    for (const link of subject.propertyLinks) {
      const property = await this.prisma.property.findUnique({ where: { id: link.propertyId } });
      if (property) properties.push({ reference: property.reference, address: property.addressRaw, basis: link.basis });
    }

    const messageCount = addresses.length ? await this.prisma.messageLog.count({ where: { address: { in: addresses } } }) : 0;
    const auditCount = await this.prisma.auditLog.count({ where: { actor: subjectId } });

    return {
      disclosedAt: new Date().toISOString(),
      profile: {
        name: subject.displayName,
        role: subject.kind,
        status: subject.status,
        emailVerified: subject.emailVerified,
        phoneVerified: subject.phoneVerified,
        joinedAt: subject.createdAt.toISOString(),
      },
      contactPoints,
      properties,
      termsAccepted: subject.termsAcceptances.map((t) => ({ channel: t.channel, acceptedAt: t.acceptedAt.toISOString() })),
      conversationMessages: messageCount,
      retained: [
        { category: "Activity and audit log", count: auditCount, basis: "Legal obligation and accountability (NDPA s.24, s.40). Kept, not erased." },
      ],
      note: "This is the personal data Kiataker holds about you. To ask for erasure, start a new request and choose Erase.",
    };
  }

  /** Anonymise the person, keeping only what a legal basis requires. Idempotent on an erased person. */
  private async performErasure(subjectId: string) {
    const subject = await this.prisma.participant.findUnique({ where: { id: subjectId }, include: { contactPoints: true } });
    if (!subject) throw new NotFound("We could not find that person");

    const addresses = subject.contactPoints.map((c) => this.safeDecrypt(c.valueEncrypted)).filter(Boolean);
    const auditCount = await this.prisma.auditLog.count({ where: { actor: subjectId } });

    const alreadyErased = subject.status === "ERASED";
    if (!alreadyErased) {
      await this.prisma.$transaction(async (tx) => {
        // Scrub every contact point: overwrite the encrypted value and break the lookup hash.
        for (const c of subject.contactPoints) {
          await tx.contactPoint.update({ where: { id: c.id }, data: { valueEncrypted: this.crypto.encrypt("[erased]"), valueHash: randomBytes(32).toString("hex"), verifiedAt: null, primary: false } });
        }
        // Erase operational conversation data tied to their addresses (not a legal record).
        if (addresses.length) {
          await tx.conversationSession.deleteMany({ where: { address: { in: addresses } } });
          await tx.messageLog.deleteMany({ where: { address: { in: addresses } } });
        }
        // Erase per-person operational preferences and devices.
        await tx.notificationPreference.deleteMany({ where: { participantId: subjectId } });
        await tx.pushDevice.deleteMany({ where: { participantId: subjectId } });
        await tx.session.updateMany({ where: { participantId: subjectId }, data: { revokedAt: new Date() } });
        // Anonymise the person. The row stays so retained records keep their references intact.
        await tx.participant.update({ where: { id: subjectId }, data: { displayName: "Erased user", status: "ERASED", passwordHash: null } });
      });
    }

    return {
      erasedAt: new Date().toISOString(),
      alreadyErased,
      erased: [
        { category: "Profile name and sign-in", detail: "Name anonymised, password removed, account marked erased." },
        { category: "Contact details", detail: "Phone and email overwritten; no longer linked to you." },
        { category: "WhatsApp conversations and messages", detail: "Deleted." },
        { category: "Notification preferences and devices", detail: "Deleted; active sessions revoked." },
      ],
      retained: [
        { category: "Audit and activity log", count: auditCount, basis: "Legal obligation and accountability (NDPA s.24, s.40)." },
        { category: "Financial and tenancy records", basis: "Tax, anti-money-laundering and contract-of-record duties (NDPA s.34(2))." },
      ],
      note: "Your personal identifiers have been erased. Some records are kept where the law requires it, and those explain why.",
    };
  }

  private safeDecrypt(blob: string): string {
    try {
      return this.crypto.decrypt(blob);
    } catch {
      return "";
    }
  }

  /** Staff: decline a request (e.g. identity not established, or a legal exemption applies). */
  async refuse(staffId: string, id: string, reason: string) {
    if (!reason?.trim()) throw new Conflict("A reason is required to decline a data request");
    const r = await this.prisma.dataSubjectRequest.findUnique({ where: { id } });
    if (!r) throw new NotFound("Request not found");
    if (r.status === "FULFILLED") throw new Conflict("This request is already fulfilled");
    await this.prisma.$transaction(async (tx) => {
      await tx.dataSubjectRequest.update({ where: { id }, data: { status: "REFUSED", refusedReason: reason.trim() } });
      await this.audit.record(tx, { actor: staffId, action: "ndpa.refuse", objectRef: `dsr:${id}`, reason: reason.trim() });
    });
    return this.detail(id);
  }

  async detail(id: string) {
    const r = await this.prisma.dataSubjectRequest.findUnique({ where: { id } });
    if (!r) throw new NotFound("Request not found");
    return this.toDto(r);
  }

  async board() {
    const list = await this.prisma.dataSubjectRequest.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return list.map((r) => this.toDto(r));
  }

  private toDto(r: { id: string; reference: string; kind: string; subjectName: string; status: string; refusedReason: string | null; fulfilledAt: Date | null; createdAt: Date }) {
    return {
      id: r.id,
      reference: r.reference,
      kind: r.kind,
      subjectName: r.subjectName,
      status: r.status,
      refusedReason: r.refusedReason,
      fulfilledAt: r.fulfilledAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
