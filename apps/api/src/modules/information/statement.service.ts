import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { NotFound } from "../../common/errors/domain-errors.js";

/**
 * Information outputs (PRD §23, P4). A landlord rent statement: what has been charged, collected
 * and settled, and what is still outstanding, with a per-tenancy breakdown. Read-only, computed
 * from the rent charges and the successful payments. Staff can pull any landlord's; the landlord
 * gets their own over the API and WhatsApp.
 */
@Injectable()
export class StatementService {
  constructor(private readonly prisma: PrismaService) {}

  async forLandlord(landlordId: string) {
    const landlord = await this.prisma.participant.findUnique({ where: { id: landlordId } });
    if (!landlord) throw new NotFound("Landlord not found");

    const links = await this.prisma.propertyParticipant.findMany({ where: { participantId: landlordId } });
    const propertyIds = links.map((l) => l.propertyId);
    if (propertyIds.length === 0) {
      return { landlord: landlord.displayName, generatedAt: new Date().toISOString(), totals: { properties: 0, tenancies: 0, chargedKobo: "0", collectedKobo: "0", feesKobo: "0", netToLandlordKobo: "0", outstandingKobo: "0" }, tenancies: [] };
    }

    const tenancies = await this.prisma.tenancy.findMany({
      where: { propertyId: { in: propertyIds } },
      include: { property: true, participants: { include: { tenantProfile: true } } },
    });
    const tenancyIds = tenancies.map((t) => t.id);
    const [charges, payments] = await Promise.all([
      tenancyIds.length ? this.prisma.rentCharge.findMany({ where: { tenancyId: { in: tenancyIds } } }) : [],
      tenancyIds.length ? this.prisma.payment.findMany({ where: { tenancyId: { in: tenancyIds }, status: "SUCCESS" } }) : [],
    ]);

    const chargedBy = new Map<string, bigint>();
    const outstandingBy = new Map<string, bigint>();
    for (const c of charges) {
      chargedBy.set(c.tenancyId, (chargedBy.get(c.tenancyId) ?? 0n) + c.amountKobo);
      if (c.status !== "PAID") outstandingBy.set(c.tenancyId, (outstandingBy.get(c.tenancyId) ?? 0n) + c.amountKobo);
    }
    const collectedBy = new Map<string, bigint>();
    const feesBy = new Map<string, bigint>();
    const netBy = new Map<string, bigint>();
    for (const p of payments) {
      collectedBy.set(p.tenancyId, (collectedBy.get(p.tenancyId) ?? 0n) + p.amountKobo);
      feesBy.set(p.tenancyId, (feesBy.get(p.tenancyId) ?? 0n) + p.feeKobo);
      netBy.set(p.tenancyId, (netBy.get(p.tenancyId) ?? 0n) + p.netKobo);
    }

    let tCharged = 0n, tCollected = 0n, tFees = 0n, tNet = 0n, tOutstanding = 0n;
    const rows = tenancies.map((t) => {
      const charged = chargedBy.get(t.id) ?? 0n;
      const collected = collectedBy.get(t.id) ?? 0n;
      const fees = feesBy.get(t.id) ?? 0n;
      const net = netBy.get(t.id) ?? 0n;
      const outstanding = outstandingBy.get(t.id) ?? 0n;
      tCharged += charged; tCollected += collected; tFees += fees; tNet += net; tOutstanding += outstanding;
      return {
        tenancyId: t.id,
        property: `${t.property.reference} · ${t.property.addressRaw}`,
        tenant: t.participants[0]?.tenantProfile?.name ?? null,
        status: t.status,
        chargedKobo: charged.toString(),
        collectedKobo: collected.toString(),
        feesKobo: fees.toString(),
        netToLandlordKobo: net.toString(),
        outstandingKobo: outstanding.toString(),
      };
    });

    return {
      landlord: landlord.displayName,
      generatedAt: new Date().toISOString(),
      totals: {
        properties: propertyIds.length,
        tenancies: tenancies.length,
        chargedKobo: tCharged.toString(),
        collectedKobo: tCollected.toString(),
        feesKobo: tFees.toString(),
        netToLandlordKobo: tNet.toString(),
        outstandingKobo: tOutstanding.toString(),
      },
      tenancies: rows,
    };
  }
}
