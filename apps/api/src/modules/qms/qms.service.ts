import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { LabelService } from "../../common/read/label.service.js";
import { NotFound, Conflict } from "../../common/errors/domain-errors.js";

export const QC_STATUSES = ["NOT_STARTED", "IN_REVIEW", "PASSED", "FLAGGED"] as const;
export type QcStatus = (typeof QC_STATUSES)[number];

/**
 * Quality Management workbench (PRD §37, QMS, P4). Staff review each Property File for data
 * quality and sign it off: NOT_STARTED -> IN_REVIEW -> PASSED or FLAGGED (with a note). The review
 * state lives on Property.qcStatus; every change writes a timeline event and an audit entry.
 */
@Injectable()
export class QmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly labels: LabelService,
  ) {}

  async board() {
    const properties = await this.prisma.property.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
    const counts = { NOT_STARTED: 0, IN_REVIEW: 0, PASSED: 0, FLAGGED: 0 } as Record<string, number>;
    const rows = properties.map((p) => {
      counts[p.qcStatus] = (counts[p.qcStatus] ?? 0) + 1;
      return { id: p.id, reference: p.reference, address: p.addressRaw, buildingUse: p.buildingUse, state: p.state, qcStatus: p.qcStatus, createdAt: p.createdAt.toISOString() };
    });
    return { counts, rows };
  }

  async setStatus(staffId: string, propertyId: string, qcStatus: string, note?: string) {
    if (!QC_STATUSES.includes(qcStatus as QcStatus)) throw new Conflict("Not a valid QC status");
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new NotFound("Property not found");
    if (qcStatus === "FLAGGED" && !note?.trim()) throw new Conflict("Flagging a property needs a note");

    await this.prisma.$transaction(async (tx) => {
      await tx.property.update({ where: { id: propertyId }, data: { qcStatus: qcStatus as QcStatus } });
      await tx.propertyTimelineEvent.create({ data: { propertyId, eventType: "qms.reviewed", summary: `QC set to ${qcStatus}${note?.trim() ? `: ${note.trim()}` : ""}` } });
      await this.audit.record(tx, { actor: staffId, action: "qms.set_status", objectRef: `property:${propertyId}`, reason: note?.trim(), before: { qcStatus: property.qcStatus }, after: { qcStatus } });
    });
    const label = (await this.labels.properties([propertyId])).get(propertyId) ?? property.reference;
    return { id: propertyId, reference: property.reference, property: label, qcStatus };
  }
}
