import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

export interface TenancyLabel {
  propertyId: string;
  property: string | null;
  tenant: string | null;
  expiryDate: Date | null;
}

/**
 * Batched label lookups for admin boards (Phase 5 performance). Boards used to resolve a property
 * or tenant name per row (an N+1 that got slow on large data). These helpers take the whole set of
 * ids and return one map after a single query, so a board is a constant number of round trips.
 */
@Injectable()
export class LabelService {
  constructor(private readonly prisma: PrismaService) {}

  /** propertyId -> "REF · address", for a set of ids, in one query. */
  async properties(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (unique.length === 0) return new Map();
    const rows = await this.prisma.property.findMany({ where: { id: { in: unique } }, select: { id: true, reference: true, addressRaw: true } });
    return new Map(rows.map((p) => [p.id, `${p.reference} · ${p.addressRaw}`]));
  }

  /** tenancyId -> { property label, tenant name, propertyId, expiry }, for a set of ids, in one query. */
  async tenancies(ids: (string | null | undefined)[]): Promise<Map<string, TenancyLabel>> {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (unique.length === 0) return new Map();
    const rows = await this.prisma.tenancy.findMany({
      where: { id: { in: unique } },
      include: { property: true, participants: { include: { tenantProfile: true } } },
    });
    return new Map(
      rows.map((t) => [
        t.id,
        {
          propertyId: t.propertyId,
          property: t.property ? `${t.property.reference} · ${t.property.addressRaw}` : null,
          tenant: t.participants[0]?.tenantProfile?.name ?? null,
          expiryDate: t.expiryDate,
        },
      ]),
    );
  }
}
