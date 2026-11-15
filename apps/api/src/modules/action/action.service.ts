import { Injectable } from "@nestjs/common";
import { actionMachine, type ActionStatus } from "@kiataker/domain";
import {
  landlordActionLabels,
  type Action as ActionDto,
  type ActionSummary,
} from "@kiataker/contracts";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { OutboxService } from "../../common/outbox/outbox.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { NotFound, Conflict } from "../../common/errors/domain-errors.js";

const OPEN_STATUSES: ActionStatus[] = [
  "PENDING",
  "AVAILABLE",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "OVERDUE",
  "ESCALATED",
];

/**
 * Action Centre projection (§9, ACT-11). A projection rebuilt from source events, never
 * storing business facts of its own. An action closes only from a qualifying event (ACT-04).
 */
@Injectable()
export class ActionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  /** Catch the projection up from the outbox (the Phase 1 poller runs this on a timer). */
  async project(): Promise<void> {
    const rules = await this.prisma.actionRoutingRule.findMany({ where: { decision: "decide" } });
    const byType = new Map(rules.map((r) => [r.eventType, r]));
    const events = await this.prisma.outboxEvent.findMany({
      where: { type: { in: [...byType.keys()] } },
      orderBy: { occurredAt: "asc" },
      take: 500,
    });

    for (const ev of events) {
      const rule = byType.get(ev.type)!;
      const slot = `${ev.type}:${ev.aggregateRef}`;
      const existing = await this.prisma.action.findUnique({ where: { openDedupeSlot: slot } });
      if (existing) continue;

      const { propertyScope, assigneeRef } = await this.resolveScope(ev.aggregateRef);
      const { title, cta } = this.describe(ev.type);
      await this.prisma.$transaction(async (tx) => {
        const action = await tx.action.create({
          data: {
            type: ev.type,
            sourceWorkflow: ev.type.split(".")[0] ?? "general",
            sourceRecordRef: ev.aggregateRef,
            propertyScope,
            assigneeRef,
            priority: rule.priority,
            title,
            callToAction: cta,
            status: "AVAILABLE",
            openDedupeSlot: slot,
            causedByEventId: ev.id,
          },
        });
        await tx.actionStatusHistory.create({
          data: { actionId: action.id, status: "AVAILABLE", sourceEventId: ev.id },
        });
      });
    }
  }

  private async resolveScope(
    aggregateRef: string,
  ): Promise<{ propertyScope: string | null; assigneeRef: string | null }> {
    const tenancy = await this.prisma.tenancy.findUnique({ where: { id: aggregateRef } });
    if (!tenancy) return { propertyScope: null, assigneeRef: null };
    const landlord = await this.prisma.propertyParticipant.findFirst({
      where: { propertyId: tenancy.propertyId },
    });
    return { propertyScope: tenancy.propertyId, assigneeRef: landlord?.participantId ?? null };
  }

  private describe(eventType: string): { title: string; cta: string } {
    switch (eventType) {
      case "tenancy.disputed":
        return { title: "A tenant disagreed with a record", cta: "Review" };
      case "rent.period_overdue":
        return { title: "Rent is overdue", cta: "Review" };
      case "notice.delivery_failed":
        return { title: "A notice could not be delivered", cta: "Review" };
      case "renewal.window_open":
        return { title: "A renewal decision is due", cta: "Decide" };
      default:
        return { title: "An item needs your decision", cta: "Review" };
    }
  }

  private toDto(a: {
    id: string;
    type: string;
    title: string;
    callToAction: string;
    priority: string;
    status: string;
    propertyScope: string | null;
    dueTime: Date | null;
    sourceRecordRef: string;
  }): ActionDto {
    return {
      id: a.id,
      type: a.type,
      title: a.title,
      callToAction: a.callToAction,
      priority: a.priority as ActionDto["priority"],
      status: a.status,
      propertyScope: a.propertyScope,
      dueTime: a.dueTime ? a.dueTime.toISOString() : null,
      deepLink: `/tenancies/${a.sourceRecordRef}`,
    };
  }

  async summary(participantId: string): Promise<ActionSummary> {
    await this.project();
    await this.resolveClosures();
    const open = await this.prisma.action.findMany({
      where: { assigneeRef: participantId, status: { in: OPEN_STATUSES } },
    });
    const act = open.length;
    const waiting = await this.prisma.action.count({
      where: { assigneeRef: participantId, status: "WAITING_ON_OTHER_PARTY" },
    });
    return {
      act,
      upcoming: 0,
      waiting,
      allClear: act === 0,
      nextKnownEvent: null,
    };
  }

  async list(participantId: string, tab: string): Promise<{ label: string; items: ActionDto[] }> {
    await this.project();
    const statusFilter =
      tab === "waiting" ? { status: "WAITING_ON_OTHER_PARTY" as const } : { status: { in: OPEN_STATUSES } };
    const actions = await this.prisma.action.findMany({
      where: { assigneeRef: participantId, ...statusFilter },
      orderBy: [{ priority: "asc" }, { dueTime: "asc" }],
    });
    return {
      label: landlordActionLabels[(tab as "act") ?? "act"] ?? landlordActionLabels.act,
      items: actions.map((a) => this.toDto(a)),
    };
  }

  /**
   * Close actions whose obligation a later event has resolved (ACT-04: an action closes
   * only from a qualifying source event, never a UI click). Idempotent.
   */
  async resolveClosures(): Promise<void> {
    const resolvers: Record<string, (ref: string) => string> = {
      "payment.recorded": (ref) => `rent.period_overdue:${ref}`,
      "tenancy.reconciled": (ref) => `tenancy.disputed:${ref}`,
      "tenancy.confirmed": (ref) => `tenancy.disputed:${ref}`,
    };
    const events = await this.prisma.outboxEvent.findMany({
      where: { type: { in: Object.keys(resolvers) } },
      orderBy: { occurredAt: "asc" },
      take: 500,
    });
    for (const ev of events) {
      const slot = resolvers[ev.type]!(ev.aggregateRef);
      const action = await this.prisma.action.findUnique({ where: { openDedupeSlot: slot } });
      if (!action || !OPEN_STATUSES.includes(action.status as ActionStatus)) continue;
      await this.prisma.$transaction(async (tx) => {
        await tx.action.update({ where: { id: action.id }, data: { status: "COMPLETED" } });
        await tx.actionStatusHistory.create({ data: { actionId: action.id, status: "COMPLETED", sourceEventId: ev.id } });
      });
    }
  }

  /** Escalation sweep (ACT-12). Overdue actions advance by rule on a schedule. */
  async escalateOverdue(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.action.findMany({
      where: {
        dueTime: { lt: now },
        status: { in: ["AVAILABLE", "ACKNOWLEDGED", "IN_PROGRESS"] },
      },
      take: 100,
    });
    for (const a of due) {
      await this.advance(a.id, a.status as ActionStatus, "OVERDUE", "action.overdue");
    }
    const overdue = await this.prisma.action.findMany({ where: { status: "OVERDUE" }, take: 100 });
    for (const a of overdue) {
      await this.advance(a.id, a.status as ActionStatus, "ESCALATE", "action.escalated");
    }
  }

  private async advance(
    id: string,
    from: ActionStatus,
    event: "OVERDUE" | "ESCALATE",
    eventName: string,
  ): Promise<void> {
    let next: ActionStatus;
    try {
      next = actionMachine.next(from, event);
    } catch {
      return;
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.action.update({ where: { id }, data: { status: next } });
      await tx.actionStatusHistory.create({ data: { actionId: id, status: next } });
      await this.outbox.emit(tx, eventName, id, { from, to: next });
    });
  }

  /** Acknowledge an Act Now item (AVAILABLE -> ACKNOWLEDGED). Never closes it (ACT-04). */
  async acknowledge(participantId: string, actionId: string): Promise<ActionDto> {
    const action = await this.prisma.action.findUnique({ where: { id: actionId } });
    if (!action || action.assigneeRef !== participantId) throw new NotFound("Action not found");
    let next: ActionStatus;
    try {
      next = actionMachine.next(action.status as ActionStatus, "ACKNOWLEDGE");
    } catch {
      throw new Conflict(`Cannot acknowledge from ${action.status}`);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const a = await tx.action.update({ where: { id: actionId }, data: { status: next } });
      await tx.actionStatusHistory.create({
        data: { actionId, status: next, actorRef: participantId },
      });
      await this.audit.record(tx, {
        actor: participantId,
        action: "action.acknowledge",
        objectRef: `action:${actionId}`,
      });
      return a;
    });
    return this.toDto(updated);
  }
}
