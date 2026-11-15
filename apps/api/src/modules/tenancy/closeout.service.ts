import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { OutboxService } from "../../common/outbox/outbox.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { LabelService } from "../../common/read/label.service.js";
import { Forbidden, NotFound, Conflict } from "../../common/errors/domain-errors.js";

export interface Deduction {
  reason: string;
  amountKobo: string;
}

/** Caution-fee outcome from the caution fee and the deductions. Pure, used for preview + settle. */
function computeOutcome(cautionFee: bigint, deductions: bigint): { outcome: string; refundKobo: bigint } {
  if (cautionFee === 0n) return { outcome: "NO_DEPOSIT", refundKobo: 0n };
  const refundKobo = cautionFee > deductions ? cautionFee - deductions : 0n;
  if (deductions === 0n) return { outcome: "REFUND", refundKobo };
  if (refundKobo === 0n) return { outcome: "FORFEIT", refundKobo: 0n };
  return { outcome: "PARTIAL", refundKobo };
}

/**
 * Tenancy close-out (PRD §25, GJ-13). When a tenant vacates, the caution fee is settled: the
 * landlord records deductions (arrears, damage, works), and the outcome is a full refund, a
 * partial refund or a forfeit. Kiataker computes and records it; the landlord returns any
 * refund directly, Kiataker never holds the money (BP-07). Settlement is idempotent.
 */
