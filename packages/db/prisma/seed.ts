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
 */
import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes, createHash } from "node:crypto";

const prisma = new PrismaClient();

/** Dev password hashing, format scrypt:<saltHex>:<hashHex> (mirrored by the API). */
function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const DEV_STAFF_PASSWORD = "kiataker-dev";

async function main() {
  console.log("Seeding Kiataker personas...");

  // ---- Organisation: KIA TAKER LTD (one company at launch) ----
  const org = await prisma.organisation.upsert({
    where: { id: "00000000-0000-7000-8000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-7000-8000-000000000001",
      legalName: "KIA TAKER LTD",
      kind: "PLATFORM_OPERATOR",
      active: true,
      createdBy: "seed",
    },
  });

  // ---- Five Command Centres with one staff seat each ----
  const centres = [
    { key: "ceo", name: "CEO Command Centre", role: "ceo" },
    { key: "operations", name: "Operations Command Centre", role: "head_of_operations" },
    { key: "product", name: "Product Management Command Centre", role: "product_officer" },
    { key: "legal", name: "Legal and Compliance Command Centre", role: "legal_officer" },
    { key: "accounts", name: "Accounts Command Centre", role: "accounts_executive" },
  ];

  for (const c of centres) {
    const centre = await prisma.commandCentre.upsert({
      where: { key: c.key },
      update: { name: c.name },
      create: { key: c.key, name: c.name, organisationId: org.id },
    });

    const staffEmail = `${c.key}@kiataker.ng`;
    const staff = await prisma.participant.upsert({
      where: { id: `00000000-0000-7000-8001-0000000000${centres.indexOf(c) + 10}` },
      update: {},
      create: {
        id: `00000000-0000-7000-8001-0000000000${centres.indexOf(c) + 10}`,
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
    const seat = await prisma.seat.findFirst({ where: { commandCentreId: centre.id, role: c.role } });
    const seatRow =
      seat ?? (await prisma.seat.create({ data: { commandCentreId: centre.id, role: c.role } }));
    const existingAssign = await prisma.seatAssignment.findFirst({
      where: { seatId: seatRow.id, participantId: staff.id },
    });
    if (!existingAssign)
      await prisma.seatAssignment.create({ data: { seatId: seatRow.id, participantId: staff.id } });
  }

  // ---- Platform controls (controls first, default off in production; BP-08, §54) ----
  const controls: { key: string; risk: "LOW" | "MEDIUM" | "HIGH"; enabled: boolean; parentKey?: string }[] = [
    { key: "payments.live", risk: "HIGH", enabled: false },
    { key: "channel.whatsapp", risk: "MEDIUM", enabled: true },
    { key: "channel.whatsapp.arrears", risk: "HIGH", enabled: false, parentKey: "channel.whatsapp" },
    { key: "public.property_search", risk: "LOW", enabled: false },
    { key: "homepage.search_window", risk: "LOW", enabled: false },
    { key: "store_badges", risk: "LOW", enabled: false },
    { key: "mobile_app", risk: "LOW", enabled: false },
    { key: "compliance.ndpa", risk: "MEDIUM", enabled: true },
  ];
  for (const ctrl of controls) {
    await prisma.platformControl.upsert({
      where: { key: ctrl.key },
      update: { risk: ctrl.risk },
      create: { key: ctrl.key, risk: ctrl.risk, enabled: ctrl.enabled, parentKey: ctrl.parentKey, environment: "all" },
    });
  }

  // ---- Action routing rules (§9, ACT-07) ----
  const routes: { eventType: string; decision: string; priority: "CRITICAL" | "URGENT" | "OVERDUE" | "IMPORTANT" | "NORMAL" }[] = [
    { eventType: "tenancy.confirmed", decision: "know", priority: "NORMAL" },
    { eventType: "tenancy.disputed", decision: "decide", priority: "URGENT" },
    { eventType: "rent.period_overdue", decision: "decide", priority: "OVERDUE" },
    { eventType: "notice.delivery_failed", decision: "decide", priority: "URGENT" },
    { eventType: "renewal.window_open", decision: "decide", priority: "IMPORTANT" },
  ];
  for (const r of routes) {
    await prisma.actionRoutingRule.upsert({
      where: { eventType: r.eventType },
      update: { decision: r.decision, priority: r.priority },
      create: r,
    });
  }

  // ---- Terms versions (Terms of Use, Mandate, Privacy Notice) ----
  for (const kind of ["TERMS_OF_USE", "MANDATE", "PRIVACY_NOTICE"] as const) {
    const doc = await prisma.termsDocument.upsert({
      where: { id: `00000000-0000-7000-8002-0000000000${kind.length}` },
      update: {},
      create: { id: `00000000-0000-7000-8002-0000000000${kind.length}`, kind, organisationId: org.id },
    });
    const existing = await prisma.termsVersion.findFirst({ where: { termsDocumentId: doc.id, version: 1 } });
    if (!existing)
      await prisma.termsVersion.create({
        data: {
          termsDocumentId: doc.id,
          version: 1,
          contentHash: sha256(`${kind}-v1`),
          effectiveFrom: new Date("2026-01-01"),
        },
      });
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
