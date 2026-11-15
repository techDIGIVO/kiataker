import { Injectable, Logger } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { CryptoService } from "../../common/crypto/crypto.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { PropertyService } from "../property/property.service.js";
import { TenancyService } from "../tenancy/tenancy.service.js";
import { NotFound, Conflict } from "../../common/errors/domain-errors.js";
import { env } from "../../common/config/env.js";

export interface IntakeRow {
  addressRaw: string;
  buildingUse?: string;
  tenantName: string;
  rentKobo: string;
  frequency?: string;
  commencementDate: string;
  expiryDate: string;
}

/**
 * Bulk / concierge intake (PRD §10, GJ-23, PROP-09/10). Staff capture many tenancies from
 * photographed agreements or a spreadsheet into a batch; the landlord confirms the batch on a
 * secure link (their accuracy acknowledgement, BP-19), and only then are the properties and
 * tenancies created, in one commit.
 */
@Injectable()
export class IntakeService {
  private readonly logger = new Logger("IntakeService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly properties: PropertyService,
    private readonly tenancies: TenancyService,
  ) {}

  async createBatch(staffId: string, input: { landlordId: string; rows: IntakeRow[] }) {
    const landlord = await this.prisma.participant.findUnique({ where: { id: input.landlordId } });
    if (!landlord) throw new NotFound("Landlord not found");
    const rows = (input.rows ?? []).filter((r) => r.addressRaw?.trim() && r.tenantName?.trim());
    if (rows.length === 0) throw new Conflict("Add at least one complete row");
    const batch = await this.prisma.intakeBatch.create({ data: { landlordId: input.landlordId, createdBy: staffId, status: "DRAFT", rows: rows as object } });
    await this.prisma.$transaction((tx) => this.audit.record(tx, { actor: staffId, action: "intake.create", objectRef: `intake:${batch.id}`, after: { rows: rows.length } }));
    return this.view(batch.id);
  }

  /** Send the batch to the landlord to confirm (accuracy) on a secure link. */
  async sendToLandlord(staffId: string, batchId: string) {
    const batch = await this.prisma.intakeBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFound("Batch not found");
    if (batch.status === "COMMITTED") throw new Conflict("This batch is already committed");
    const token = randomBytes(24).toString("hex");
    await this.prisma.intakeBatch.update({ where: { id: batchId }, data: { status: "AWAITING_LANDLORD", confirmTokenHash: this.crypto.valueHash(token), confirmExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } });
    return { confirmUrl: `${env.WEB_BASE_URL}/intake/${token}`, token: env.WHATSAPP_ADAPTER === "fake" ? token : undefined };
  }

  async landlordView(token: string) {
    const batch = await this.prisma.intakeBatch.findFirst({ where: { confirmTokenHash: this.crypto.valueHash(token) } });
    if (!batch) throw new NotFound("This link is not valid");
    const rows = (batch.rows as unknown as IntakeRow[]) ?? [];
    return {
      status: batch.status,
      committed: batch.status === "COMMITTED",
      rows: rows.map((r) => ({ addressRaw: r.addressRaw, tenantName: r.tenantName, rentKobo: r.rentKobo, frequency: r.frequency ?? "annual" })),
    };
  }

  /** The landlord confirms the batch is accurate; the tenancies are then created (BP-19). */
  async confirm(token: string) {
    const batch = await this.prisma.intakeBatch.findFirst({ where: { confirmTokenHash: this.crypto.valueHash(token) } });
    if (!batch) throw new NotFound("This link is not valid");
    if (batch.confirmExpiresAt && batch.confirmExpiresAt < new Date()) throw new Conflict("This link has expired");
    if (batch.status === "COMMITTED") return { committed: true, created: batch.committedCount, idempotent: true };
    if (batch.status === "REJECTED") throw new Conflict("This batch was rejected");

    const rows = (batch.rows as unknown as IntakeRow[]) ?? [];
    let created = 0;
    for (const row of rows) {
      try {
        const property = await this.properties.create(batch.landlordId, { addressRaw: row.addressRaw, buildingUse: row.buildingUse ?? "RESIDENTIAL", acceptMandate: true });
        await this.tenancies.recordExisting(batch.landlordId, {
          propertyId: property.id,
          tenant: { name: row.tenantName },
          terms: { rentKobo: row.rentKobo, frequency: row.frequency ?? "annual", commencementDate: row.commencementDate, expiryDate: row.expiryDate },
          accuracyAcknowledged: true,
        });
        created++;
      } catch (e) {
        this.logger.warn(`Intake row failed (${row.addressRaw}): ${(e as Error).message}`);
      }
    }
    await this.prisma.intakeBatch.update({ where: { id: batch.id }, data: { status: "COMMITTED", confirmedAt: new Date(), committedCount: created } });
    await this.prisma.$transaction((tx) => this.audit.record(tx, { actor: `landlord:${batch.landlordId}`, action: "intake.confirm", objectRef: `intake:${batch.id}`, after: { created } }));
    return { committed: true, created, idempotent: false };
  }

  async reject(token: string) {
    const batch = await this.prisma.intakeBatch.findFirst({ where: { confirmTokenHash: this.crypto.valueHash(token) } });
    if (!batch) throw new NotFound("This link is not valid");
    if (batch.status === "COMMITTED") throw new Conflict("This batch is already committed");
    await this.prisma.intakeBatch.update({ where: { id: batch.id }, data: { status: "REJECTED" } });
    return { status: "REJECTED" };
  }

  async view(batchId: string) {
    const batch = await this.prisma.intakeBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFound("Batch not found");
    const landlord = await this.prisma.participant.findUnique({ where: { id: batch.landlordId } });
    const rows = (batch.rows as unknown as IntakeRow[]) ?? [];
    return { id: batch.id, landlord: landlord?.displayName ?? null, status: batch.status, rowCount: rows.length, committedCount: batch.committedCount, rows, createdAt: batch.createdAt.toISOString() };
  }

  async board() {
    const batches = await this.prisma.intakeBatch.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    const landlordIds = [...new Set(batches.map((b) => b.landlordId))];
    const landlords = landlordIds.length ? await this.prisma.participant.findMany({ where: { id: { in: landlordIds } }, select: { id: true, displayName: true } }) : [];
    const nameById = new Map(landlords.map((l) => [l.id, l.displayName]));
    return batches.map((b) => {
      const list = (b.rows as unknown as IntakeRow[]) ?? [];
      return { id: b.id, landlord: nameById.get(b.landlordId) ?? null, status: b.status, rowCount: list.length, committedCount: b.committedCount, createdAt: b.createdAt.toISOString() };
    });
  }
}
