import { Injectable } from "@nestjs/common";
import { randomBytes, createHash } from "node:crypto";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { CryptoService } from "../../common/crypto/crypto.service.js";
import { OutboxService } from "../../common/outbox/outbox.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { Forbidden, NotFound, Conflict } from "../../common/errors/domain-errors.js";
import { env } from "../../common/config/env.js";

/** Default counsel-approved notice templates (NT codes). Seeded lazily. */
const DEFAULT_TEMPLATES = [
  { code: "NT-01", name: "Notice of Rent Review", legalBasis: "Tenancy agreement rent review clause", body: "NOTICE OF RENT REVIEW\n\nTo {tenantName},\nRe: {propertyAddress}\n\nTake notice that the rent will be reviewed with effect from {effectiveDate}." },
  { code: "NT-02", name: "Notice of Owner's Intention to Apply to Recover Possession", legalBasis: "Lagos State Tenancy Law 2011", body: "NOTICE OF OWNER'S INTENTION TO APPLY TO RECOVER POSSESSION\n\nTo {tenantName},\nRe: {propertyAddress}\n\nTake notice that the owner intends to apply to recover possession after {effectiveDate}." },
];

/**
 * Notice engine (PRD §17, NOT, GJ-07). Instruct, approve on a secure page (higher-risk step,
 * BP-09), generate from a counsel-approved template, dispatch, and record delivery truthfully
 * ("sent" is not "delivered", BP-16). Issued by KIA TAKER LTD as the landlord's agent.
 */
