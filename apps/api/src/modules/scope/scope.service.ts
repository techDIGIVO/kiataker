import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { LabelService } from "../../common/read/label.service.js";
import { Forbidden, NotFound } from "../../common/errors/domain-errors.js";

export const SOM_SERVICES = ["rentCollection", "maintenance", "notices", "inspections", "renewals"] as const;
export type SomService = (typeof SOM_SERVICES)[number];

/**
 * Scope of management (PRD §9, SOM-01, GJ-20). The landlord agrees which services Kiataker
 * manages for a property. Each capability checks its service is in scope before it runs; a
 * property with no explicit scope defaults to all services on, so nothing is gated by surprise.
 */
@Injectable()
export class ScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly labels: LabelService,
  ) {}

  private async assertOwnership(landlordId: string, propertyId: string): Promise<void> {
    const link = await this.prisma.propertyParticipant.findFirst({ where: { participantId: landlordId, propertyId } });
    if (!link) throw new Forbidden("This property is not on your account");
  }

  /** Is a service in scope for a property? Absent scope defaults to on. */
  async inScope(propertyId: string, service: SomService): Promise<boolean> {
    const som = await this.prisma.scopeOfManagement.findUnique({ where: { propertyId } });
    if (!som) return true;
    return Boolean((som as Record<string, unknown>)[service]);
  }

  async get(landlordId: string, propertyId: string) {
    await this.assertOwnership(landlordId, propertyId);
    const som = await this.prisma.scopeOfManagement.findUnique({ where: { propertyId } });
    if (!som) {
      return { propertyId, status: "DEFAULT", version: 0, agreedAt: null, services: Object.fromEntries(SOM_SERVICES.map((s) => [s, true])) };
    }
    return this.toDto(som);
  }

  /** Agree (or update) the scope of management for a property. */
  async set(landlordId: string, propertyId: string, services: Partial<Record<SomService, boolean>>) {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new NotFound("Property not found");
    await this.assertOwnership(landlordId, propertyId);
    const data: Record<string, boolean> = {};
    for (const s of SOM_SERVICES) if (typeof services[s] === "boolean") data[s] = services[s] as boolean;

    const existing = await this.prisma.scopeOfManagement.findUnique({ where: { propertyId } });
    const som = await this.prisma.scopeOfManagement.upsert({
      where: { propertyId },
      update: { ...data, status: "AGREED", version: (existing?.version ?? 1) + 1, agreedAt: new Date() },
      create: { propertyId, landlordId, ...data, status: "AGREED", agreedAt: new Date() },
    });
    await this.prisma.$transaction((tx) => this.audit.record(tx, { actor: landlordId, action: "som.set", objectRef: `property:${propertyId}`, after: data }));
    return this.toDto(som);
  }

  /** Staff set a property's scope of management on the landlord's behalf (concierge). */
  async staffSet(staffId: string, propertyId: string, services: Partial<Record<SomService, boolean>>) {
    const link = await this.prisma.propertyParticipant.findFirst({ where: { propertyId, basis: "PB-01" } });
    if (!link) throw new NotFound("This property has no landlord on record");
    const result = await this.set(link.participantId, propertyId, services);
    await this.prisma.$transaction((tx) => this.audit.record(tx, { actor: staffId, action: "admin.som.set", objectRef: `property:${propertyId}`, reason: "staff action", after: services }));
    return result;
  }

  async board() {
    const list = await this.prisma.scopeOfManagement.findMany({ orderBy: { updatedAt: "desc" }, take: 200 });
    const properties = await this.labels.properties(list.map((s) => s.propertyId));
    return list.map((s) => ({ ...this.toDto(s), property: properties.get(s.propertyId) ?? null }));
  }

  private toDto(som: { propertyId: string; status: string; version: number; agreedAt: Date | null; rentCollection: boolean; maintenance: boolean; notices: boolean; inspections: boolean; renewals: boolean }) {
    return {
      propertyId: som.propertyId,
      status: som.status,
      version: som.version,
      agreedAt: som.agreedAt?.toISOString() ?? null,
      services: { rentCollection: som.rentCollection, maintenance: som.maintenance, notices: som.notices, inspections: som.inspections, renewals: som.renewals },
    };
  }
}
