import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { Forbidden, NotFound, Conflict } from "../../common/errors/domain-errors.js";
import { PropertyService } from "./property.service.js";

export type UnitUse = "RESIDENTIAL" | "SHOP" | "OFFICE" | "WAREHOUSE" | "OTHER_BUSINESS";
export const UNIT_USES: UnitUse[] = ["RESIDENTIAL", "SHOP", "OFFICE", "WAREHOUSE", "OTHER_BUSINESS"];

/** A unit is residential only when its use is RESIDENTIAL; every other use is commercial. */
function isResidential(use: string): boolean {
  return use === "RESIDENTIAL";
}

/** Derive a building's use from its units. Residential + commercial units make it MIXED_USE. */
export function deriveBuildingUse(unitUses: string[]): "RESIDENTIAL" | "COMMERCIAL" | "MIXED_USE" | "UNKNOWN" {
  if (unitUses.length === 0) return "UNKNOWN";
  const hasResidential = unitUses.some((u) => isResidential(u));
  const hasCommercial = unitUses.some((u) => !isResidential(u));
  if (hasResidential && hasCommercial) return "MIXED_USE";
  return hasResidential ? "RESIDENTIAL" : "COMMERCIAL";
}

/** The regime that governs a unit by its use. Residential and commercial tenancies differ in law. */
export function regimeFor(unitUse: string): { regime: "RESIDENTIAL" | "COMMERCIAL"; basis: string } {
  if (isResidential(unitUse)) {
    return { regime: "RESIDENTIAL", basis: "Residential tenancy law: statutory notice periods and the tenancy agreement." };
  }
  return { regime: "COMMERCIAL", basis: "Commercial lease terms: notice and rent review follow the lease, not residential statute." };
}

/**
 * Mixed-use buildings (PRD §6, GJ-24). A building groups more than one unit, each a managed
 * Property with its own use. Flats are residential, shops and offices are commercial, and a
 * building holding both is MIXED_USE. The building's use is derived from its units (never
 * asserted), and each unit resolves the regime that governs it so notices and terms are handled
 * by the right rules. Each unit is a full Property, so every other journey works on it unchanged.
 */
