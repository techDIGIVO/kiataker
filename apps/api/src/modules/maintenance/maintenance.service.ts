import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { OutboxService } from "../../common/outbox/outbox.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { ScopeService } from "../scope/scope.service.js";
import { Forbidden, NotFound, Conflict } from "../../common/errors/domain-errors.js";

/**
 * Maintenance and Konnect Work (PRD §15, §21, MNT/KON, GJ-09). Report an issue, collect
 * sealed Quotes, accept one, track the Work with evidence. A provider marking Work complete
 * does NOT close it: landlord acceptance (or QC) does (BP-12). Vocabulary is Work and Quote.
 */
@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly scope: ScopeService,
  ) {}

  private async ownsProperty(participantId: string, propertyId: string): Promise<void> {
    const link = await this.prisma.propertyParticipant.findFirst({ where: { participantId, propertyId } });
    if (!link) throw new Forbidden("This property is not on your account");
  }

  async report(participantId: string, input: { propertyId: string; tenancyId?: string; category: string; description: string; urgency?: string; evidenceRef?: string }) {
    await this.ownsProperty(participantId, input.propertyId);
    // Maintenance coordination must be in the property's scope of management (SOM-01, GJ-20).
    if (!(await this.scope.inScope(input.propertyId, "maintenance"))) {
      throw new Conflict("Maintenance coordination is not in this property's scope of management");
    }
    const issue = await this.prisma.$transaction(async (tx) => {
      const i = await tx.maintenanceIssue.create({
        data: { propertyId: input.propertyId, tenancyId: input.tenancyId, category: input.category, description: input.description, urgency: input.urgency ?? "NORMAL", reportedBy: participantId, evidenceRef: input.evidenceRef },
      });
      await tx.propertyTimelineEvent.create({ data: { propertyId: input.propertyId, eventType: "issue.reported", summary: `Issue reported: ${input.category}` } });
      await this.outbox.emit(tx, "issue.reported", i.id, { category: input.category });
      await this.audit.record(tx, { actor: participantId, action: "issue.report", objectRef: `issue:${i.id}` });
      return i;
    });
    return this.toIssueDto(issue);
  }

  async getIssue(participantId: string, issueId: string) {
    const issue = await this.prisma.maintenanceIssue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFound("Issue not found");
    await this.ownsProperty(participantId, issue.propertyId);
    const quotes = await this.prisma.serviceQuote.findMany({ where: { issueId }, orderBy: { amountKobo: "asc" } });
    const work = await this.prisma.work.findFirst({ where: { issueId } });
    return {
      ...this.toIssueDto(issue),
      quotes: quotes.map((q) => ({ id: q.id, providerName: q.providerName, amountKobo: q.amountKobo.toString(), scope: q.scope, status: q.status })),
      work: work ? { id: work.id, status: work.status, providerName: work.providerName, acceptedAt: work.acceptedAt?.toISOString() ?? null } : null,
    };
  }

  /** Every issue across the landlord's properties, with Quotes and Work (for the chat surface). */
  async listForOwner(participantId: string) {
    const links = await this.prisma.propertyParticipant.findMany({ where: { participantId } });
    const propertyIds = links.map((l) => l.propertyId);
    if (propertyIds.length === 0) return [];
    const issues = await this.prisma.maintenanceIssue.findMany({ where: { propertyId: { in: propertyIds } }, orderBy: { createdAt: "desc" }, take: 20 });
    const issueIds = issues.map((i) => i.id);
    const [allQuotes, works] = await Promise.all([
      issueIds.length ? this.prisma.serviceQuote.findMany({ where: { issueId: { in: issueIds } }, orderBy: { amountKobo: "asc" } }) : [],
      issueIds.length ? this.prisma.work.findMany({ where: { issueId: { in: issueIds } } }) : [],
    ]);
    const quotesByIssue = new Map<string, typeof allQuotes>();
    for (const q of allQuotes) {
      const arr = quotesByIssue.get(q.issueId) ?? [];
      arr.push(q);
      quotesByIssue.set(q.issueId, arr);
    }
    const workByIssue = new Map<string, (typeof works)[number]>();
    for (const w of works) if (!workByIssue.has(w.issueId)) workByIssue.set(w.issueId, w);
    return issues.map((i) => {
      const quotes = quotesByIssue.get(i.id) ?? [];
      const work = workByIssue.get(i.id);
      return {
        id: i.id,
        category: i.category,
        status: i.status,
        quotes: quotes.map((q) => ({ id: q.id, providerName: q.providerName, amountKobo: q.amountKobo.toString(), scope: q.scope, status: q.status })),
        work: work ? { id: work.id, status: work.status, providerName: work.providerName } : null,
      };
    });
  }

  /** Staff admit a provider's sealed Quote (concierge; the Konnect portal does this in Phase 4). */
  async submitQuote(staffId: string, issueId: string, input: { providerName: string; amountKobo: string; scope: string; assumptions?: string }) {
    const issue = await this.prisma.maintenanceIssue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFound("Issue not found");
    const quote = await this.prisma.$transaction(async (tx) => {
      const q = await tx.serviceQuote.create({ data: { issueId, providerName: input.providerName, amountKobo: BigInt(input.amountKobo), scope: input.scope, assumptions: input.assumptions } });
      await tx.maintenanceIssue.update({ where: { id: issueId }, data: { status: "QUOTING" } });
      await this.outbox.emit(tx, "quote.submitted", q.id, { issueId });
      await this.audit.record(tx, { actor: staffId, action: "quote.submit", objectRef: `quote:${q.id}` });
      return q;
    });
    return { id: quote.id, amountKobo: quote.amountKobo.toString(), status: quote.status };
  }

  /** Landlord compares and accepts a Quote; Work begins (BP-12 vocabulary: Work and Quote). */
  async acceptQuote(participantId: string, issueId: string, quoteId: string) {
    const issue = await this.prisma.maintenanceIssue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFound("Issue not found");
    await this.ownsProperty(participantId, issue.propertyId);
    const quote = await this.prisma.serviceQuote.findUnique({ where: { id: quoteId } });
    if (!quote || quote.issueId !== issueId) throw new NotFound("Quote not found");
    if (quote.status !== "SUBMITTED") throw new Conflict("This Quote is no longer open");

    const work = await this.prisma.$transaction(async (tx) => {
      await tx.serviceQuote.update({ where: { id: quoteId }, data: { status: "ACCEPTED" } });
      await tx.serviceQuote.updateMany({ where: { issueId, id: { not: quoteId }, status: "SUBMITTED" }, data: { status: "DECLINED" } });
      await tx.maintenanceIssue.update({ where: { id: issueId }, data: { status: "IN_PROGRESS" } });
      const w = await tx.work.create({ data: { issueId, quoteId, providerId: quote.providerId, providerName: quote.providerName, status: "IN_PROGRESS" } });
      await this.outbox.emit(tx, "quote.accepted", quoteId, { issueId });
      await this.outbox.emit(tx, "work.started", w.id, { issueId });
      await this.audit.record(tx, { actor: participantId, action: "quote.accept", objectRef: `quote:${quoteId}`, after: { workId: w.id } });
      return w;
    });
    return { workId: work.id, status: work.status };
  }

  /** Provider/staff submit completion with evidence. This does NOT close the Work (BP-12). */
  async submitWorkCompletion(staffId: string, workId: string, input: { evidence?: unknown }) {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw new NotFound("Work not found");
    if (work.status === "COMPLETED") throw new Conflict("Work is already accepted");
    await this.prisma.$transaction(async (tx) => {
      await tx.work.update({ where: { id: workId }, data: { status: "COMPLETION_SUBMITTED", evidence: (input.evidence ?? { note: "completed" }) as object } });
      await this.outbox.emit(tx, "work.completion_submitted", workId, {});
      await this.audit.record(tx, { actor: staffId, action: "work.completion_submit", objectRef: `work:${workId}` });
    });
    return { workId, status: "COMPLETION_SUBMITTED" };
  }

  /** Landlord accepts the Work with evidence. Acceptance (not a provider claim) closes it (BP-12). */
  async acceptWork(participantId: string, workId: string) {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw new NotFound("Work not found");
    const issue = await this.prisma.maintenanceIssue.findUnique({ where: { id: work.issueId } });
    if (!issue) throw new NotFound("Issue not found");
    await this.ownsProperty(participantId, issue.propertyId);
    if (work.status !== "COMPLETION_SUBMITTED") throw new Conflict("This Work is not ready for acceptance yet");

    await this.prisma.$transaction(async (tx) => {
      await tx.work.update({ where: { id: workId }, data: { status: "COMPLETED", acceptedBy: participantId, acceptedAt: new Date() } });
      await tx.maintenanceIssue.update({ where: { id: work.issueId }, data: { status: "COMPLETED" } });
      await tx.propertyTimelineEvent.create({ data: { propertyId: issue.propertyId, eventType: "work.accepted", summary: `Work accepted for: ${issue.category}` } });
      await this.outbox.emit(tx, "work.accepted", workId, { issueId: work.issueId });
      await this.audit.record(tx, { actor: participantId, action: "work.accept", objectRef: `work:${workId}` });
    });
    return { workId, status: "COMPLETED" };
  }

  private toIssueDto(i: { id: string; propertyId: string; category: string; description: string; urgency: string; status: string; createdAt: Date }) {
    return { id: i.id, propertyId: i.propertyId, category: i.category, description: i.description, urgency: i.urgency, status: i.status, createdAt: i.createdAt.toISOString() };
  }
}
