import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { CryptoService } from "../../common/crypto/crypto.service.js";
import { OutboxService } from "../../common/outbox/outbox.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { NotFound, Conflict, Forbidden } from "../../common/errors/domain-errors.js";
import { env } from "../../common/config/env.js";

/**
 * Konnect provider self-service (PRD §21, GJ-10). A provider applies, staff admit them, and the
 * admitted provider works from a token-gated portal: they see open issues, submit Quotes, and
 * deliver Work with evidence. A provider claim never closes the Work; the landlord accepts (BP-12).
 */
@Injectable()
export class ProviderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  /** Public: a provider applies to join Konnect. */
  async apply(input: { name: string; services: string; contactEmail?: string; contactPhone?: string }) {
    if (!input.name?.trim() || !input.services?.trim()) throw new Conflict("Name and services are required");
    const p = await this.prisma.serviceProvider.create({ data: { name: input.name.trim(), services: input.services.trim(), contactEmail: input.contactEmail, contactPhone: input.contactPhone, status: "APPLIED" } });
    await this.prisma.$transaction((tx) => this.outbox.emit(tx, "provider.applied", p.id, { name: p.name }));
    return { id: p.id, status: p.status };
  }

  /** Staff: admit a provider and issue their workspace link. */
  async admit(staffId: string, providerId: string) {
    const p = await this.prisma.serviceProvider.findUnique({ where: { id: providerId } });
    if (!p) throw new NotFound("Provider not found");
    const token = randomBytes(24).toString("hex");
    await this.prisma.serviceProvider.update({ where: { id: providerId }, data: { status: "ADMITTED", accessTokenHash: this.crypto.valueHash(token), admittedAt: new Date() } });
    await this.prisma.$transaction((tx) => this.audit.record(tx, { actor: staffId, action: "provider.admit", objectRef: `provider:${providerId}` }));
    return { workspaceUrl: `${env.WEB_BASE_URL}/provider/${token}`, token: env.WHATSAPP_ADAPTER === "fake" ? token : undefined };
  }

  async reject(staffId: string, providerId: string) {
    const p = await this.prisma.serviceProvider.findUnique({ where: { id: providerId } });
    if (!p) throw new NotFound("Provider not found");
    await this.prisma.serviceProvider.update({ where: { id: providerId }, data: { status: "REJECTED", accessTokenHash: null } });
    await this.prisma.$transaction((tx) => this.audit.record(tx, { actor: staffId, action: "provider.reject", objectRef: `provider:${providerId}` }));
    return { status: "REJECTED" };
  }

  async board() {
    const list = await this.prisma.serviceProvider.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return list.map((p) => ({ id: p.id, name: p.name, services: p.services, status: p.status, contactEmail: p.contactEmail, contactPhone: p.contactPhone, admittedAt: p.admittedAt?.toISOString() ?? null, createdAt: p.createdAt.toISOString() }));
  }

  private async resolveProvider(token: string) {
    const p = await this.prisma.serviceProvider.findFirst({ where: { accessTokenHash: this.crypto.valueHash(token) } });
    if (!p) throw new NotFound("This workspace link is not valid");
    if (p.status !== "ADMITTED") throw new Forbidden("This provider is not admitted");
    return p;
  }

  /** The provider's workspace: open issues to quote, plus their own Quotes and Work. */
  async workspace(token: string) {
    const provider = await this.resolveProvider(token);
    const openIssues = await this.prisma.maintenanceIssue.findMany({ where: { status: { in: ["REPORTED", "QUOTING"] } }, orderBy: { createdAt: "desc" }, take: 50 });
    const myQuotes = await this.prisma.serviceQuote.findMany({ where: { providerId: provider.id }, orderBy: { createdAt: "desc" }, take: 50 });
    const quotedIssueIds = new Set(myQuotes.map((q) => q.issueId));
    const myWorks = await this.prisma.work.findMany({ where: { providerId: provider.id }, orderBy: { createdAt: "desc" }, take: 50 });
    return {
      provider: { name: provider.name, services: provider.services },
      openIssues: openIssues.map((i) => ({ id: i.id, category: i.category, description: i.description, urgency: i.urgency, status: i.status, alreadyQuoted: quotedIssueIds.has(i.id) })),
      myQuotes: myQuotes.map((q) => ({ id: q.id, issueId: q.issueId, amountKobo: q.amountKobo.toString(), scope: q.scope, status: q.status })),
      myWork: myWorks.map((w) => ({ id: w.id, issueId: w.issueId, status: w.status })),
    };
  }

  /** Provider submits a Quote on an open issue. */
  async submitQuote(token: string, issueId: string, input: { amountKobo: string; scope: string; assumptions?: string }) {
    const provider = await this.resolveProvider(token);
    const issue = await this.prisma.maintenanceIssue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFound("Issue not found");
    if (!["REPORTED", "QUOTING"].includes(issue.status)) throw new Conflict("This issue is no longer open for Quotes");
    const quote = await this.prisma.$transaction(async (tx) => {
      const q = await tx.serviceQuote.create({ data: { issueId, providerId: provider.id, providerName: provider.name, amountKobo: BigInt(input.amountKobo), scope: input.scope, assumptions: input.assumptions } });
      await tx.maintenanceIssue.update({ where: { id: issueId }, data: { status: "QUOTING" } });
      await this.outbox.emit(tx, "quote.submitted", q.id, { issueId, providerId: provider.id });
      await this.audit.record(tx, { actor: `provider:${provider.id}`, action: "quote.submit", objectRef: `quote:${q.id}` });
      return q;
    });
    return { id: quote.id, amountKobo: quote.amountKobo.toString(), status: quote.status };
  }

  /** Provider submits Work completion with evidence. This does NOT close the Work (BP-12). */
  async submitWork(token: string, workId: string, input: { evidence?: unknown }) {
    const provider = await this.resolveProvider(token);
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw new NotFound("Work not found");
    if (work.providerId !== provider.id) throw new Forbidden("This Work is not assigned to you");
    if (work.status === "COMPLETED") throw new Conflict("This Work is already accepted");
    await this.prisma.$transaction(async (tx) => {
      await tx.work.update({ where: { id: workId }, data: { status: "COMPLETION_SUBMITTED", evidence: (input.evidence ?? { note: "completed" }) as object } });
      await this.outbox.emit(tx, "work.completion_submitted", workId, { providerId: provider.id });
      await this.audit.record(tx, { actor: `provider:${provider.id}`, action: "work.completion_submit", objectRef: `work:${workId}` });
    });
    return { workId, status: "COMPLETION_SUBMITTED" };
  }
}
