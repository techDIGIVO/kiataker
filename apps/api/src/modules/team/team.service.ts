import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { CryptoService } from "../../common/crypto/crypto.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { AccessService } from "./access.service.js";
import { NotFound, Conflict } from "../../common/errors/domain-errors.js";

/**
 * Team and access management (P0-07). Super-admins (CEO Command Centre) add staff, assign them to
 * Command Centres with a role, suspend or remove them, and see who has access to what. Removal is
 * a soft delete (suspend + end every seat) so the audit trail and references stay intact.
 */
@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly access: AccessService,
  ) {}

  private email(valueEncrypted: string): string {
    try {
      const d = this.crypto.decrypt(valueEncrypted);
      return d || valueEncrypted;
    } catch {
      return valueEncrypted; // seed rows store plaintext in dev
    }
  }

  async commandCentres() {
    const centres = await this.prisma.commandCentre.findMany({ orderBy: { key: "asc" } });
    return centres.map((c) => ({ key: c.key, name: c.name }));
  }

  async listStaff(actorId: string) {
    await this.access.assertSuperAdmin(actorId);
    const staff = await this.prisma.participant.findMany({
      where: { kind: "STAFF" },
      include: {
        contactPoints: { where: { channel: "EMAIL" }, take: 1 },
        seatAssignments: { where: { toDate: null }, include: { seat: { include: { commandCentre: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });
    return staff.map((s) => {
      const centres = s.seatAssignments.map((a) => ({ centre: a.seat.commandCentre.key, name: a.seat.commandCentre.name, role: a.seat.role }));
      return {
        id: s.id,
        displayName: s.displayName,
        email: s.contactPoints[0] ? this.email(s.contactPoints[0].valueEncrypted) : null,
        status: s.status,
        isSuperAdmin: centres.some((c) => c.centre === "ceo"),
        centres,
        createdAt: s.createdAt.toISOString(),
      };
    });
  }

  async addStaff(actorId: string, input: { displayName: string; email: string; password: string; centreKey: string; role: string }) {
    await this.access.assertSuperAdmin(actorId);
    if (!input.displayName?.trim() || !input.email?.trim() || !input.password || input.password.length < 8) {
      throw new Conflict("A name, email and a password of at least 8 characters are required");
    }
    const valueHash = this.crypto.valueHash(input.email);
    const existing = await this.prisma.contactPoint.findUnique({ where: { channel_valueHash: { channel: "EMAIL", valueHash } } });
    if (existing) throw new Conflict("A user with that email already exists");
    const centre = await this.prisma.commandCentre.findUnique({ where: { key: input.centreKey } });
    if (!centre) throw new NotFound("Command centre not found");

    const staff = await this.prisma.$transaction(async (tx) => {
      const p = await tx.participant.create({ data: { displayName: input.displayName.trim(), kind: "STAFF", status: "ACTIVE", emailVerified: true, passwordHash: this.crypto.hashPassword(input.password), createdBy: actorId } });
      await tx.contactPoint.create({ data: { participantId: p.id, channel: "EMAIL", valueHash, valueEncrypted: this.crypto.encrypt(input.email.trim()), verifiedAt: new Date(), primary: true } });
      const seat = (await tx.seat.findFirst({ where: { commandCentreId: centre.id, role: input.role } })) ?? (await tx.seat.create({ data: { commandCentreId: centre.id, role: input.role } }));
      await tx.seatAssignment.create({ data: { seatId: seat.id, participantId: p.id } });
      await this.audit.record(tx, { actor: actorId, action: "team.add_staff", objectRef: `participant:${p.id}`, after: { centre: input.centreKey, role: input.role } });
      return p;
    });
    return this.one(actorId, staff.id);
  }

  async setStatus(actorId: string, id: string, status: "ACTIVE" | "SUSPENDED") {
    await this.access.assertSuperAdmin(actorId);
    if (id === actorId) throw new Conflict("You cannot change your own status");
    if (status !== "ACTIVE" && status !== "SUSPENDED") throw new Conflict("Status must be ACTIVE or SUSPENDED");
    const p = await this.prisma.participant.findUnique({ where: { id } });
    if (!p || p.kind !== "STAFF") throw new NotFound("Staff user not found");
    await this.prisma.$transaction(async (tx) => {
      await tx.participant.update({ where: { id }, data: { status } });
      await this.audit.record(tx, { actor: actorId, action: "team.set_status", objectRef: `participant:${id}`, after: { status } });
    });
    return this.one(actorId, id);
  }

  async assignCentre(actorId: string, id: string, centreKey: string, role: string) {
    await this.access.assertSuperAdmin(actorId);
    const p = await this.prisma.participant.findUnique({ where: { id } });
    if (!p || p.kind !== "STAFF") throw new NotFound("Staff user not found");
    const centre = await this.prisma.commandCentre.findUnique({ where: { key: centreKey } });
    if (!centre) throw new NotFound("Command centre not found");
    const seat = (await this.prisma.seat.findFirst({ where: { commandCentreId: centre.id, role } })) ?? (await this.prisma.seat.create({ data: { commandCentreId: centre.id, role } }));
    const existing = await this.prisma.seatAssignment.findFirst({ where: { seatId: seat.id, participantId: id, toDate: null } });
    if (!existing) {
      await this.prisma.$transaction(async (tx) => {
        await tx.seatAssignment.create({ data: { seatId: seat.id, participantId: id } });
        await this.audit.record(tx, { actor: actorId, action: "team.assign_centre", objectRef: `participant:${id}`, after: { centre: centreKey, role } });
      });
    }
    return this.one(actorId, id);
  }

  async unassignCentre(actorId: string, id: string, centreKey: string) {
    await this.access.assertSuperAdmin(actorId);
    if (id === actorId && centreKey === "ceo") throw new Conflict("You cannot remove your own super-admin access");
    const centre = await this.prisma.commandCentre.findUnique({ where: { key: centreKey } });
    if (!centre) throw new NotFound("Command centre not found");
    const assigns = await this.prisma.seatAssignment.findMany({ where: { participantId: id, toDate: null, seat: { commandCentreId: centre.id } } });
    await this.prisma.$transaction(async (tx) => {
      for (const a of assigns) await tx.seatAssignment.update({ where: { id: a.id }, data: { toDate: new Date() } });
      await this.audit.record(tx, { actor: actorId, action: "team.unassign_centre", objectRef: `participant:${id}`, after: { centre: centreKey } });
    });
    return this.one(actorId, id);
  }

  async removeStaff(actorId: string, id: string) {
    await this.access.assertSuperAdmin(actorId);
    if (id === actorId) throw new Conflict("You cannot remove yourself");
    const p = await this.prisma.participant.findUnique({ where: { id } });
    if (!p || p.kind !== "STAFF") throw new NotFound("Staff user not found");
    await this.prisma.$transaction(async (tx) => {
      await tx.participant.update({ where: { id }, data: { status: "SUSPENDED" } });
      await tx.seatAssignment.updateMany({ where: { participantId: id, toDate: null }, data: { toDate: new Date() } });
      await this.audit.record(tx, { actor: actorId, action: "team.remove_staff", objectRef: `participant:${id}`, reason: "removed from the team" });
    });
    return { removed: true };
  }

  private async one(actorId: string, id: string) {
    const all = await this.listStaff(actorId);
    const row = all.find((s) => s.id === id);
    if (!row) throw new NotFound("Staff user not found");
    return row;
  }
}
