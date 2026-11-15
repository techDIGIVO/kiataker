import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { OutboxService } from "../../common/outbox/outbox.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { LabelService } from "../../common/read/label.service.js";
import { Forbidden, NotFound, Conflict } from "../../common/errors/domain-errors.js";

const WINDOW_DAYS = 90; // renewal decision window before expiry
const SAFE_NOTICE_DAYS = 183; // ~6 months: the deadline to serve a notice to quit

const RUNWAY_ORDER = ["NOTICE_TO_QUIT", "NOTICE_SERVED", "POSSESSION_READY"] as const;

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

/**
 * Renewals and the Notice to Quit Runway (PRD §18, GJ-22). As a tenancy nears expiry a renewal
 * decision is due: renew (new term, extended expiry) or not. Declining opens a staged runway to
 * recover possession, anchored on the last safe date to serve a notice to quit. Builds on the
 * tenancy lifecycle; the actual notice is served through the notice engine (GJ-07).
 */
@Injectable()
export class RenewalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly labels: LabelService,
  ) {}

  /** Resolve the owning landlord of a tenancy (the property's PB-01 participant), for staff actions. */
  private async ownerOfTenancy(tenancyId: string): Promise<string> {
    const tenancy = await this.prisma.tenancy.findUnique({ where: { id: tenancyId } });
    if (!tenancy) throw new NotFound("Tenancy not found");
    const link = await this.prisma.propertyParticipant.findFirst({ where: { propertyId: tenancy.propertyId, basis: "PB-01" } });
    if (!link) throw new NotFound("This tenancy has no landlord on record");
    return link.participantId;
  }

  /** Staff renew a tenancy on the landlord's behalf (concierge). */
  async staffRenew(staffId: string, tenancyId: string, input: { rentKobo?: string; months?: number }) {
    const result = await this.renew(await this.ownerOfTenancy(tenancyId), tenancyId, input);
    await this.prisma.$transaction((tx) => this.audit.record(tx, { actor: staffId, action: "admin.renewal.renew", objectRef: `tenancy:${tenancyId}`, reason: "staff action" }));
    return result;
  }

  /** Staff decline a renewal and open the possession runway (concierge). */
  async staffNotRenew(staffId: string, tenancyId: string) {
    const result = await this.notRenew(await this.ownerOfTenancy(tenancyId), tenancyId);
    await this.prisma.$transaction((tx) => this.audit.record(tx, { actor: staffId, action: "admin.renewal.not_renew", objectRef: `tenancy:${tenancyId}`, reason: "staff action" }));
    return result;
  }

  /** Staff advance the possession runway one stage (concierge). */
  async staffAdvance(staffId: string, tenancyId: string) {
    const result = await this.advanceRunway(await this.ownerOfTenancy(tenancyId), tenancyId);
    await this.prisma.$transaction((tx) => this.audit.record(tx, { actor: staffId, action: "admin.renewal.advance", objectRef: `tenancy:${tenancyId}`, reason: "staff action" }));
    return result;
  }

  private async ownTenancy(landlordId: string, tenancyId: string) {
    const tenancy = await this.prisma.tenancy.findUnique({ where: { id: tenancyId }, include: { property: true, terms: { orderBy: { version: "desc" }, take: 1 } } });
    if (!tenancy) throw new NotFound("Tenancy not found");
    const link = await this.prisma.propertyParticipant.findFirst({ where: { participantId: landlordId, propertyId: tenancy.propertyId } });
    if (!link) throw new Forbidden("This tenancy is not on your account");
    return tenancy;
  }

  /** Tenancies within the renewal window (expiry approaching), with their runway state. */
  async window(landlordId: string) {
    const links = await this.prisma.propertyParticipant.findMany({ where: { participantId: landlordId } });
    const propertyIds = links.map((l) => l.propertyId);
    if (propertyIds.length === 0) return [];
    const now = new Date();
    const horizon = addDays(now, WINDOW_DAYS);
    const tenancies = await this.prisma.tenancy.findMany({
      where: { propertyId: { in: propertyIds }, managementState: "MANAGED", expiryDate: { lte: horizon } },
      include: { property: true, participants: { include: { tenantProfile: true } } },
      orderBy: { expiryDate: "asc" },
      take: 50,
    });
    // One query for every tenancy's runways; keep the latest per tenancy in a map (no per-row read).
    const runwayList = await this.prisma.renewalRunway.findMany({ where: { tenancyId: { in: tenancies.map((t) => t.id) } }, orderBy: { createdAt: "desc" } });
    const latestRunway = new Map<string, (typeof runwayList)[number]>();
    for (const r of runwayList) if (!latestRunway.has(r.tenancyId)) latestRunway.set(r.tenancyId, r);
    return tenancies.map((t) => {
      const runway = latestRunway.get(t.id);
      const lastSafeNoticeDate = t.expiryDate ? addDays(t.expiryDate, -SAFE_NOTICE_DAYS) : null;
      return {
        tenancyId: t.id,
        property: `${t.property.reference} · ${t.property.addressRaw}`,
        tenant: t.participants[0]?.tenantProfile?.name ?? null,
        expiryDate: t.expiryDate?.toISOString() ?? null,
        lastSafeNoticeDate: lastSafeNoticeDate?.toISOString() ?? null,
        pastSafeNoticeDate: lastSafeNoticeDate ? lastSafeNoticeDate < now : false,
        decision: runway?.decision ?? null,
        stage: runway?.stage ?? "DECISION_DUE",
      };
    });
  }

  /** Renew the tenancy: a new term and an extended expiry (status RENEWED). */
  async renew(landlordId: string, tenancyId: string, input: { rentKobo?: string; months?: number }) {
    const tenancy = await this.ownTenancy(landlordId, tenancyId);
    if (tenancy.managementState !== "MANAGED") throw new Conflict("Only a managed tenancy can be renewed");
    const months = input.months && input.months > 0 ? input.months : 12;
    const base = tenancy.expiryDate ?? new Date();
    const newExpiry = addMonths(base, months);
    const latest = tenancy.terms[0];
    const rentKobo = input.rentKobo ? BigInt(input.rentKobo) : (latest?.rentKobo ?? 0n);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.tenancyTerm.create({ data: { tenancyId, version: (latest?.version ?? 0) + 1, rentKobo, frequency: latest?.frequency ?? "annual", cautionFeeKobo: latest?.cautionFeeKobo ?? null, noticePeriod: latest?.noticePeriod ?? null, effectiveFrom: base } });
      await tx.tenancy.update({ where: { id: tenancyId }, data: { status: "RENEWED", expiryDate: newExpiry, lifecyclePhase: "CURRENT" } });
      const runway = await tx.renewalRunway.create({ data: { tenancyId, stage: "RENEWED", decision: "RENEW", lastSafeNoticeDate: addDays(newExpiry, -SAFE_NOTICE_DAYS) } });
      await tx.propertyTimelineEvent.create({ data: { propertyId: tenancy.propertyId, eventType: "tenancy.renewed", summary: `Tenancy renewed to ${newExpiry.toDateString()}` } });
      await this.outbox.emit(tx, "tenancy.renewed", tenancyId, { newExpiry: newExpiry.toISOString() });
      await this.audit.record(tx, { actor: landlordId, action: "tenancy.renew", objectRef: `tenancy:${tenancyId}`, after: { newExpiry: newExpiry.toISOString() } });
      return runway;
    });
    return { tenancyId, decision: "RENEW", stage: "RENEWED", newExpiry: newExpiry.toISOString(), rentKobo: rentKobo.toString(), runwayId: result.id };
  }

  /** Decline renewal: open the Notice to Quit runway to recover possession. */
  async notRenew(landlordId: string, tenancyId: string) {
    const tenancy = await this.ownTenancy(landlordId, tenancyId);
    const existing = await this.prisma.renewalRunway.findFirst({ where: { tenancyId, decision: "NOT_RENEW" } });
    if (existing) return this.runwayDto(tenancy, existing);
    const lastSafe = tenancy.expiryDate ? addDays(tenancy.expiryDate, -SAFE_NOTICE_DAYS) : null;
    const runway = await this.prisma.$transaction(async (tx) => {
      const r = await tx.renewalRunway.create({ data: { tenancyId, stage: "NOTICE_TO_QUIT", decision: "NOT_RENEW", lastSafeNoticeDate: lastSafe } });
      await this.outbox.emit(tx, "renewal.not_renewed", tenancyId, {});
      await this.audit.record(tx, { actor: landlordId, action: "renewal.not_renew", objectRef: `tenancy:${tenancyId}` });
      return r;
    });
    return this.runwayDto(tenancy, runway);
  }

  /** Advance the Notice to Quit runway one stage (served, then possession-ready). */
  async advanceRunway(landlordId: string, tenancyId: string) {
    const tenancy = await this.ownTenancy(landlordId, tenancyId);
    const runway = await this.prisma.renewalRunway.findFirst({ where: { tenancyId, decision: "NOT_RENEW" }, orderBy: { createdAt: "desc" } });
    if (!runway) throw new Conflict("Open the Notice to Quit runway first by declining the renewal");
    const idx = RUNWAY_ORDER.indexOf(runway.stage as (typeof RUNWAY_ORDER)[number]);
    if (idx < 0 || idx >= RUNWAY_ORDER.length - 1) throw new Conflict("The runway is already at its final stage");
    const next = RUNWAY_ORDER[idx + 1];
    const updated = await this.prisma.renewalRunway.update({ where: { id: runway.id }, data: { stage: next } });
    await this.prisma.$transaction((tx) => this.audit.record(tx, { actor: landlordId, action: "renewal.runway_advance", objectRef: `tenancy:${tenancyId}`, after: { stage: next } }));
    return this.runwayDto(tenancy, updated);
  }

  async runway(landlordId: string, tenancyId: string) {
    const tenancy = await this.ownTenancy(landlordId, tenancyId);
    const runway = await this.prisma.renewalRunway.findFirst({ where: { tenancyId }, orderBy: { createdAt: "desc" } });
    return runway ? this.runwayDto(tenancy, runway) : { tenancyId, runwayId: null, stage: "DECISION_DUE", decision: null, expiryDate: tenancy.expiryDate?.toISOString() ?? null, lastSafeNoticeDate: tenancy.expiryDate ? addDays(tenancy.expiryDate, -SAFE_NOTICE_DAYS).toISOString() : null };
  }

  async board() {
    const runways = await this.prisma.renewalRunway.findMany({ orderBy: { updatedAt: "desc" }, take: 200 });
    const tenancies = await this.labels.tenancies(runways.map((r) => r.tenancyId));
    return runways.map((r) => {
      const label = tenancies.get(r.tenancyId);
      return {
        tenancyId: r.tenancyId,
        property: label?.property ?? null,
        tenant: label?.tenant ?? null,
        decision: r.decision,
        stage: r.stage,
        expiryDate: label?.expiryDate?.toISOString() ?? null,
        lastSafeNoticeDate: r.lastSafeNoticeDate?.toISOString() ?? null,
      };
    });
  }

  private runwayDto(tenancy: { id: string; expiryDate: Date | null }, runway: { id: string; stage: string; decision: string | null; lastSafeNoticeDate: Date | null }) {
    return {
      tenancyId: tenancy.id,
      runwayId: runway.id,
      decision: runway.decision,
      stage: runway.stage,
      expiryDate: tenancy.expiryDate?.toISOString() ?? null,
      lastSafeNoticeDate: runway.lastSafeNoticeDate?.toISOString() ?? null,
    };
  }
}
