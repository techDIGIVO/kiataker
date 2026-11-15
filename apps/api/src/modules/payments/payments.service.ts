import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { OutboxService } from "../../common/outbox/outbox.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { ControlsService } from "../../common/controls/controls.service.js";
import { LabelService } from "../../common/read/label.service.js";
import { RentService } from "../rent/rent.service.js";
import { PspService } from "./psp.service.js";
import { Forbidden, NotFound, Conflict } from "../../common/errors/domain-errors.js";
import { env } from "../../common/config/env.js";

/**
 * On-platform payments (PRD §24, GJ-12). A landlord raises a checkout for a due rent charge;
 * the tenant pays through Paystack; a transaction split settles the net directly to the
 * landlord while Kiataker's coordination fee is taken as the split's platform share. Kiataker
 * never holds the money (BP-07). "sent" is never "settled": only a verified webhook (or, in
 * test mode, the dev-complete route) marks a payment SUCCESS, and applying it is idempotent.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly controls: ControlsService,
    private readonly labels: LabelService,
    private readonly rent: RentService,
    private readonly psp: PspService,
  ) {}

  /** Platform coordination fee in basis points (default 5%). Configurable, no custody. */
  private async feeBps(): Promise<number> {
    const row = await this.prisma.setting.findUnique({ where: { key: "payments.config" } });
    const v = (row?.value as { feeBps?: number } | undefined)?.feeBps;
    return typeof v === "number" && v >= 0 && v <= 2000 ? v : 500;
  }

  private async tenancyForOwner(participantId: string, tenancyId: string) {
    const t = await this.prisma.tenancy.findUnique({
      where: { id: tenancyId },
      include: { participants: { include: { tenantProfile: true } }, property: true },
    });
    if (!t) throw new NotFound("Tenancy not found");
    const link = await this.prisma.propertyParticipant.findFirst({ where: { participantId, propertyId: t.propertyId } });
    if (!link) throw new Forbidden("This tenancy is not on your account");
    return t;
  }

  /** Staff raise a checkout on the landlord's behalf (concierge; StaffGuard). */
  async createCheckoutForStaff(staffId: string, input: { tenancyId: string; chargeId?: string; email?: string }) {
    const t = await this.prisma.tenancy.findUnique({ where: { id: input.tenancyId } });
    if (!t) throw new NotFound("Tenancy not found");
    return this.buildCheckout(staffId, input);
  }

  /** Landlord raises a checkout for the oldest unpaid charge (or a specific one). */
  async createCheckout(participantId: string, input: { tenancyId: string; chargeId?: string; email?: string }) {
    await this.tenancyForOwner(participantId, input.tenancyId);
    return this.buildCheckout(participantId, input);
  }

  private async buildCheckout(actorId: string, input: { tenancyId: string; chargeId?: string; email?: string }) {
    // In live mode the capability fails closed behind its control and needs keys (BP-08).
    if (this.psp.mode() === "paystack") {
      await this.controls.assertEnabled("payments.live");
    }

    // Make sure the period charges exist before we look for one to collect.
    await this.rent.generateCharges(input.tenancyId);

    const charge = input.chargeId
      ? await this.prisma.rentCharge.findFirst({ where: { id: input.chargeId, tenancyId: input.tenancyId } })
      : await this.prisma.rentCharge.findFirst({ where: { tenancyId: input.tenancyId, status: { in: ["OVERDUE", "DUE"] } }, orderBy: { periodStart: "asc" } });
    if (!charge) throw new Conflict("No rent charge is due");
    if (charge.status === "PAID") throw new Conflict("This charge is already paid");

    const amountKobo = charge.amountKobo;
    const bps = await this.feeBps();
    const feeKobo = (amountKobo * BigInt(bps)) / 10000n;
    const netKobo = amountKobo - feeKobo;
    const reference = `KTX-${randomBytes(9).toString("hex")}`;
    const email = input.email ?? `payer-${reference.toLowerCase()}@pay.kiataker.ng`;

    const payment = await this.prisma.payment.create({
      data: {
        tenancyId: input.tenancyId,
        rentChargeId: charge.id,
        amountKobo,
        provenance: "paystack",
        status: "PENDING",
        feeKobo,
        netKobo,
        reference,
        payerEmail: email,
        recordedBy: actorId,
      },
    });

    const checkout = await this.psp.initializeCheckout({
      reference,
      amountKobo,
      netKobo,
      feeKobo,
      email,
      callbackUrl: `${env.WEB_BASE_URL}/pay/${reference}`,
    });

    await this.prisma.payment.update({ where: { id: payment.id }, data: { authorizationUrl: checkout.authorizationUrl, providerRef: checkout.providerRef } });
    await this.audit.record(this.prisma, { actor: actorId, action: "payment.checkout_created", objectRef: `payment:${payment.id}`, after: { reference } });

    return {
      reference,
      status: "PENDING",
      mode: this.psp.mode(),
      amountKobo: amountKobo.toString(),
      feeKobo: feeKobo.toString(),
      netKobo: netKobo.toString(),
      authorizationUrl: checkout.authorizationUrl,
    };
  }

  /** Public summary for the hosted pay page (no sensitive data). */
  async publicCheckout(reference: string) {
    const p = await this.prisma.payment.findFirst({ where: { reference } });
    if (!p) throw new NotFound("Payment not found");
    const tenancy = await this.prisma.tenancy.findUnique({ where: { id: p.tenancyId }, include: { property: true } });
    return {
      reference,
      status: p.status,
      mode: this.psp.mode(),
      amountKobo: p.amountKobo.toString(),
      property: tenancy?.property?.addressRaw ?? null,
      authorizationUrl: p.authorizationUrl,
    };
  }

  /** Idempotent core: apply a successful payment exactly once (webhook or dev-complete). */
  private async applySuccess(reference: string, providerRef: string, amountKobo: bigint) {
    const payment = await this.prisma.payment.findFirst({ where: { reference } });
    if (!payment) throw new NotFound("Payment not found");
    if (payment.status === "SUCCESS") return { reference, status: "SUCCESS", idempotent: true };
    if (amountKobo > 0n && amountKobo !== payment.amountKobo) throw new Conflict("Paid amount does not match the charge");

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCESS", providerRef, paidAt: new Date() } });
      if (payment.rentChargeId) {
        await tx.rentCharge.update({ where: { id: payment.rentChargeId }, data: { status: "PAID", paidAt: new Date() } });
      }
      await this.outbox.emit(tx, "payment.recorded", payment.tenancyId, { paymentId: payment.id, provenance: "paystack", chargeId: payment.rentChargeId });
      await this.outbox.emit(tx, "receipt.issued", payment.tenancyId, { paymentId: payment.id });
      await this.audit.record(tx, { actor: "psp", action: "payment.settled", objectRef: `payment:${payment.id}`, after: { providerRef } });
    });

    return { reference, status: "SUCCESS", idempotent: false };
  }

  /** Verified webhook entry (production path). Rejects an unsigned or wrong-signature body. */
  async handleWebhook(rawBody: string, signature: string | undefined) {
    const valid = await this.psp.verifySignature(rawBody, signature);
    if (!valid) throw new Forbidden("Invalid webhook signature");
    const event = this.psp.parseEvent(rawBody);
    if (event.type !== "charge.success") return { received: true, ignored: event.type };
    return this.applySuccess(event.reference, event.providerRef, event.amountKobo);
  }

  /** Test-mode convenience so the local /pay button completes a payment without PSP signing. */
  /**
   * Refund a successful on-platform payment (P4). Kiataker records the reversal and reopens the
   * charge; it never holds or moves the money (BP-07), so the actual return is the landlord's /
   * the PSP's action. Live Paystack refund-API calls are wired with live keys; here it records.
   * Idempotent.
   */
  async refund(staffId: string, reference: string) {
    const payment = await this.prisma.payment.findFirst({ where: { reference } });
    if (!payment) throw new NotFound("Payment not found");
    if (payment.status === "REFUNDED") return { reference, status: "REFUNDED", idempotent: true };
    if (payment.status !== "SUCCESS") throw new Conflict("Only a successful payment can be refunded");
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
      if (payment.rentChargeId) await tx.rentCharge.update({ where: { id: payment.rentChargeId }, data: { status: "OVERDUE", paidAt: null } });
      await this.outbox.emit(tx, "payment.refunded", payment.tenancyId, { paymentId: payment.id, reference });
      await this.audit.record(tx, { actor: staffId, action: "admin.payment.refund", objectRef: `payment:${payment.id}`, reason: "staff action", before: { status: "SUCCESS" }, after: { status: "REFUNDED" } });
    });
    return { reference, status: "REFUNDED", idempotent: false };
  }

  async devComplete(reference: string) {
    if (this.psp.mode() !== "fake") throw new Forbidden("Dev-complete is only available in test mode");
    const payment = await this.prisma.payment.findFirst({ where: { reference } });
    if (!payment) throw new NotFound("Payment not found");
    return this.applySuccess(reference, `fake_${reference}`, payment.amountKobo);
  }

  /** Staff board: every payment with its property and tenant. */
  async board() {
    const payments = await this.prisma.payment.findMany({ where: { provenance: "paystack" }, orderBy: { createdAt: "desc" }, take: 200 });
    const tenancies = await this.labels.tenancies(payments.map((p) => p.tenancyId));
    return payments.map((p) => {
      const label = tenancies.get(p.tenancyId);
      return {
        reference: p.reference,
        status: p.status,
        amountKobo: p.amountKobo.toString(),
        feeKobo: p.feeKobo.toString(),
        netKobo: p.netKobo.toString(),
        property: label?.property ?? null,
        tenant: label?.tenant ?? null,
        createdAt: p.createdAt.toISOString(),
        paidAt: p.paidAt?.toISOString() ?? null,
      };
    });
  }
}
