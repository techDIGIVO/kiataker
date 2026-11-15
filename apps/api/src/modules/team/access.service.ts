import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { Forbidden } from "../../common/errors/domain-errors.js";

export interface Access {
  centres: string[];
  roles: string[];
  isSuperAdmin: boolean;
}

/**
 * Role-based access for the admin (PRD §26, P0-07). A staff member's authority comes from the
 * Command Centre seats they hold. Holding a seat in the CEO Command Centre is super-admin: full
 * access to every centre and the only role that can manage the team. Access to any other centre
 * is the seat for that centre (or super-admin). Seats with an end date no longer grant access.
 */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async access(participantId: string): Promise<Access> {
    const assigns = await this.prisma.seatAssignment.findMany({
      where: { participantId, toDate: null },
      include: { seat: { include: { commandCentre: true } } },
    });
    const centres = [...new Set(assigns.map((a) => a.seat.commandCentre.key))];
    const roles = [...new Set(assigns.map((a) => a.seat.role))];
    return { centres, roles, isSuperAdmin: centres.includes("ceo") };
  }

  async canAccessCentre(participantId: string, centreKey: string): Promise<boolean> {
    const a = await this.access(participantId);
    return a.isSuperAdmin || a.centres.includes(centreKey);
  }

  async assertSuperAdmin(participantId: string): Promise<void> {
    const a = await this.access(participantId);
    if (!a.isSuperAdmin) throw new Forbidden("Only the CEO Command Centre can manage the team");
  }
}
