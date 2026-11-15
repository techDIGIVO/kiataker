import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { OutboxService } from "../../common/outbox/outbox.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { Forbidden, NotFound, Conflict } from "../../common/errors/domain-errors.js";

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}
function periodMonths(frequency: string): number {
  switch (frequency) {
    case "monthly": return 1;
    case "quarterly": return 3;
    case "biannual": return 6;
    default: return 12;
  }
}

/**
 * Rent cycle (PRD §23, RENT, GJ-11). Charges are generated per period; the scan marks them
 * overdue and raises an Action Centre item. Rent settles directly to the landlord (BP-07):
 * Kiataker only records the payment and its evidence, it never holds money.
 */
@Injectable()
export class RentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  /** Ensure the current and next period charges exist for a tenancy. */
  async generateCharges(tenancyId: string): Promise<void> {
    const t = await this.prisma.tenancy.findUnique({
      where: { id: tenancyId },
      include: { terms: { orderBy: { version: "desc" }, take: 1 } },
    });
    const term = t?.terms[0];
    if (!t || !t.commencementDate || !term) return;
    const months = periodMonths(term.frequency);
    const now = new Date();

    let start = new Date(t.commencementDate);
    let guard = 0;
    while (addMonths(start, months) <= now && guard < 600) {
      start = addMonths(start, months);
      guard++;
    }
    for (const periodStart of [start, addMonths(start, months)]) {
      const periodEnd = addMonths(periodStart, months);
      await this.prisma.rentCharge.upsert({
        where: { tenancyId_periodStart: { tenancyId, periodStart } },
        update: {},
        create: { tenancyId, periodStart, periodEnd, dueDate: periodStart, amountKobo: term.rentKobo, status: "DUE" },
      });
    }
  }

  /** Mark due charges overdue and emit events (optionally scoped to one tenancy). */
  private async markOverdue(tenancyId?: string): Promise<void> {
    const now = new Date();
    const overdue = await this.prisma.rentCharge.findMany({
      where: { status: "DUE", dueDate: { lt: now }, ...(tenancyId ? { tenancyId } : {}) },
      take: 500,
    });
    for (const c of overdue) {
      await this.prisma.$transaction(async (tx) => {
        await tx.rentCharge.update({ where: { id: c.id }, data: { status: "OVERDUE" } });
        await this.outbox.emit(tx, "rent.period_overdue", c.tenancyId, { chargeId: c.id, amountKobo: c.amountKobo.toString() });
      });
    }
  }

  /** Scan managed tenancies: generate charges, mark overdue, emit events (every ~30s). */
  async scan(): Promise<void> {
    const tenancies = await this.prisma.tenancy.findMany({ where: { managementState: "MANAGED" }, take: 500 });
    for (const t of tenancies) await this.generateCharges(t.id);
    await this.markOverdue();
  }

  private async assertOwnership(participantId: string, tenancyId: string): Promise<string> {
    const t = await this.prisma.tenancy.findUnique({ where: { id: tenancyId } });
    if (!t) throw new NotFound("Tenancy not found");
    const link = await this.prisma.propertyParticipant.findFirst({ where: { participantId, propertyId: t.propertyId } });
    if (!link) throw new Forbidden("This tenancy is not on your account");
    return t.propertyId;
  }

  async status(participantId: string, tenancyId: string) {
    await this.assertOwnership(participantId, tenancyId);
    await this.generateCharges(tenancyId);
    await this.markOverdue(tenancyId);
    const charges = await this.prisma.rentCharge.findMany({ where: { tenancyId }, orderBy: { periodStart: "asc" } });
    const unpaid = charges.filter((c) => c.status !== "PAID");
    const overdue = charges.filter((c) => c.status === "OVERDUE");
    const balanceKobo = unpaid.filter((c) => c.dueDate <= new Date()).reduce((s, c) => s + c.amountKobo, 0n);
    const nextDue = charges.find((c) => c.status !== "PAID");
    return {
      overdueCount: overdue.length,
      paidCount: charges.filter((c) => c.status === "PAID").length,
      balanceKobo: balanceKobo.toString(),
      nextDue: nextDue ? { dueDate: nextDue.dueDate.toISOString(), amountKobo: nextDue.amountKobo.toString(), status: nextDue.status } : null,
      charges: charges.map((c) => ({ id: c.id, periodStart: c.periodStart.toISOString(), dueDate: c.dueDate.toISOString(), amountKobo: c.amountKobo.toString(), status: c.status })),
    };
  }

  /** Staff record an off-platform payment on the landlord's behalf (concierge; StaffGuard). */
  async recordForStaff(staffId: string, input: { tenancyId: string; amountKobo: string; reference?: string; evidenceRef?: string }) {
    const t = await this.prisma.tenancy.findUnique({ where: { id: input.tenancyId } });
    if (!t) throw new NotFound("Tenancy not found");
    return this.settlePayment(staffId, input);
  }

  /** Record an off-platform payment against the oldest unpaid charge (RENT, GJ-11). */
  async recordOffPlatform(participantId: string, input: { tenancyId: string; amountKobo: string; reference?: string; evidenceRef?: string }) {
    await this.assertOwnership(participantId, input.tenancyId);
    return this.settlePayment(participantId, input);
  }

  private async settlePayment(actorId: string, input: { tenancyId: string; amountKobo: string; reference?: string; evidenceRef?: string }) {
    await this.generateCharges(input.tenancyId);
    const charge = await this.prisma.rentCharge.findFirst({
      where: { tenancyId: input.tenancyId, status: { in: ["OVERDUE", "DUE"] } },
      orderBy: { periodStart: "asc" },
    });
    if (!charge) throw new Conflict("No rent charge is due");

    const payment = await this.prisma.$transaction(async (tx) => {
      await tx.rentCharge.update({ where: { id: charge.id }, data: { status: "PAID", paidAt: new Date() } });
      const p = await tx.payment.create({
        data: {
          tenancyId: input.tenancyId,
          rentChargeId: charge.id,
          amountKobo: BigInt(input.amountKobo),
          provenance: "off_platform",
          reference: input.reference,
          evidenceRef: input.evidenceRef,
          recordedBy: actorId,
        },
      });
      await this.outbox.emit(tx, "payment.recorded", input.tenancyId, { chargeId: charge.id, provenance: "off_platform" });
      await this.outbox.emit(tx, "receipt.issued", input.tenancyId, { paymentId: p.id });
      await this.audit.record(tx, { actor: actorId, action: "payment.record_off_platform", objectRef: `tenancy:${input.tenancyId}`, after: { chargeId: charge.id } });
      return p;
    });

    return { recorded: true, paymentId: payment.id, chargeId: charge.id };
  }
}