@Injectable()
export class NoticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  async ensureTemplates(): Promise<void> {
    for (const t of DEFAULT_TEMPLATES) {
      const existing = await this.prisma.template.findUnique({ where: { code: t.code } });
      if (existing) continue;
      const tpl = await this.prisma.template.create({ data: { code: t.code } });
      await this.prisma.templateVersion.create({
        data: {
          templateId: tpl.id,
          version: 1,
          body: t.body,
          variables: { name: t.name, fields: ["tenantName", "propertyAddress", "effectiveDate"] },
          legalBasis: t.legalBasis,
          counselApprovedBy: "seed-counsel",
          counselApprovedAt: new Date(),
        },
      });
    }
  }

  async listTemplates() {
    await this.ensureTemplates();
    const templates = await this.prisma.template.findMany({ include: { versions: { orderBy: { version: "desc" }, take: 1 } } });
    return templates
      .flatMap((t) => t.versions.map((v) => ({ templateVersionId: v.id, code: t.code, name: (v.variables as { name?: string })?.name ?? t.code, approved: Boolean(v.counselApprovedAt) })))
      .filter((t) => t.approved);
  }

  private async assertOwnership(participantId: string, propertyId: string): Promise<void> {
    const link = await this.prisma.propertyParticipant.findFirst({ where: { participantId, propertyId } });
    if (!link) throw new Forbidden("This property is not on your account");
  }

  /** Instruct a notice. The actual approval happens on an authenticated secure page (BP-09). */
  async instruct(participantId: string, input: { tenancyId: string; templateVersionId: string; effectiveDate?: string }) {
    const tenancy = await this.prisma.tenancy.findUnique({ where: { id: input.tenancyId }, include: { participants: { include: { tenantProfile: true } } } });
    if (!tenancy) throw new NotFound("Tenancy not found");
    await this.assertOwnership(participantId, tenancy.propertyId);

    const version = await this.prisma.templateVersion.findUnique({ where: { id: input.templateVersionId } });
    if (!version) throw new NotFound("Template not found");
    if (!version.counselApprovedAt) throw new Conflict("This template is not counsel-approved");

    const token = randomBytes(24).toString("hex");
    const result = await this.prisma.$transaction(async (tx) => {
      const notice = await tx.notice.create({
        data: {
          propertyId: tenancy.propertyId,
          tenancyId: tenancy.id,
          templateVersionId: version.id,
          status: "INSTRUCTED",
          effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : null,
        },
      });
      await tx.secureTask.create({
        data: {
          purpose: "APPROVE_NOTICE",
          recipientRole: "LANDLORD",
          destinationHash: this.crypto.valueHash(participantId),
          subjectRef: `notice:${notice.id}`,
          tokenHash: this.crypto.valueHash(token),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      await this.outbox.emit(tx, "notice.instructed", notice.id, { tenancyId: tenancy.id });
      await this.audit.record(tx, { actor: participantId, action: "notice.instruct", objectRef: `notice:${notice.id}` });
      return notice;
    });

    return { notice: this.toDto(result), ...(env.WHATSAPP_ADAPTER === "fake" ? { secureTaskToken: token } : {}) };
  }

  /** Approve on the secure page, then generate, dispatch and record delivery (GJ-07). */
  async approveAndDispatch(noticeId: string, actor: string) {
    const notice = await this.prisma.notice.findUnique({ where: { id: noticeId }, include: { recipients: true } });
    if (!notice) throw new NotFound("Notice not found");
    if (notice.status !== "INSTRUCTED") throw new Conflict(`Notice is already ${notice.status}`);

    const version = notice.templateVersionId ? await this.prisma.templateVersion.findUnique({ where: { id: notice.templateVersionId } }) : null;
    const tenancy = await this.prisma.tenancy.findUnique({ where: { id: notice.tenancyId ?? "" }, include: { participants: { include: { tenantProfile: true } }, property: true } });
    const tenantName = tenancy?.participants[0]?.tenantProfile.name ?? "the tenant";
    const address = tenancy?.property.addressRaw ?? "the property";
    const body = (version?.body ?? "")
      .replace("{tenantName}", tenantName)
      .replace("{propertyAddress}", address)
      .replace("{effectiveDate}", notice.effectiveDate?.toDateString() ?? "the effective date");
    const contentHash = createHash("sha256").update(body).digest("hex");

    await this.prisma.$transaction(async (tx) => {
      await tx.notice.update({ where: { id: noticeId }, data: { status: "DISPATCHED", authorisedBy: actor, contentHash, serviceDate: new Date() } });
      // Electronic delivery via the fake adapter: sent, but not confirmed (BP-16).
      await tx.noticeRecipient.create({ data: { noticeId, basis: "tenant", channel: "whatsapp", outcome: "sent", at: new Date() } });
      await this.outbox.emit(tx, "notice.authorised", noticeId, { by: actor });
      await this.outbox.emit(tx, "notice.generated", noticeId, { contentHash });
      await this.outbox.emit(tx, "notice.dispatched", noticeId, {});
      await this.outbox.emit(tx, "delivery.attempted", noticeId, { channel: "whatsapp", outcome: "sent" });
      await this.audit.record(tx, { actor, action: "notice.approve_dispatch", objectRef: `notice:${noticeId}`, after: { contentHash } });
    });

    return this.get(noticeId);
  }

  async getForOwner(participantId: string, noticeId: string) {
    const notice = await this.prisma.notice.findUnique({ where: { id: noticeId } });
    if (!notice) throw new NotFound("Notice not found");
    await this.assertOwnership(participantId, notice.propertyId);
    return this.get(noticeId);
  }

  async get(noticeId: string) {
    const notice = await this.prisma.notice.findUnique({ where: { id: noticeId }, include: { recipients: true } });
    if (!notice) throw new NotFound("Notice not found");
    const recipient = notice.recipients[0];
    return {
      ...this.toDto(notice),
      contentHash: notice.contentHash,
      delivery: recipient
        ? { channel: recipient.channel, status: recipient.outcome === "sent" ? "sent, not confirmed" : recipient.outcome, at: recipient.at?.toISOString() ?? null }
        : null,
    };
  }

  /** Request physical service (CP-08 litigation clerk) when electronic delivery is unconfirmed. */
  async requestPhysicalService(participantId: string, noticeId: string) {
    const notice = await this.prisma.notice.findUnique({ where: { id: noticeId } });
    if (!notice) throw new NotFound("Notice not found");
    await this.assertOwnership(participantId, notice.propertyId);
    await this.prisma.$transaction(async (tx) => {
      await tx.propertyTimelineEvent.create({ data: { propertyId: notice.propertyId, eventType: "notice.physical_service_requested", summary: "Physical service of a notice requested" } });
      await this.outbox.emit(tx, "notice.physical_service_requested", noticeId, {});
      await this.audit.record(tx, { actor: participantId, action: "notice.request_physical_service", objectRef: `notice:${noticeId}` });
    });
    return { requested: true, note: "Our team will price physical service by a litigation clerk and coordinate it from the chat." };
  }

  /** Staff view a notice's full detail (concierge; no ownership gate). */
  async staffDetail(noticeId: string) {
    return this.get(noticeId);
  }

  /** Staff request physical service on the landlord's behalf (concierge, CP-08). */
  async staffRequestPhysicalService(staffId: string, noticeId: string) {
    const notice = await this.prisma.notice.findUnique({ where: { id: noticeId } });
    if (!notice) throw new NotFound("Notice not found");
    const link = await this.prisma.propertyParticipant.findFirst({ where: { propertyId: notice.propertyId, basis: "PB-01" } });
    if (!link) throw new NotFound("This notice's property has no landlord on record");
    const result = await this.requestPhysicalService(link.participantId, noticeId);
    await this.prisma.$transaction((tx) => this.audit.record(tx, { actor: staffId, action: "admin.notice.request_physical_service", objectRef: `notice:${noticeId}`, reason: "staff action" }));
    return result;
  }

  private toDto(n: { id: string; status: string; propertyId: string; tenancyId: string | null; effectiveDate: Date | null; createdAt: Date }) {
    return { id: n.id, status: n.status, propertyId: n.propertyId, tenancyId: n.tenancyId, effectiveDate: n.effectiveDate?.toISOString() ?? null, createdAt: n.createdAt.toISOString() };
  }
}
