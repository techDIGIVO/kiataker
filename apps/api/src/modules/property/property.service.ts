import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { CreatePropertySchema, type Property as PropertyDto } from "@kiataker/contracts";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { OutboxService } from "../../common/outbox/outbox.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { validate } from "../../common/validation/validate.js";
import { NotFound, Forbidden } from "../../common/errors/domain-errors.js";
import type { Tx } from "../../common/prisma/tx.js";

@Injectable()
export class PropertyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  private async platformOrgId(tx: Tx): Promise<string> {
    const org = await tx.organisation.findFirst({ where: { kind: "PLATFORM_OPERATOR" } });
    if (!org) throw new NotFound("Platform organisation not seeded");
    return org.id;
  }

  private reference(): string {
    const year = new Date().getFullYear();
    return `KT-${year}-${randomBytes(3).toString("hex").toUpperCase()}`;
  }

  private toDto(p: {
    id: string;
    reference: string;
    addressRaw: string;
    buildingUse: string;
    unitUse: string | null;
    state: string;
    qcStatus: string;
    managedAt: Date | null;
    createdAt: Date;
  }): PropertyDto {
    return {
      id: p.id,
      reference: p.reference,
      addressRaw: p.addressRaw,
      buildingUse: p.buildingUse as PropertyDto["buildingUse"],
      unitUse: (p.unitUse as PropertyDto["unitUse"]) ?? null,
      state: p.state as PropertyDto["state"],
      qcStatus: p.qcStatus as PropertyDto["qcStatus"],
      managedAt: p.managedAt ? p.managedAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
    };
  }

  /** Create a Property File. Management starts at this moment (BP-01, GJ-02). */
  async create(participantId: string, body: unknown): Promise<PropertyDto> {
    const input = validate(CreatePropertySchema, body);

    const property = await this.prisma.$transaction(async (tx) => {
      const organisationId = await this.platformOrgId(tx);
      const prop = await tx.property.create({
        data: {
          reference: this.reference(),
          organisationScope: organisationId,
          addressRaw: input.addressRaw,
          addressNormalised: input.addressRaw.trim().toLowerCase(),
          buildingUse: input.buildingUse,
          unitUse: input.unitUse,
          building: input.building,
          unit: input.unit,
          state: "MANAGED", // creation means management (BP-01)
          managedAt: new Date(),
          createdBy: participantId,
        },
      });
      await tx.propertyParticipant.create({
        data: { propertyId: prop.id, participantId, basis: "PB-01", scope: "whole" },
      });
      await tx.mandate.create({
        data: {
          propertyId: prop.id,
          organisationId,
          status: "ACTIVE",
          effectiveFrom: new Date(),
        },
      });
      await tx.propertyTimelineEvent.create({
        data: {
          propertyId: prop.id,
          eventType: "property.managed",
          summary: "Property File created and management started",
        },
      });
      await this.outbox.emit(tx, "property.created", prop.id, { reference: prop.reference });
      await this.outbox.emit(tx, "property.managed", prop.id, {});
      await this.audit.record(tx, {
        actor: participantId,
        action: "property.create",
        objectRef: `property:${prop.id}`,
        after: { reference: prop.reference, state: prop.state },
      });
      return prop;
    });

    return this.toDto(property);
  }

  /**
   * Create a unit that belongs to a grouped building (GJ-24). Same management writes as create()
   * (participant link, active mandate, timeline, events, audit), but tied to a building and
   * carrying its own unit use. The caller has already established ownership of the building.
   */
  async createUnit(
    participantId: string,
    input: { addressRaw: string; buildingId: string; buildingUse: "RESIDENTIAL" | "COMMERCIAL" | "MIXED_USE"; unitUse: "RESIDENTIAL" | "SHOP" | "OFFICE" | "WAREHOUSE" | "OTHER_BUSINESS"; unit?: string; building?: string },
  ): Promise<PropertyDto> {
    const property = await this.prisma.$transaction(async (tx) => {
      const organisationId = await this.platformOrgId(tx);
      const prop = await tx.property.create({
        data: {
          reference: this.reference(),
          organisationScope: organisationId,
          addressRaw: input.addressRaw,
          addressNormalised: input.addressRaw.trim().toLowerCase(),
          buildingUse: input.buildingUse,
          unitUse: input.unitUse,
          building: input.building,
          unit: input.unit,
          buildingId: input.buildingId,
          state: "MANAGED",
          managedAt: new Date(),
          createdBy: participantId,
        },
      });
      await tx.propertyParticipant.create({ data: { propertyId: prop.id, participantId, basis: "PB-01", scope: "unit" } });
      await tx.mandate.create({ data: { propertyId: prop.id, organisationId, status: "ACTIVE", effectiveFrom: new Date() } });
      await tx.propertyTimelineEvent.create({ data: { propertyId: prop.id, eventType: "property.managed", summary: `Unit added to a building (${input.unitUse})` } });
      await this.outbox.emit(tx, "property.created", prop.id, { reference: prop.reference, buildingId: input.buildingId });
      await this.outbox.emit(tx, "property.managed", prop.id, {});
      await this.audit.record(tx, { actor: participantId, action: "property.create_unit", objectRef: `property:${prop.id}`, after: { reference: prop.reference, unitUse: input.unitUse } });
      return prop;
    });
    return this.toDto(property);
  }

  async listForLandlord(participantId: string): Promise<PropertyDto[]> {
    const links = await this.prisma.propertyParticipant.findMany({
      where: { participantId },
      include: { property: true },
      orderBy: { createdAt: "desc" },
    });
    return links.map((l) => this.toDto(l.property));
  }

  private async assertOwnership(participantId: string, propertyId: string): Promise<void> {
    const link = await this.prisma.propertyParticipant.findFirst({
      where: { participantId, propertyId },
    });
    if (!link) throw new Forbidden("This property is not on your account");
  }

  async get(participantId: string, propertyId: string): Promise<PropertyDto> {
    await this.assertOwnership(participantId, propertyId);
    const prop = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!prop) throw new NotFound("Property not found");
    return this.toDto(prop);
  }

  async timeline(participantId: string, propertyId: string) {
    await this.assertOwnership(participantId, propertyId);
    const events = await this.prisma.propertyTimelineEvent.findMany({
      where: { propertyId },
      orderBy: { at: "desc" },
    });
    return events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      summary: e.summary,
      at: e.at.toISOString(),
    }));
  }
}
