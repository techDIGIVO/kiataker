import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { LabelService } from "../../common/read/label.service.js";

/**
 * Admin / Command Centre read models (PRD §26, P1-10). Staff run concierge onboarding,
 * support and every manual exception. These are read projections for the Operations board
 * and Landlord 360. Each board is a constant number of queries (no per-row reads; §44 P5).
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly labels: LabelService,
  ) {}

  async overview() {
    const [landlords, properties, tenancies, openActions, controls, pendingDisputes] =
      await Promise.all([
        this.prisma.participant.count({ where: { kind: "LANDLORD" } }),
        this.prisma.property.count(),
        this.prisma.tenancy.count(),
        this.prisma.action.count({
          where: { status: { in: ["AVAILABLE", "ACKNOWLEDGED", "IN_PROGRESS", "OVERDUE", "ESCALATED"] } },
        }),
        this.prisma.platformControl.count({ where: { enabled: true } }),
        this.prisma.tenancy.count({ where: { status: "TENANT_DISPUTED" } }),
      ]);
    return { landlords, properties, tenancies, openActions, controlsEnabled: controls, pendingDisputes };
  }

  async landlords() {
    const list = await this.prisma.participant.findMany({
      where: { kind: "LANDLORD" },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { propertyLinks: true },
    });
    // One grouped count over every property, summed per landlord in memory (no per-landlord query).
    const allPropertyIds = [...new Set(list.flatMap((l) => l.propertyLinks.map((p) => p.propertyId)))];
    const grouped = allPropertyIds.length
      ? await this.prisma.tenancy.groupBy({ by: ["propertyId"], where: { propertyId: { in: allPropertyIds } }, _count: { _all: true } })
      : [];
    const byProperty = new Map(grouped.map((g) => [g.propertyId, g._count._all]));
    return list.map((l) => {
      const propertyIds = l.propertyLinks.map((p) => p.propertyId);
      const tenancies = propertyIds.reduce((sum, id) => sum + (byProperty.get(id) ?? 0), 0);
      return {
        id: l.id,
        displayName: l.displayName,
        status: l.status,
        properties: propertyIds.length,
        tenancies,
        joinedAt: l.createdAt.toISOString(),
      };
    });
  }

  async operationsQueue() {
    const actions = await this.prisma.action.findMany({
      where: {
        status: { in: ["AVAILABLE", "ACKNOWLEDGED", "IN_PROGRESS", "OVERDUE", "ESCALATED"] },
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      take: 100,
    });
    const properties = await this.labels.properties(actions.map((a) => a.propertyScope));
    return actions.map((a) => ({
      id: a.id,
      title: a.title,
      callToAction: a.callToAction,
      priority: a.priority,
      status: a.status,
      property: a.propertyScope ? properties.get(a.propertyScope) ?? null : null,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  async controls() {
    const controls = await this.prisma.platformControl.findMany({ orderBy: { key: "asc" } });
    return controls.map((c) => ({
      key: c.key,
      enabled: c.enabled,
      risk: c.risk,
      parentKey: c.parentKey,
    }));
  }

  private async propertyLabel(propertyId: string): Promise<string | null> {
    const p = await this.prisma.property.findUnique({ where: { id: propertyId } });
    return p ? `${p.reference} · ${p.addressRaw}` : null;
  }

  /** Konnect / maintenance board: every issue with its Quotes and Work status (GJ-09). */
  async issuesBoard() {
    const issues = await this.prisma.maintenanceIssue.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    const issueIds = issues.map((i) => i.id);
    const [quoteCounts, works, properties] = await Promise.all([
      issueIds.length ? this.prisma.serviceQuote.groupBy({ by: ["issueId"], where: { issueId: { in: issueIds } }, _count: { _all: true } }) : [],
      issueIds.length ? this.prisma.work.findMany({ where: { issueId: { in: issueIds } } }) : [],
      this.labels.properties(issues.map((i) => i.propertyId)),
    ]);
    const quoteByIssue = new Map(quoteCounts.map((q) => [q.issueId, q._count._all]));
    const workByIssue = new Map<string, (typeof works)[number]>();
    for (const w of works) if (!workByIssue.has(w.issueId)) workByIssue.set(w.issueId, w);
    return issues.map((i) => {
      const work = workByIssue.get(i.id);
      return {
        id: i.id,
        category: i.category,
        description: i.description,
        urgency: i.urgency,
        status: i.status,
        property: properties.get(i.propertyId) ?? null,
        quoteCount: quoteByIssue.get(i.id) ?? 0,
        workStatus: work?.status ?? null,
        workId: work?.id ?? null,
        createdAt: i.createdAt.toISOString(),
      };
    });
  }

  /** Staff view of one issue, with every Quote and the Work (no ownership gate; staff only). */
  async issueDetail(issueId: string) {
    const issue = await this.prisma.maintenanceIssue.findUnique({ where: { id: issueId } });
    if (!issue) return null;
    const [quotes, work, property] = await Promise.all([
      this.prisma.serviceQuote.findMany({ where: { issueId }, orderBy: { amountKobo: "asc" } }),
      this.prisma.work.findFirst({ where: { issueId } }),
      this.propertyLabel(issue.propertyId),
    ]);
    return {
      id: issue.id,
      category: issue.category,
      description: issue.description,
      urgency: issue.urgency,
      status: issue.status,
      property,
      createdAt: issue.createdAt.toISOString(),
      quotes: quotes.map((q) => ({ id: q.id, providerName: q.providerName, amountKobo: q.amountKobo.toString(), scope: q.scope, status: q.status })),
      work: work ? { id: work.id, status: work.status, providerName: work.providerName, acceptedAt: work.acceptedAt?.toISOString() ?? null } : null,
    };
  }

  /** Notices board: every notice with its property and delivery outcome (GJ-07). */
  async noticesBoard() {
    const notices = await this.prisma.notice.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { recipients: true } });
    const [properties, tenancies] = await Promise.all([
      this.labels.properties(notices.map((n) => n.propertyId)),
      this.labels.tenancies(notices.map((n) => n.tenancyId)),
    ]);
    return notices.map((n) => {
      const recipient = n.recipients[0];
      return {
        id: n.id,
        status: n.status,
        property: properties.get(n.propertyId) ?? null,
        tenant: n.tenancyId ? tenancies.get(n.tenancyId)?.tenant ?? null : null,
        effectiveDate: n.effectiveDate?.toISOString() ?? null,
        delivery: recipient ? (recipient.outcome === "sent" ? "sent, not confirmed" : recipient.outcome) : null,
        contentHash: n.contentHash,
        createdAt: n.createdAt.toISOString(),
      };
    });
  }

  /** Arrears board: overdue rent charges grouped by tenancy (GJ-11). */
  async arrearsBoard() {
    const overdue = await this.prisma.rentCharge.findMany({ where: { status: "OVERDUE" }, orderBy: { dueDate: "asc" }, take: 300 });
    const byTenancy = new Map<string, { tenancyId: string; count: number; amountKobo: bigint; oldestDue: Date }>();
    for (const c of overdue) {
      const cur = byTenancy.get(c.tenancyId);
      if (cur) {
        cur.count += 1;
        cur.amountKobo += c.amountKobo;
        if (c.dueDate < cur.oldestDue) cur.oldestDue = c.dueDate;
      } else {
        byTenancy.set(c.tenancyId, { tenancyId: c.tenancyId, count: 1, amountKobo: c.amountKobo, oldestDue: c.dueDate });
      }
    }
    const groups = [...byTenancy.values()];
    const tenancies = await this.labels.tenancies(groups.map((r) => r.tenancyId));
    return groups.map((r) => {
      const label = tenancies.get(r.tenancyId);
      return { tenancyId: r.tenancyId, property: label?.property ?? null, tenant: label?.tenant ?? null, overdueCount: r.count, arrearsKobo: r.amountKobo.toString(), oldestDue: r.oldestDue.toISOString() };
    });
  }

  /** Reconciliation queue: tenancies a tenant has disputed (GJ-04). */
  async reconciliationQueue() {
    const disputed = await this.prisma.tenancy.findMany({ where: { status: "TENANT_DISPUTED" }, orderBy: { updatedAt: "desc" }, take: 200 });
    const tenancies = await this.labels.tenancies(disputed.map((t) => t.id));
    return disputed.map((t) => {
      const label = tenancies.get(t.id);
      return { tenancyId: t.id, property: label?.property ?? null, tenant: label?.tenant ?? null, status: t.status, updatedAt: t.updatedAt.toISOString() };
    });
  }
}
