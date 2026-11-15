import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import {
  RecordExistingTenancySchema,
  TenantResponseSchema,
  type Tenancy as TenancyDto,
} from "@kiataker/contracts";
import { tenancyMachine, type TenancyStatus, type TenancyEvent } from "@kiataker/domain";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { OutboxService } from "../../common/outbox/outbox.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { CryptoService } from "../../common/crypto/crypto.service.js";
import { validate } from "../../common/validation/validate.js";
import { Forbidden, NotFound, Conflict } from "../../common/errors/domain-errors.js";
import { IllegalTransitionError } from "@kiataker/domain";
import { env } from "../../common/config/env.js";

export type NotifyResult = TenancyDto & { secureTaskToken?: string };

@Injectable()
export class TenancyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly crypto: CryptoService,
  ) {}

  private derivePhase(commencement: Date, expiry: Date): "FUTURE_DATED" | "CURRENT" | "EXPIRED" {
    const now = new Date();
    if (commencement > now) return "FUTURE_DATED";
    if (expiry < now) return "EXPIRED";
    return "CURRENT";
  }

  private toDto(t: {
    id: string;
    propertyId: string;
    route: string;
    status: string;
    lifecyclePhase: string;
    commencementDate: Date | null;
    expiryDate: Date | null;
    createdAt: Date;
  }): TenancyDto {
    return {
      id: t.id,
      propertyId: t.propertyId,
      route: t.route as TenancyDto["route"],
      status: t.status as TenancyDto["status"],
      lifecyclePhase: t.lifecyclePhase as TenancyDto["lifecyclePhase"],
      commencementDate: t.commencementDate ? t.commencementDate.toISOString() : null,
      expiryDate: t.expiryDate ? t.expiryDate.toISOString() : null,
      createdAt: t.createdAt.toISOString(),
    };
  }

  private async assertOwnership(participantId: string, propertyId: string): Promise<void> {
    const link = await this.prisma.propertyParticipant.findFirst({
      where: { participantId, propertyId },
    });
    if (!link) throw new Forbidden("This property is not on your account");
  }

  /** Record an existing tenancy (EXISTING route, GJ-03). Requires the accuracy prompt (TEN-08). */
  async recordExisting(participantId: string, body: unknown): Promise<TenancyDto> {
    const input = validate(RecordExistingTenancySchema, body);
    await this.assertOwnership(participantId, input.propertyId);

    const property = await this.prisma.property.findUnique({ where: { id: input.propertyId } });
    if (!property) throw new NotFound("Property not found");
    if (property.state !== "MANAGED") throw new Conflict("The property is not under management");

    const commencement = new Date(input.terms.commencementDate);
    const expiry = new Date(input.terms.expiryDate);

    const tenancy = await this.prisma.$transaction(async (tx) => {
      const occupancy = await tx.occupancy.create({
        data: { propertyId: property.id, state: "ACTIVE", fromDate: commencement },
      });
      const t = await tx.tenancy.create({
        data: {
          occupancyId: occupancy.id,
          propertyId: property.id,
          route: "EXISTING",
          managementState: "MANAGED",
          lifecyclePhase: this.derivePhase(commencement, expiry),
          status: "RECORDED",
          commencementDate: commencement,
          expiryDate: expiry,
          acceptedCommencementSource: "landlord",
          createdBy: participantId,
        },
      });
      await tx.tenancyTerm.create({
        data: {
          tenancyId: t.id,
          version: 1,
          rentKobo: input.terms.rentKobo,
          frequency: input.terms.frequency,
          cautionFeeKobo: input.terms.cautionFeeKobo,
          serviceChargeKobo: input.terms.serviceChargeKobo,
          noticePeriod: input.terms.noticePeriod,
          effectiveFrom: commencement,
        },
      });
      const profile = await tx.tenantProfile.create({
        data: {
          name: input.tenant.name,
          contactPoints: {
            whatsapp: input.tenant.whatsapp ?? null,
            email: input.tenant.email ?? null,
          },
          source: "LANDLORD_SUPPLIED",
        },
      });
      await tx.tenancyParticipant.create({
        data: { tenancyId: t.id, tenantProfileId: profile.id, role: "TENANT" },
      });
      await tx.tenancyAccuracyAcknowledgement.create({
        data: { tenancyId: t.id, landlordId: participantId, copyVersion: 1, channel: "app" },
      });
      await tx.propertyTimelineEvent.create({
        data: {
          propertyId: property.id,
          eventType: "tenancy.recorded",
          summary: `Existing tenancy recorded for ${input.tenant.name}`,
        },
      });
      await this.outbox.emit(tx, "tenancy.recorded", t.id, { propertyId: property.id });
      await this.audit.record(tx, {
        actor: participantId,
        action: "tenancy.record_existing",
        objectRef: `tenancy:${t.id}`,
        after: { status: "RECORDED" },
      });
      return t;
    });

    return this.toDto(tenancy);
  }

  async get(participantId: string, tenancyId: string): Promise<TenancyDto> {
    const t = await this.prisma.tenancy.findUnique({ where: { id: tenancyId } });
    if (!t) throw new NotFound("Tenancy not found");
    await this.assertOwnership(participantId, t.propertyId);
    return this.toDto(t);
  }

  async listForProperty(participantId: string, propertyId: string): Promise<TenancyDto[]> {
    await this.assertOwnership(participantId, propertyId);
    const list = await this.prisma.tenancy.findMany({
      where: { propertyId },
      orderBy: { createdAt: "desc" },
    });
    return list.map((t) => this.toDto(t));
  }

  private async transition(
    tenancyId: string,
    event: TenancyEvent,
    actor: string,
    eventName: string,
  ): Promise<TenancyDto> {
    const current = await this.prisma.tenancy.findUnique({ where: { id: tenancyId } });
    if (!current) throw new NotFound("Tenancy not found");
    let nextStatus: TenancyStatus;
    try {
      nextStatus = tenancyMachine.next(current.status as TenancyStatus, event);
    } catch (e) {
      if (e instanceof IllegalTransitionError) {
        throw new Conflict(`Cannot ${event} from ${current.status}`, {
          from: current.status,
          attempted: event,
        });
      }
      throw e;
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const t = await tx.tenancy.update({
        where: { id: tenancyId },
        data: { status: nextStatus },
      });
      await this.outbox.emit(tx, eventName, tenancyId, { from: current.status, to: nextStatus });
      await this.audit.record(tx, {
        actor,
        action: eventName,
        objectRef: `tenancy:${tenancyId}`,
        before: { status: current.status },
        after: { status: nextStatus },
      });
      return t;
    });
    return this.toDto(updated);
  }

  /**
   * Notify the tenant by WhatsApp and email, with delivery recorded (step 4). Issues a
   * secure task (SEC) so the tenant can confirm, dispute or correct from a secure page
   * without an account. The token is delivered by the messaging adapter (fake locally).
   */
  async notify(participantId: string, tenancyId: string): Promise<NotifyResult> {
    const t = await this.prisma.tenancy.findUnique({
      where: { id: tenancyId },
      include: { participants: { include: { tenantProfile: true } } },
    });
    if (!t) throw new NotFound("Tenancy not found");
    await this.assertOwnership(participantId, t.propertyId);

    const dto = await this.transition(tenancyId, "NOTIFY", participantId, "tenancy.notified");

    // Secure task for the tenant to confirm (7-day expiry, SEC-01..SEC-06).
    const token = randomBytes(24).toString("hex");
    const contacts = (t.participants[0]?.tenantProfile.contactPoints ?? {}) as {
      whatsapp?: string | null;
      email?: string | null;
    };
    const destination = contacts.whatsapp ?? contacts.email ?? tenancyId;
    await this.prisma.secureTask.create({
      data: {
        purpose: "TENANT_CONFIRM",
        recipientRole: "TENANT",
        destinationHash: this.crypto.valueHash(destination),
        subjectRef: `tenancy:${tenancyId}`,
        tokenHash: this.crypto.valueHash(token),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { ...dto, ...(env.WHATSAPP_ADAPTER === "fake" ? { secureTaskToken: token } : {}) };
  }

  /**
   * Tenant response (BP-19). Tenants confirm, dispute or correct only, never approve.
   * A confirmation records the four base-truth affirmations (BP-04).
   */
  async tenantResponse(tenancyId: string, body: unknown): Promise<TenancyDto> {
    const input = validate(TenantResponseSchema, body);
    const t = await this.prisma.tenancy.findUnique({ where: { id: tenancyId } });
    if (!t) throw new NotFound("Tenancy not found");

    if (input.kind === "CONFIRM") {
      await this.prisma.$transaction(async (tx) => {
        for (let n = 1; n <= 4; n++) {
          await tx.baseTruthAffirmation.upsert({
            where: { tenancyId_number: { tenancyId, number: n } },
            update: { answer: "yes" },
            create: { tenancyId, number: n, actorKind: "TENANT", answer: "yes" },
          });
        }
      });
      return this.transition(tenancyId, "TENANT_CONFIRM", "tenant", "tenancy.confirmed");
    }
    if (input.kind === "DISPUTE") {
      return this.transition(tenancyId, "TENANT_DISPUTE", "tenant", "tenancy.disputed");
    }
    return this.transition(tenancyId, "TENANT_CORRECT", "tenant", "tenancy.corrected");
  }

  /** Landlord reconciles a disputed record (GJ-04, source separation, BP-06). */
  async reconcile(participantId: string, tenancyId: string): Promise<TenancyDto> {
    const t = await this.prisma.tenancy.findUnique({ where: { id: tenancyId } });
    if (!t) throw new NotFound("Tenancy not found");
    await this.assertOwnership(participantId, t.propertyId);
    return this.transition(tenancyId, "RECONCILE", participantId, "tenancy.reconciled");
  }

  /** Staff reconcile a disputed record on the landlord's behalf (concierge; StaffGuard). */
  async reconcileForStaff(staffId: string, tenancyId: string): Promise<TenancyDto> {
    const t = await this.prisma.tenancy.findUnique({ where: { id: tenancyId } });
    if (!t) throw new NotFound("Tenancy not found");
    return this.transition(tenancyId, "RECONCILE", staffId, "tenancy.reconciled");
  }
}
