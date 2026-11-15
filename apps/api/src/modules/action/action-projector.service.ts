import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { ActionService } from "./action.service.js";

/**
 * Action Centre projection poller (PRD §9, ACT-11). Reads the outbox on a 2-second poll,
 * routes by rule, dedupes and supersedes, and runs the escalation sweep. Projections can
 * be dropped and rebuilt from events without duplication.
 */
@Injectable()
export class ActionProjector implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("ActionProjector");
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly actions: ActionService) {}

  onModuleInit(): void {
    if (process.env.DISABLE_ACTION_POLLER === "1") return;
    this.timer = setInterval(() => void this.tick(), 2000);
    this.logger.log("Action Centre projection poller started (2s)");
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return; // never overlap
    this.running = true;
    try {
      await this.actions.project();
      await this.actions.resolveClosures();
      await this.actions.escalateOverdue();
    } catch (err) {
      this.logger.warn(`projection tick failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
