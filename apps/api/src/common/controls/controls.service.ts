import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { ControlDisabled, NotFound, Conflict } from "../errors/domain-errors.js";

/**
 * Platform controls (BP-08, §26, §54). Controls first: every feature entry point checks
 * its control. Missing or uncertain control state fails closed.
 */
@Injectable()
export class ControlsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async isEnabled(key: string): Promise<boolean> {
    const control = await this.prisma.platformControl.findUnique({ where: { key } });
    if (!control) return false; // fail closed on unknown control
    if (!control.enabled) return false;
    if (control.parentKey) {
      const parentOn = await this.isEnabled(control.parentKey);
      if (!parentOn) return false;
    }
    return true;
  }

  async assertEnabled(key: string): Promise<void> {
    if (!(await this.isEnabled(key))) throw new ControlDisabled(key);
  }

  /**
   * Toggle a control (staff). A HIGH-risk control needs a reason (a light CEO sign-off, P0-08);
   * the change is audited with actor and reason. Enabling a child whose parent is off is
   * allowed but still reads as disabled until the parent is on (fail-closed, consistent).
   */
  async setEnabled(key: string, enabled: boolean, actor: string, reason?: string) {
    const control = await this.prisma.platformControl.findUnique({ where: { key } });
    if (!control) throw new NotFound("Control not found");
    if (control.risk === "HIGH" && enabled && !reason?.trim()) {
      throw new Conflict("A high-risk control needs a reason to switch on");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.platformControl.update({ where: { key }, data: { enabled } });
      await this.audit.record(tx, {
        actor,
        action: enabled ? "control.enable" : "control.disable",
        objectRef: `control:${key}`,
        reason: reason?.trim(),
        before: { enabled: control.enabled },
        after: { enabled },
      });
    });
    return { key, enabled, effective: await this.isEnabled(key) };
  }
}
