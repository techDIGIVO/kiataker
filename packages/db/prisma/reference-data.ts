/**
 * Reference data every environment needs (shared by seed.ts and seed-prod.ts):
 * the operating organisation, the five Command Centres and their seats, platform controls,
 * action routing rules and terms versions. No people and no demo data.
 *
 * Idempotent. Re-running never flips a platform control that staff have since changed.
 */
import type { PrismaClient, Organisation, CommandCentre, Seat } from "@prisma/client";
import { createHash } from "node:crypto";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export const ORG_ID = "00000000-0000-7000-8000-000000000001";

export const CENTRES = [
  { key: "ceo", name: "CEO Command Centre", role: "ceo" },
  { key: "operations", name: "Operations Command Centre", role: "head_of_operations" },
  { key: "product", name: "Product Management Command Centre", role: "product_officer" },
  { key: "legal", name: "Legal and Compliance Command Centre", role: "legal_officer" },
  { key: "accounts", name: "Accounts Command Centre", role: "accounts_executive" },
] as const;

export type CentreKey = (typeof CENTRES)[number]["key"];

export async function seedReferenceData(prisma: PrismaClient): Promise<{
  org: Organisation;
  centres: Map<CentreKey, { centre: CommandCentre; seat: Seat }>;
}> {
  // ---- Organisation: KIA TAKER LTD (one company at launch) ----
  const org = await prisma.organisation.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, legalName: "KIA TAKER LTD", kind: "PLATFORM_OPERATOR", active: true, createdBy: "seed" },
  });

  // ---- Five Command Centres, one seat each ----
  const centres = new Map<CentreKey, { centre: CommandCentre; seat: Seat }>();
  for (const c of CENTRES) {
    const centre = await prisma.commandCentre.upsert({
      where: { key: c.key },
      update: { name: c.name },
      create: { key: c.key, name: c.name, organisationId: org.id },
    });
    const seat =
      (await prisma.seat.findFirst({ where: { commandCentreId: centre.id, role: c.role } })) ??
      (await prisma.seat.create({ data: { commandCentreId: centre.id, role: c.role } }));
    centres.set(c.key, { centre, seat });
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
        data: { termsDocumentId: doc.id, version: 1, contentHash: sha256(`${kind}-v1`), effectiveFrom: new Date("2026-01-01") },
      });
  }

  return { org, centres };
}
