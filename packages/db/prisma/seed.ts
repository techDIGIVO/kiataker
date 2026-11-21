/**
 * Kiataker seed personas (PRD §28.2). Staging has every persona:
 *  - a Day 0 landlord
 *  - a Month 12 landlord with three properties
 *  - tenants in every base-truth status
 *  - a provider in each launch category (added in later phases)
 *  - one staff member per Command Centre
 * Plus the five Command Centres, platform controls, routing rules and terms versions.
 *
 * Idempotent: safe to run repeatedly.
 *
 * DEV AND STAGING ONLY. Staff get a published password and demo landlords are created.
 * Production uses seed-prod.ts (reference data plus one super-admin from env).
 */
import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes, createHash } from "node:crypto";
import { seedReferenceData, CENTRES } from "./reference-data";
import { DEV_STAFF_PASSWORD } from "./seed-utils";

const prisma = new PrismaClient();

/** Dev password hashing, format scrypt:<saltHex>:<hashHex> (mirrored by the API). */
function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");


async function main() {
  console.log("Seeding Kiataker personas...");

  // ---- Reference data shared with production (organisation, centres, controls, routes, terms) ----
  const { org, centres } = await seedReferenceData(prisma);

  // ---- One demo staff member per Command Centre (dev/staging only: known password) ----
  for (const [i, c] of CENTRES.entries()) {
    const { seat } = centres.get(c.key)!;
    const staffEmail = `${c.key}@kiataker.ng`;
    const staff = await prisma.participant.upsert({
      where: { id: `00000000-0000-7000-8001-0000000000${i + 10}` },
      update: {},
      create: {
        id: `00000000-0000-7000-8001-0000000000${i + 10}`,
        displayName: `${c.name} Staff`,
        kind: "STAFF",
        status: "ACTIVE",
        emailVerified: true,
        passwordHash: hashPassword(DEV_STAFF_PASSWORD),
        createdBy: "seed",
      },
    });
    await prisma.contactPoint.upsert({
      where: { channel_valueHash: { channel: "EMAIL", valueHash: sha256(staffEmail) } },
      update: {},
      create: {
        participantId: staff.id,
        channel: "EMAIL",
        valueHash: sha256(staffEmail),
        valueEncrypted: staffEmail, // dev only; encrypted at rest in the API
        verifiedAt: new Date(),
        primary: true,
      },
    });
    const existingAssign = await prisma.seatAssignment.findFirst({ where: { seatId: seat.id, participantId: staff.id } });
    if (!existingAssign) await prisma.seatAssignment.create({ data: { seatId: seat.id, participantId: staff.id } });
  }

  // ---- Day 0 landlord (no property yet) ----
  const day0 = await prisma.participant.upsert({
    where: { id: "00000000-0000-7000-8003-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-7000-8003-000000000001",
      displayName: "Adaeze Okafor",
      kind: "LANDLORD",
      status: "ACTIVE",
      phoneVerified: true,
      createdBy: "seed",
    },
  });
  await prisma.contactPoint.upsert({
    where: { channel_valueHash: { channel: "WHATSAPP", valueHash: sha256("+2348030000001") } },
    update: {},
    create: {
      participantId: day0.id,
      channel: "WHATSAPP",
      valueHash: sha256("+2348030000001"),
      valueEncrypted: "+2348030000001",
      verifiedAt: new Date(),
      primary: true,
    },
  });

  // ---- Month 12 landlord with three properties ----
  const m12 = await prisma.participant.upsert({
    where: { id: "00000000-0000-7000-8003-000000000002" },
    update: {},
    create: {
      id: "00000000-0000-7000-8003-000000000002",
      displayName: "Babatunde Alao",
      kind: "LANDLORD",
      status: "ACTIVE",
      phoneVerified: true,
      createdBy: "seed",
    },
  });
  await prisma.contactPoint.upsert({
    where: { channel_valueHash: { channel: "WHATSAPP", valueHash: sha256("+2348030000002") } },
    update: {},
    create: {
      participantId: m12.id,
      channel: "WHATSAPP",
      valueHash: sha256("+2348030000002"),
      valueEncrypted: "+2348030000002",
      verifiedAt: new Date(),
      primary: true,
    },
  });

  const addresses = [
    "12 Admiralty Way, Lekki Phase 1, Lagos",
    "4B Glover Road, Ikoyi, Lagos",
    "27 Allen Avenue, Ikeja, Lagos",
  ];
  const tenancyStatuses: ("RECORDED" | "TENANT_NOTIFIED" | "TENANT_CONFIRMED" | "TENANT_DISPUTED")[] = [
    "TENANT_CONFIRMED",
    "TENANT_NOTIFIED",
    "RECORDED",
  ];

  for (let i = 0; i < addresses.length; i++) {
    const ref = `KT-SEED-${String(i + 1).padStart(4, "0")}`;
    const existingProp = await prisma.property.findUnique({ where: { reference: ref } });
    if (existingProp) continue;

    const prop = await prisma.property.create({
      data: {
        reference: ref,
        organisationScope: org.id,
        addressRaw: addresses[i]!,
        addressNormalised: addresses[i]!.toLowerCase(),
        buildingUse: "RESIDENTIAL",
        unitUse: "RESIDENTIAL",
        state: "MANAGED",
        managedAt: new Date(),
        qcStatus: "PASSED",
        createdBy: "seed",
      },
    });
    await prisma.propertyParticipant.create({
      data: { propertyId: prop.id, participantId: m12.id, basis: "PB-01", scope: "whole" },
    });
    await prisma.mandate.create({
      data: { propertyId: prop.id, organisationId: org.id, status: "ACTIVE", effectiveFrom: new Date("2025-11-01") },
    });

    const occ = await prisma.occupancy.create({ data: { propertyId: prop.id, state: "ACTIVE", fromDate: new Date("2025-12-01") } });
    const tenancy = await prisma.tenancy.create({
      data: {
        occupancyId: occ.id,
        propertyId: prop.id,
        route: "EXISTING",
        managementState: "MANAGED",
        lifecyclePhase: "CURRENT",
        status: tenancyStatuses[i]!,
        commencementDate: new Date("2025-12-01"),
        expiryDate: new Date("2026-11-30"),
        acceptedCommencementSource: "landlord",
        createdBy: "seed",
      },
    });
    await prisma.tenancyTerm.create({
      data: {
        tenancyId: tenancy.id,
        version: 1,
        rentKobo: BigInt(1_000_000 * 100),
        frequency: "annual",
        cautionFeeKobo: BigInt(500_000 * 100),
        noticePeriod: "6 months",
        effectiveFrom: new Date("2025-12-01"),
      },
    });
    const tp = await prisma.tenantProfile.create({
      data: { name: `Tenant ${i + 1}`, contactPoints: { whatsapp: `+234803100000${i + 1}` }, source: "LANDLORD_SUPPLIED" },
    });
    await prisma.tenancyParticipant.create({
      data: { tenancyId: tenancy.id, tenantProfileId: tp.id, role: "TENANT" },
    });

    // Base-truth affirmations reflecting the tenancy's status
    const affCount = tenancyStatuses[i] === "TENANT_CONFIRMED" ? 4 : tenancyStatuses[i] === "TENANT_NOTIFIED" ? 1 : 0;
    for (let n = 1; n <= affCount; n++) {
      await prisma.baseTruthAffirmation.create({
        data: { tenancyId: tenancy.id, number: n, actorKind: "TENANT", answer: "yes" },
      });
    }
  }

  console.log("✔ Seed complete.");
  console.log(`  Staff sign-in (dev): <centre>@kiataker.ng / ${DEV_STAFF_PASSWORD}`);
  console.log("  Day 0 landlord:   +2348030000001 (Adaeze Okafor)");
  console.log("  Month 12 landlord: +2348030000002 (Babatunde Alao), 3 properties");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