@Injectable()
export class BuildingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly properties: PropertyService,
  ) {}

  private reference(): string {
    return `KT-BLD-${randomBytes(3).toString("hex").toUpperCase()}`;
  }

  private async own(landlordId: string, buildingId: string) {
    const b = await this.prisma.building.findUnique({ where: { id: buildingId } });
    if (!b) throw new NotFound("Building not found");
    if (b.landlordId !== landlordId) throw new Forbidden("This building is not on your account");
    return b;
  }

  async create(landlordId: string, addressRaw: string) {
    if (!addressRaw?.trim() || addressRaw.trim().length < 5) throw new Conflict("A building needs a full address");
    const building = await this.prisma.$transaction(async (tx) => {
      const b = await tx.building.create({ data: { reference: this.reference(), landlordId, addressRaw: addressRaw.trim(), use: "UNKNOWN" } });
      await this.audit.record(tx, { actor: landlordId, action: "building.create", objectRef: `building:${b.id}`, after: { reference: b.reference } });
      return b;
    });
    return this.view(landlordId, building.id);
  }

  /** Add a unit of a given use to the building, then re-derive the building's use. */
  async addUnit(landlordId: string, buildingId: string, input: { unitUse: UnitUse; label?: string; addressRaw?: string }) {
    const building = await this.own(landlordId, buildingId);
    if (!UNIT_USES.includes(input.unitUse)) throw new Conflict("Choose a valid unit use");

    const count = await this.prisma.property.count({ where: { buildingId } });
    const label = input.label?.trim() || `Unit ${count + 1}`;
    const unitAddress = input.addressRaw?.trim() || `${label}, ${building.addressRaw}`;

    // The unit carries the building's use so far; it is re-synced below once the use is re-derived.
    const provisionalUse = building.use === "UNKNOWN" ? (isResidential(input.unitUse) ? "RESIDENTIAL" : "COMMERCIAL") : (building.use as "RESIDENTIAL" | "COMMERCIAL" | "MIXED_USE");
    const unit = await this.properties.createUnit(landlordId, { addressRaw: unitAddress, buildingId, buildingUse: provisionalUse, unitUse: input.unitUse, unit: label, building: building.addressRaw });

    await this.resync(landlordId, buildingId);
    return { unit, building: await this.view(landlordId, buildingId) };
  }

  /** Staff add a unit to a building on the landlord's behalf (concierge). */
  async staffAddUnit(staffId: string, buildingId: string, input: { unitUse: UnitUse; label?: string; addressRaw?: string }) {
    const b = await this.prisma.building.findUnique({ where: { id: buildingId } });
    if (!b) throw new NotFound("Building not found");
    const result = await this.addUnit(b.landlordId, buildingId, input);
    await this.prisma.$transaction((tx) => this.audit.record(tx, { actor: staffId, action: "admin.building.add_unit", objectRef: `building:${buildingId}`, reason: "staff action", after: { unitUse: input.unitUse } }));
    return result;
  }

  /** Re-derive the building's use from its units and keep every unit's buildingUse in step. */
  private async resync(landlordId: string, buildingId: string) {
    const units = await this.prisma.property.findMany({ where: { buildingId } });
    const use = deriveBuildingUse(units.map((u) => u.unitUse ?? "RESIDENTIAL"));
    await this.prisma.$transaction(async (tx) => {
      await tx.building.update({ where: { id: buildingId }, data: { use } });
      if (use !== "UNKNOWN") {
        await tx.property.updateMany({ where: { buildingId }, data: { buildingUse: use } });
      }
      await this.audit.record(tx, { actor: landlordId, action: "building.use_derived", objectRef: `building:${buildingId}`, after: { use, units: units.length } });
    });
  }

  async view(landlordId: string, buildingId: string) {
    const b = await this.own(landlordId, buildingId);
    const units = await this.prisma.property.findMany({ where: { buildingId }, orderBy: { createdAt: "asc" } });
    return this.toDto(b, units);
  }

  async listForLandlord(landlordId: string) {
    const list = await this.prisma.building.findMany({ where: { landlordId }, orderBy: { createdAt: "desc" }, take: 50 });
    return this.withUnits(list);
  }

  async board() {
    const list = await this.prisma.building.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return this.withUnits(list);
  }

  /** Attach each building's units in one query, grouped in memory (no per-building read). */
  private async withUnits(list: { id: string; reference: string; addressRaw: string; use: string; createdAt: Date }[]) {
    if (list.length === 0) return [];
    const allUnits = await this.prisma.property.findMany({ where: { buildingId: { in: list.map((b) => b.id) } }, orderBy: { createdAt: "asc" } });
    const byBuilding = new Map<string, typeof allUnits>();
    for (const u of allUnits) {
      if (!u.buildingId) continue;
      const arr = byBuilding.get(u.buildingId) ?? [];
      arr.push(u);
      byBuilding.set(u.buildingId, arr);
    }
    return list.map((b) => this.toDto(b, byBuilding.get(b.id) ?? []));
  }

  private toDto(b: { id: string; reference: string; addressRaw: string; use: string; createdAt: Date }, units: { id: string; reference: string; unitUse: string | null; unit: string | null; state: string }[]) {
    const residential = units.filter((u) => isResidential(u.unitUse ?? "RESIDENTIAL")).length;
    return {
      id: b.id,
      reference: b.reference,
      addressRaw: b.addressRaw,
      use: b.use,
      mixedUse: b.use === "MIXED_USE",
      unitCount: units.length,
      residentialCount: residential,
      commercialCount: units.length - residential,
      units: units.map((u) => ({
        id: u.id,
        reference: u.reference,
        label: u.unit ?? u.reference,
        unitUse: u.unitUse ?? "RESIDENTIAL",
        state: u.state,
        ...regimeFor(u.unitUse ?? "RESIDENTIAL"),
      })),
      createdAt: b.createdAt.toISOString(),
    };
  }
}
