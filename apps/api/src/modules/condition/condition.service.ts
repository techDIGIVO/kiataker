import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { CryptoService } from "../../common/crypto/crypto.service.js";
import { OutboxService } from "../../common/outbox/outbox.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { LabelService } from "../../common/read/label.service.js";
import { Forbidden, NotFound, Conflict } from "../../common/errors/domain-errors.js";
import { env } from "../../common/config/env.js";

export interface ConditionItem {
  area: string;
  condition: string; // e.g. good | fair | damaged
  note?: string;
  evidenceRef?: string;
}

/**
 * Condition checks (PRD §16, GJ-08). A handover baseline captures the property's condition and
 * the tenant confirms it (BP-19: tenants confirm or dispute only). At move-out an exit check is
 * compared against the confirmed baseline, so close-out deductions rest on agreed evidence.
 */
@Injectable()
export class ConditionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly labels: LabelService,
  ) {}

  private async ownTenancy(landlordId: string, tenancyId: string) {
    const tenancy = await this.prisma.tenancy.findUnique({ where: { id: tenancyId }, include: { property: true } });
    if (!tenancy) throw new NotFound("Tenancy not found");
    const link = await this.prisma.propertyParticipant.findFirst({ where: { participantId: landlordId, propertyId: tenancy.propertyId } });
    if (!link) throw new Forbidden("This tenancy is not on your account");
    return tenancy;
  }

  private async ownCheck(landlordId: string, checkId: string) {
    const c = await this.prisma.conditionCheck.findUnique({ where: { id: checkId } });
    if (!c) throw new NotFound("Condition check not found");
    if (c.landlordId !== landlordId) throw new Forbidden("This condition check is not on your account");
    return c;
  }

  async create(landlordId: string, tenancyId: string, kind: "BASELINE" | "EXIT", items: ConditionItem[]) {
    const tenancy = await this.ownTenancy(landlordId, tenancyId);
    const check = await this.prisma.$transaction(async (tx) => {
      const c = await tx.conditionCheck.create({ data: { tenancyId, propertyId: tenancy.propertyId, landlordId, kind, status: "DRAFT", items: (items ?? []) as object, createdBy: landlordId } });
      await this.outbox.emit(tx, "condition.created", c.id, { tenancyId, kind });
      await this.audit.record(tx, { actor: landlordId, action: "condition.create", objectRef: `condition:${c.id}`, after: { kind } });
      return c;
    });
    return this.view(landlordId, check.id);
  }

  async setItems(landlordId: string, checkId: string, items: ConditionItem[]) {
    const c = await this.ownCheck(landlordId, checkId);
    if (c.status !== "DRAFT") throw new Conflict("This check can no longer be edited");
    await this.prisma.conditionCheck.update({ where: { id: c.id }, data: { items: (items ?? []) as object } });
    return this.view(landlordId, checkId);
  }

  /** Send the check to the tenant to confirm on a secure link (BP-09). */
  async sendToTenant(landlordId: string, checkId: string) {
    const c = await this.ownCheck(landlordId, checkId);
    if (c.status === "CONFIRMED") throw new Conflict("This check is already confirmed");
    const token = randomBytes(24).toString("hex");
    await this.prisma.conditionCheck.update({ where: { id: c.id }, data: { status: "AWAITING_TENANT", tenantConfirmTokenHash: this.crypto.valueHash(token), tenantConfirmExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } });
    return { confirmUrl: `${env.WEB_BASE_URL}/condition/${token}`, token: env.WHATSAPP_ADAPTER === "fake" ? token : undefined };
  }

  async publicView(token: string) {
    const c = await this.prisma.conditionCheck.findFirst({ where: { tenantConfirmTokenHash: this.crypto.valueHash(token) } });
    if (!c) throw new NotFound("This link is not valid");
    const tenancy = await this.prisma.tenancy.findUnique({ where: { id: c.tenancyId }, include: { property: true } });
    return { kind: c.kind, status: c.status, property: tenancy?.property?.addressRaw ?? null, items: (c.items as unknown as ConditionItem[]) ?? [], responded: c.status === "CONFIRMED" || c.status === "DISPUTED" };
  }

  /** Tenant confirms or disputes the check (BP-19). */
  async tenantRespond(token: string, input: { kind: "CONFIRM" | "DISPUTE"; note?: string }) {
    const c = await this.prisma.conditionCheck.findFirst({ where: { tenantConfirmTokenHash: this.crypto.valueHash(token) } });
    if (!c) throw new NotFound("This link is not valid");
    if (c.tenantConfirmExpiresAt && c.tenantConfirmExpiresAt < new Date()) throw new Conflict("This link has expired");
    if (c.status === "CONFIRMED" || c.status === "DISPUTED") return { status: c.status };
    const status = input.kind === "CONFIRM" ? "CONFIRMED" : "DISPUTED";
    await this.prisma.$transaction(async (tx) => {
      await tx.conditionCheck.update({ where: { id: c.id }, data: { status, tenantNote: input.note, confirmedAt: status === "CONFIRMED" ? new Date() : null } });
      await this.outbox.emit(tx, status === "CONFIRMED" ? "condition.confirmed" : "condition.disputed", c.id, { tenancyId: c.tenancyId });
    });
    return { status };
  }

  /** Compare an exit check against the confirmed baseline for the same tenancy. */
  async compare(landlordId: string, exitCheckId: string) {
    const exit = await this.ownCheck(landlordId, exitCheckId);
    if (exit.kind !== "EXIT") throw new Conflict("Only an exit check can be compared to the baseline");
    const baseline = await this.prisma.conditionCheck.findFirst({ where: { tenancyId: exit.tenancyId, kind: "BASELINE", status: "CONFIRMED" }, orderBy: { createdAt: "desc" } });
    if (!baseline) throw new Conflict("There is no confirmed baseline to compare against");
    const baseItems = (baseline.items as unknown as ConditionItem[]) ?? [];
    const exitItems = (exit.items as unknown as ConditionItem[]) ?? [];
    const areas = Array.from(new Set([...baseItems.map((i) => i.area), ...exitItems.map((i) => i.area)]));
    const rows = areas.map((area) => {
      const b = baseItems.find((i) => i.area === area);
      const e = exitItems.find((i) => i.area === area);
      return { area, baseline: b?.condition ?? "not recorded", exit: e?.condition ?? "not recorded", changed: (b?.condition ?? "") !== (e?.condition ?? "") };
    });
    return { exitCheckId, baselineId: baseline.id, changedCount: rows.filter((r) => r.changed).length, rows };
  }

  private async ownerOf(checkId: string): Promise<string> {
    const c = await this.prisma.conditionCheck.findUnique({ where: { id: checkId } });
    if (!c) throw new NotFound("Condition check not found");
    return c.landlordId;
  }

  /** Staff send a check to the tenant on the landlord's behalf (concierge). */
  async staffSendToTenant(staffId: string, checkId: string) {
    const result = await this.sendToTenant(await this.ownerOf(checkId), checkId);
    await this.prisma.$transaction((tx) => this.audit.record(tx, { actor: staffId, action: "admin.condition.send", objectRef: `condition:${checkId}`, reason: "staff action" }));
    return result;
  }

  /** Staff compare an exit check to the confirmed baseline (concierge). */
  async staffCompare(staffId: string, checkId: string) {
    return this.compare(await this.ownerOf(checkId), checkId);
  }

  async view(landlordId: string, checkId: string) {
    const c = await this.ownCheck(landlordId, checkId);
    return this.toDto(c);
  }

  /** Staff view a single check's full detail (concierge; no ownership gate). */
  async staffView(checkId: string) {
    const c = await this.prisma.conditionCheck.findUnique({ where: { id: checkId } });
    if (!c) throw new NotFound("Condition check not found");
    return this.toDto(c);
  }

  async listForOwner(landlordId: string) {
    const list = await this.prisma.conditionCheck.findMany({ where: { landlordId }, orderBy: { createdAt: "desc" }, take: 30 });
    return this.decorateAll(list);
  }

  async board() {
    const list = await this.prisma.conditionCheck.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return this.decorateAll(list);
  }

  private toDto(c: { id: string; tenancyId: string; kind: string; status: string; items: unknown; tenantNote: string | null; confirmedAt: Date | null; createdAt: Date }) {
    return {
      id: c.id,
      tenancyId: c.tenancyId,
      kind: c.kind,
      status: c.status,
      items: (c.items as ConditionItem[]) ?? [],
      tenantNote: c.tenantNote,
      confirmedAt: c.confirmedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    };
  }

  private async decorateAll(list: { id: string; tenancyId: string; propertyId: string; kind: string; status: string; items: unknown; createdAt: Date }[]) {
    const tenancies = await this.labels.tenancies(list.map((c) => c.tenancyId));
    return list.map((c) => {
      const label = tenancies.get(c.tenancyId);
      const items = (c.items as ConditionItem[]) ?? [];
      return {
        id: c.id,
        kind: c.kind,
        status: c.status,
        property: label?.property ?? null,
        tenant: label?.tenant ?? null,
        itemCount: items.length,
        createdAt: c.createdAt.toISOString(),
      };
    });
  }
}
