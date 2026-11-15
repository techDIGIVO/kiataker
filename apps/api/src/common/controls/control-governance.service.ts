import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { OutboxService } from "../outbox/outbox.service.js";
import { ControlsService } from "./controls.service.js";
import { Forbidden, NotFound, Conflict } from "../errors/domain-errors.js";

/**
 * Control-change governance (PRD §26, §54, GJ-18, P0-08). A high-risk platform control is never
 * toggled on the spot. The change is proposed, held, and applied only when a CEO Command Centre
 * seat holder signs it off, and the proposer may not sign off their own change (a two-person
 * rule, separation of duties). Low and medium controls apply immediately, as before. Every step
 * is audited. Controls stay fail-closed throughout (BP-08): nothing changes until sign-off lands.
 */
@Injectable()
export class ControlGovernanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly controls: ControlsService,
  ) {}

  /** Does this person hold a current seat in the CEO Command Centre? */
  private async isCeo(participantId: string): Promise<boolean> {
    const seat = await this.prisma.seatAssignment.findFirst({
      where: { participantId, toDate: null, seat: { commandCentre: { key: "ceo" } } },
    });
    return !!seat;
  }

  /**
   * Route a control change by risk. Low and medium apply at once. High is held for CEO sign-off:
   * the control does not move, a pending request is opened, and the response says so.
   */
  async requestChange(key: string, toEnabled: boolean, requestedBy: string, reason?: string) {
    const control = await this.prisma.platformControl.findUnique({ where: { key } });
    if (!control) throw new NotFound("Control not found");

    if (control.risk !== "HIGH") {
      const applied = await this.controls.setEnabled(key, toEnabled, requestedBy, reason);
      return { mode: "APPLIED" as const, control: applied };
    }

    if (!reason?.trim()) throw new Conflict("A high-risk control change needs a reason");
    if (control.enabled === toEnabled) throw new Conflict(`This control is already ${toEnabled ? "on" : "off"}`);
    const open = await this.prisma.controlChangeRequest.findFirst({ where: { controlKey: key, status: "PENDING" } });
    if (open) throw new Conflict("A change for this control is already awaiting CEO sign-off");

    const req = await this.prisma.$transaction(async (tx) => {
      const r = await tx.controlChangeRequest.create({
        data: { controlKey: key, fromEnabled: control.enabled, toEnabled, risk: control.risk, reason: reason.trim(), status: "PENDING", requestedBy },
      });
      await this.outbox.emit(tx, "control.change_requested", r.id, { controlKey: key, toEnabled });
      await this.audit.record(tx, { actor: requestedBy, action: "control.change_requested", objectRef: `control:${key}`, reason: reason.trim(), before: { enabled: control.enabled }, after: { enabled: toEnabled } });
      return r;
    });
    return { mode: "PENDING_SIGN_OFF" as const, request: this.toDto(req) };
  }

  /** CEO signs off: the change applies atomically. The proposer cannot sign off their own change. */
  async approve(requestId: string, approverId: string, decisionReason?: string) {
    if (!(await this.isCeo(approverId))) throw new Forbidden("Only the CEO Command Centre can sign off a high-risk control change");
    const r = await this.prisma.controlChangeRequest.findUnique({ where: { id: requestId } });
    if (!r) throw new NotFound("Change request not found");
    if (r.status !== "PENDING") throw new Conflict("This change request is already decided");
    if (r.requestedBy === approverId) throw new Conflict("The person who proposed a change cannot sign it off (two-person rule)");

    await this.prisma.$transaction(async (tx) => {
      await tx.platformControl.update({ where: { key: r.controlKey }, data: { enabled: r.toEnabled } });
      await tx.controlChangeRequest.update({ where: { id: r.id }, data: { status: "APPLIED", decidedBy: approverId, decisionReason: decisionReason?.trim(), decidedAt: new Date(), appliedAt: new Date() } });
      await this.outbox.emit(tx, "control.change_approved", r.id, { controlKey: r.controlKey, toEnabled: r.toEnabled });
      await this.audit.record(tx, { actor: approverId, action: "control.change_approved", objectRef: `control:${r.controlKey}`, reason: decisionReason?.trim() ?? r.reason, before: { enabled: r.fromEnabled }, after: { enabled: r.toEnabled } });
    });
    return this.detail(requestId);
  }

  /** CEO declines: the control does not move. A reason is required. */
  async reject(requestId: string, approverId: string, decisionReason: string) {
    if (!(await this.isCeo(approverId))) throw new Forbidden("Only the CEO Command Centre can decide a high-risk control change");
    if (!decisionReason?.trim()) throw new Conflict("A reason is required to decline a change");
    const r = await this.prisma.controlChangeRequest.findUnique({ where: { id: requestId } });
    if (!r) throw new NotFound("Change request not found");
    if (r.status !== "PENDING") throw new Conflict("This change request is already decided");
    if (r.requestedBy === approverId) throw new Conflict("The person who proposed a change cannot decide it (two-person rule)");

    await this.prisma.$transaction(async (tx) => {
      await tx.controlChangeRequest.update({ where: { id: r.id }, data: { status: "REJECTED", decidedBy: approverId, decisionReason: decisionReason.trim(), decidedAt: new Date() } });
      await this.audit.record(tx, { actor: approverId, action: "control.change_rejected", objectRef: `control:${r.controlKey}`, reason: decisionReason.trim() });
    });
    return this.detail(requestId);
  }

  /** The proposer withdraws a pending change before it is decided. */
  async cancel(requestId: string, actorId: string) {
    const r = await this.prisma.controlChangeRequest.findUnique({ where: { id: requestId } });
    if (!r) throw new NotFound("Change request not found");
    if (r.status !== "PENDING") throw new Conflict("This change request is already decided");
    if (r.requestedBy !== actorId) throw new Forbidden("Only the person who proposed a change can withdraw it");
    await this.prisma.$transaction(async (tx) => {
      await tx.controlChangeRequest.update({ where: { id: r.id }, data: { status: "CANCELLED", decidedAt: new Date() } });
      await this.audit.record(tx, { actor: actorId, action: "control.change_cancelled", objectRef: `control:${r.controlKey}` });
    });
    return this.detail(requestId);
  }

  async detail(id: string) {
    const r = await this.prisma.controlChangeRequest.findUnique({ where: { id } });
    if (!r) throw new NotFound("Change request not found");
    return this.toDto(r);
  }

  async pending() {
    const list = await this.prisma.controlChangeRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" } });
    return list.map((r) => this.toDto(r));
  }

  async board() {
    const list = await this.prisma.controlChangeRequest.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return list.map((r) => this.toDto(r));
  }

  private toDto(r: { id: string; controlKey: string; fromEnabled: boolean; toEnabled: boolean; risk: string; reason: string; status: string; requestedBy: string; decidedBy: string | null; decisionReason: string | null; decidedAt: Date | null; appliedAt: Date | null; createdAt: Date }) {
    return {
      id: r.id,
      controlKey: r.controlKey,
      fromEnabled: r.fromEnabled,
      toEnabled: r.toEnabled,
      risk: r.risk,
      reason: r.reason,
      status: r.status,
      requestedBy: r.requestedBy,
      decidedBy: r.decidedBy,
      decisionReason: r.decisionReason,
      decidedAt: r.decidedAt?.toISOString() ?? null,
      appliedAt: r.appliedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
