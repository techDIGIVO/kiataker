import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { CryptoService } from "../../common/crypto/crypto.service.js";
import { OutboxService } from "../../common/outbox/outbox.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { LabelService } from "../../common/read/label.service.js";
import { RentService } from "../rent/rent.service.js";
import { Forbidden, NotFound, Conflict } from "../../common/errors/domain-errors.js";
import { env } from "../../common/config/env.js";

interface StartInput {
  propertyId: string;
  tenant: { name: string; whatsapp?: string; email?: string };
  terms: { rentKobo: string; frequency: string; commencementDate: string; expiryDate: string; cautionFeeKobo?: string; noticePeriod?: string };
}

/**
 * New-tenancy origination (GJ-05, ORIGINATION route). A draft tenancy is created EXPECTED and
 * passes every gate — terms set, tenant accepted on a secure link, caution fee settled or waived
 * — before it ACTIVATES. Activation is atomic (occupancy + tenancy + rent schedule in one
 * transaction), refused until every gate is green (fail closed), and idempotent.
 */
@Injectable()
export class OriginationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly labels: LabelService,
    private readonly rent: RentService,
  ) {}

  private derivePhase(commencement: Date, expiry: Date): "FUTURE_DATED" | "CURRENT" | "EXPIRED" {
    const now = new Date();
    if (expiry < now) return "EXPIRED";
    if (commencement > now) return "FUTURE_DATED";
    return "CURRENT";
  }

  private async assertOwnership(landlordId: string, propertyId: string): Promise<void> {
    const link = await this.prisma.propertyParticipant.findFirst({ where: { participantId: landlordId, propertyId } });
    if (!link) throw new Forbidden("This property is not on your account");
  }

  private async ownOrigination(landlordId: string, originationId: string) {
    const o = await this.prisma.tenancyOrigination.findUnique({ where: { id: originationId } });
    if (!o) throw new NotFound("Origination not found");
    if (o.landlordId !== landlordId) throw new Forbidden("This origination is not on your account");
    return o;
  }

  /** Start an origination: a DRAFT tenancy, EXPECTED occupancy, and a tenant-accept link. */
  async start(landlordId: string, input: StartInput) {
    await this.assertOwnership(landlordId, input.propertyId);
    const property = await this.prisma.property.findUnique({ where: { id: input.propertyId } });
    if (!property) throw new NotFound("Property not found");
    if (property.state !== "MANAGED") throw new Conflict("The property is not under management");

    const commencement = new Date(input.terms.commencementDate);
    const expiry = new Date(input.terms.expiryDate);
    const token = randomBytes(24).toString("hex");

    const result = await this.prisma.$transaction(async (tx) => {
      const occupancy = await tx.occupancy.create({ data: { propertyId: property.id, state: "EXPECTED", fromDate: commencement } });
      const tenancy = await tx.tenancy.create({
        data: {
          occupancyId: occupancy.id,
          propertyId: property.id,
          route: "ORIGINATION",
          managementState: "DRAFT",
          lifecyclePhase: this.derivePhase(commencement, expiry),
          status: "RECORDED",
          commencementDate: commencement,
          expiryDate: expiry,
          acceptedCommencementSource: "origination",
          createdBy: landlordId,
        },
      });
      await tx.tenancyTerm.create({
        data: {
          tenancyId: tenancy.id,
          version: 1,
          rentKobo: BigInt(input.terms.rentKobo),
          frequency: input.terms.frequency,
          cautionFeeKobo: input.terms.cautionFeeKobo ? BigInt(input.terms.cautionFeeKobo) : null,
          noticePeriod: input.terms.noticePeriod,
          effectiveFrom: commencement,
        },
      });
      const profile = await tx.tenantProfile.create({
        data: { name: input.tenant.name, contactPoints: { whatsapp: input.tenant.whatsapp ?? null, email: input.tenant.email ?? null }, source: "LANDLORD_SUPPLIED" },
      });
      await tx.tenancyParticipant.create({ data: { tenancyId: tenancy.id, tenantProfileId: profile.id, role: "TENANT" } });
      const origination = await tx.tenancyOrigination.create({
        data: {
          tenancyId: tenancy.id,
          propertyId: property.id,
          landlordId,
          status: "DRAFT",
          termsSet: true,
          cautionFeeSettled: !input.terms.cautionFeeKobo, // no caution fee required → gate already clear
          tenantAcceptTokenHash: this.crypto.valueHash(token),
          tenantAcceptExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      await this.outbox.emit(tx, "origination.started", origination.id, { tenancyId: tenancy.id });
      await this.audit.record(tx, { actor: landlordId, action: "origination.start", objectRef: `origination:${origination.id}` });
      return { origination, tenancy };
    });

    return {
      originationId: result.origination.id,
      tenancyId: result.tenancy.id,
      acceptUrl: `${env.WEB_BASE_URL}/accept/${token}`,
      acceptToken: env.WHATSAPP_ADAPTER === "fake" ? token : undefined,
    };
  }

  /** Public summary for the tenant accept page (no sensitive data). */
  async publicView(token: string) {
    const o = await this.prisma.tenancyOrigination.findFirst({ where: { tenantAcceptTokenHash: this.crypto.valueHash(token) } });
    if (!o) throw new NotFound("This link is not valid");
    const tenancy = await this.prisma.tenancy.findUnique({ where: { id: o.tenancyId }, include: { property: true, terms: { orderBy: { version: "desc" }, take: 1 }, participants: { include: { tenantProfile: true } } } });
    const term = tenancy?.terms[0];
    return {
      accepted: o.tenantAccepted,
      tenant: tenancy?.participants[0]?.tenantProfile?.name ?? null,
      property: tenancy?.property?.addressRaw ?? null,
      rentKobo: term?.rentKobo?.toString() ?? null,
      frequency: term?.frequency ?? null,
      commencementDate: tenancy?.commencementDate?.toISOString() ?? null,
    };
  }

  /** The prospective tenant accepts the terms on the secure link (BP-19). */
  async tenantAccept(token: string) {
    const o = await this.prisma.tenancyOrigination.findFirst({ where: { tenantAcceptTokenHash: this.crypto.valueHash(token) } });
    if (!o) throw new NotFound("This link is not valid");
    if (o.tenantAcceptExpiresAt && o.tenantAcceptExpiresAt < new Date()) throw new Conflict("This link has expired");
    if (o.tenantAccepted) return { accepted: true };
    await this.prisma.$transaction(async (tx) => {
      await tx.tenancyOrigination.update({ where: { id: o.id }, data: { tenantAccepted: true } });
      await this.outbox.emit(tx, "origination.tenant_accepted", o.id, { tenancyId: o.tenancyId });
    });
    return { accepted: true };
  }

  /** Record or waive the caution fee (BP-07: recorded, not custodied). */
  async settleCautionFee(landlordId: string, originationId: string, input: { amountKobo?: string; waived?: boolean }) {
    const o = await this.ownOrigination(landlordId, originationId);
    if (o.status === "ACTIVATED") throw new Conflict("This tenancy is already active");
    await this.prisma.$transaction(async (tx) => {
      if (input.amountKobo && !input.waived) {
        await tx.payment.create({ data: { tenancyId: o.tenancyId, amountKobo: BigInt(input.amountKobo), provenance: "off_platform", status: "SUCCESS", reference: "caution-fee", recordedBy: landlordId, paidAt: new Date() } });
      }
      await tx.tenancyOrigination.update({ where: { id: o.id }, data: { cautionFeeSettled: true } });
      await this.audit.record(tx, { actor: landlordId, action: "origination.caution_fee", objectRef: `origination:${o.id}`, after: { waived: Boolean(input.waived) } });
    });
    return this.gates(landlordId, originationId);
  }

  async gates(landlordId: string, originationId: string) {
    const o = await this.ownOrigination(landlordId, originationId);
    const ready = o.termsSet && o.tenantAccepted && o.cautionFeeSettled;
    return {
      originationId: o.id,
      tenancyId: o.tenancyId,
      status: o.status,
      gates: { termsSet: o.termsSet, tenantAccepted: o.tenantAccepted, cautionFeeSettled: o.cautionFeeSettled },
      ready,
      activatedAt: o.activatedAt?.toISOString() ?? null,
    };
  }

  /** Activate atomically once every gate is green. Idempotent; refused otherwise (fail closed). */
  async activate(landlordId: string, originationId: string) {
    const o = await this.ownOrigination(landlordId, originationId);
    if (o.status === "ACTIVATED") return { activated: true, tenancyId: o.tenancyId, idempotent: true };
    if (!(o.termsSet && o.tenantAccepted && o.cautionFeeSettled)) {
      throw new Conflict("Not every gate is satisfied yet, so the tenancy cannot be activated");
    }
    const tenancy = await this.prisma.tenancy.findUnique({ where: { id: o.tenancyId } });
    if (!tenancy) throw new NotFound("Tenancy not found");

    await this.prisma.$transaction(async (tx) => {
      await tx.occupancy.update({ where: { id: tenancy.occupancyId }, data: { state: "ACTIVE", fromDate: tenancy.commencementDate ?? new Date() } });
      await tx.tenancy.update({
        where: { id: tenancy.id },
        data: { managementState: "MANAGED", status: "TENANT_CONFIRMED", lifecyclePhase: this.derivePhase(tenancy.commencementDate ?? new Date(), tenancy.expiryDate ?? new Date()) },
      });
      await tx.tenancyOrigination.update({ where: { id: o.id }, data: { status: "ACTIVATED", activatedAt: new Date() } });
      await tx.propertyTimelineEvent.create({ data: { propertyId: o.propertyId, eventType: "tenancy.activated", summary: "New tenancy activated through origination" } });
      await this.outbox.emit(tx, "occupancy.activated", tenancy.occupancyId, { tenancyId: tenancy.id });
      await this.outbox.emit(tx, "tenancy.activated", tenancy.id, { propertyId: o.propertyId });
      await this.audit.record(tx, { actor: landlordId, action: "origination.activate", objectRef: `origination:${o.id}`, after: { tenancyId: tenancy.id } });
    });

    await this.rent.generateCharges(tenancy.id); // start the rent schedule
    return { activated: true, tenancyId: tenancy.id, idempotent: false };
  }

  /** Staff activate an origination on the landlord's behalf (concierge). Same gates and effects. */
  async staffActivate(staffId: string, originationId: string) {
    const o = await this.prisma.tenancyOrigination.findUnique({ where: { id: originationId } });
    if (!o) throw new NotFound("Origination not found");
    const result = await this.activate(o.landlordId, originationId);
    await this.prisma.$transaction((tx) => this.audit.record(tx, { actor: staffId, action: "admin.origination.activate", objectRef: `origination:${originationId}`, reason: "staff action" }));
    return result;
  }

  /** Originations the landlord has in flight (for chat + their own view). */
  async listForOwner(landlordId: string) {
    const list = await this.prisma.tenancyOrigination.findMany({ where: { landlordId }, orderBy: { createdAt: "desc" }, take: 20 });
    return this.decorateAll(list);
  }

  /** Staff board: every origination with its gates and property. */
  async board() {
    const list = await this.prisma.tenancyOrigination.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return this.decorateAll(list);
  }

  private async decorateAll(list: { id: string; tenancyId: string; propertyId: string; status: string; termsSet: boolean; tenantAccepted: boolean; cautionFeeSettled: boolean; createdAt: Date }[]) {
    const tenancies = await this.labels.tenancies(list.map((o) => o.tenancyId));
    return list.map((o) => {
      const label = tenancies.get(o.tenancyId);
      return {
        id: o.id,
        tenancyId: o.tenancyId,
        status: o.status,
        property: label?.property ?? null,
        tenant: label?.tenant ?? null,
        gates: { termsSet: o.termsSet, tenantAccepted: o.tenantAccepted, cautionFeeSettled: o.cautionFeeSettled },
        ready: o.termsSet && o.tenantAccepted && o.cautionFeeSettled,
        createdAt: o.createdAt.toISOString(),
      };
    });
  }
}