@Injectable()
export class CloseoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly labels: LabelService,
  ) {}

  private async ownTenancy(landlordId: string, tenancyId: string) {
    const tenancy = await this.prisma.tenancy.findUnique({ where: { id: tenancyId }, include: { terms: { orderBy: { version: "desc" }, take: 1 } } });
    if (!tenancy) throw new NotFound("Tenancy not found");
    const link = await this.prisma.propertyParticipant.findFirst({ where: { participantId: landlordId, propertyId: tenancy.propertyId } });
    if (!link) throw new Forbidden("This tenancy is not on your account");
    return tenancy;
  }

  private async ownCloseout(landlordId: string, closeoutId: string) {
    const c = await this.prisma.tenancyCloseout.findUnique({ where: { id: closeoutId } });
    if (!c) throw new NotFound("Close-out not found");
    if (c.landlordId !== landlordId) throw new Forbidden("This close-out is not on your account");
    return c;
  }

  /** Begin close-out: the tenant has vacated. Ends the tenancy and opens the caution-fee settlement. */
  async start(landlordId: string, tenancyId: string) {
    const tenancy = await this.ownTenancy(landlordId, tenancyId);
    if (tenancy.managementState === "ENDED") throw new Conflict("This tenancy has already ended");
    const existing = await this.prisma.tenancyCloseout.findUnique({ where: { tenancyId } });
    if (existing) return this.view(landlordId, existing.id);

    const cautionFeeKobo = tenancy.terms[0]?.cautionFeeKobo ?? 0n;
    const closeout = await this.prisma.$transaction(async (tx) => {
      await tx.occupancy.update({ where: { id: tenancy.occupancyId }, data: { state: "VACATED", toDate: new Date() } });
      await tx.tenancy.update({ where: { id: tenancy.id }, data: { status: "ENDED", managementState: "ENDED" } });
      const c = await tx.tenancyCloseout.create({ data: { tenancyId, propertyId: tenancy.propertyId, landlordId, status: "OPEN", cautionFeeKobo } });
      await tx.propertyTimelineEvent.create({ data: { propertyId: tenancy.propertyId, eventType: "tenancy.vacated", summary: "Tenant vacated; close-out started" } });
      await this.outbox.emit(tx, "occupancy.vacated", tenancy.occupancyId, { tenancyId });
      await this.outbox.emit(tx, "closeout.started", c.id, { tenancyId });
      await this.audit.record(tx, { actor: landlordId, action: "closeout.start", objectRef: `closeout:${c.id}` });
      return c;
    });
    return this.view(landlordId, closeout.id);
  }

  /** Record a deduction against the caution fee (arrears, damage, works). */
  async addDeduction(landlordId: string, closeoutId: string, input: { reason: string; amountKobo: string }) {
    const c = await this.ownCloseout(landlordId, closeoutId);
    if (c.status === "SETTLED") throw new Conflict("This close-out is already settled");
    const amount = BigInt(input.amountKobo);
    if (amount <= 0n) throw new Conflict("A deduction must be a positive amount");
    const deductions = [...((c.deductions as unknown as Deduction[]) ?? []), { reason: input.reason || "Deduction", amountKobo: amount.toString() }];
    const deductionsKobo = c.deductionsKobo + amount;
    await this.prisma.tenancyCloseout.update({ where: { id: c.id }, data: { deductions: deductions as object, deductionsKobo } });
    await this.prisma.$transaction((tx) => this.audit.record(tx, { actor: landlordId, action: "closeout.deduction", objectRef: `closeout:${c.id}`, after: { reason: input.reason, amountKobo: amount.toString() } }));
    return this.view(landlordId, closeoutId);
  }

  /** Settle the caution fee: compute the outcome and record any refund. Idempotent. */
  async settle(landlordId: string, closeoutId: string) {
    const c = await this.ownCloseout(landlordId, closeoutId);
    if (c.status === "SETTLED") return { ...(await this.view(landlordId, closeoutId)), idempotent: true };
    const { outcome, refundKobo } = computeOutcome(c.cautionFeeKobo, c.deductionsKobo);

    await this.prisma.$transaction(async (tx) => {
      if (refundKobo > 0n) {
        // The landlord returns the remaining caution fee directly; Kiataker records it (BP-07).
        await tx.payment.create({ data: { tenancyId: c.tenancyId, amountKobo: refundKobo, provenance: "deposit_refund", status: "SUCCESS", reference: "caution-fee-refund", recordedBy: landlordId, paidAt: new Date() } });
      }
      await tx.tenancyCloseout.update({ where: { id: c.id }, data: { status: "SETTLED", outcome, refundKobo, settledAt: new Date() } });
      await tx.occupancy.update({ where: { id: (await tx.tenancy.findUnique({ where: { id: c.tenancyId } }))!.occupancyId }, data: { state: "CLOSED" } });
      await this.outbox.emit(tx, "closeout.settled", c.id, { outcome, refundKobo: refundKobo.toString() });
      await this.audit.record(tx, { actor: landlordId, action: "closeout.settle", objectRef: `closeout:${c.id}`, after: { outcome, refundKobo: refundKobo.toString() } });
    });
    return { ...(await this.view(landlordId, closeoutId)), idempotent: false };
  }

  async view(landlordId: string, closeoutId: string) {
    const c = await this.ownCloseout(landlordId, closeoutId);
    // When still open, show the outcome as a live preview; once settled, show what was recorded.
    const preview = c.status === "SETTLED" ? { outcome: c.outcome ?? "", refundKobo: c.refundKobo } : computeOutcome(c.cautionFeeKobo, c.deductionsKobo);
    return {
      closeoutId: c.id,
      tenancyId: c.tenancyId,
      status: c.status,
      cautionFeeKobo: c.cautionFeeKobo.toString(),
      deductionsKobo: c.deductionsKobo.toString(),
      deductions: (c.deductions as unknown as Deduction[]) ?? [],
      outcome: preview.outcome,
      refundKobo: preview.refundKobo.toString(),
      settledAt: c.settledAt?.toISOString() ?? null,
    };
  }

  /** Staff resolve the owning landlord of a close-out, for concierge actions. */
  private async ownerOf(closeoutId: string): Promise<string> {
    const c = await this.prisma.tenancyCloseout.findUnique({ where: { id: closeoutId } });
    if (!c) throw new NotFound("Close-out not found");
    return c.landlordId;
  }

  /** Staff add a deduction on the landlord's behalf (concierge). Same logic + a staff audit. */
  async staffAddDeduction(staffId: string, closeoutId: string, input: { reason: string; amountKobo: string }) {
    const result = await this.addDeduction(await this.ownerOf(closeoutId), closeoutId, input);
    await this.prisma.$transaction((tx) => this.audit.record(tx, { actor: staffId, action: "admin.closeout.add_deduction", objectRef: `closeout:${closeoutId}`, reason: "staff action", after: input }));
    return result;
  }

  /** Staff settle a close-out on the landlord's behalf (concierge). */
  async staffSettle(staffId: string, closeoutId: string) {
    const result = await this.settle(await this.ownerOf(closeoutId), closeoutId);
    await this.prisma.$transaction((tx) => this.audit.record(tx, { actor: staffId, action: "admin.closeout.settle", objectRef: `closeout:${closeoutId}`, reason: "staff action" }));
    return result;
  }

  async listForOwner(landlordId: string) {
    const list = await this.prisma.tenancyCloseout.findMany({ where: { landlordId }, orderBy: { createdAt: "desc" }, take: 30 });
    return this.decorateAll(list);
  }

  async board() {
    const list = await this.prisma.tenancyCloseout.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return this.decorateAll(list);
  }

  private async decorateAll(list: { id: string; tenancyId: string; status: string; cautionFeeKobo: bigint; deductionsKobo: bigint; outcome: string | null; refundKobo: bigint; createdAt: Date }[]) {
    const tenancies = await this.labels.tenancies(list.map((c) => c.tenancyId));
    return list.map((c) => {
      const label = tenancies.get(c.tenancyId);
      const preview = c.status === "SETTLED" ? { outcome: c.outcome ?? "", refundKobo: c.refundKobo } : computeOutcome(c.cautionFeeKobo, c.deductionsKobo);
      return {
        id: c.id,
        tenancyId: c.tenancyId,
        status: c.status,
        property: label?.property ?? null,
        tenant: label?.tenant ?? null,
        cautionFeeKobo: c.cautionFeeKobo.toString(),
        deductionsKobo: c.deductionsKobo.toString(),
        outcome: preview.outcome,
        refundKobo: preview.refundKobo.toString(),
        createdAt: c.createdAt.toISOString(),
      };
    });
  }
}
