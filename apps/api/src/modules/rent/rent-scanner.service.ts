import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { RentService } from "./rent.service.js";

/** Rent scan (PRD §31). Emits due-soon and overdue events per tenancy period. */
@Injectable()
export class RentScanner implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("RentScanner");
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly rent: RentService) {}

  onModuleInit(): void {
    if (process.env.DISABLE_RENT_SCAN === "1") return;
    this.timer = setInterval(() => void this.tick(), 30000);
    void this.tick();
    this.logger.log("Rent scanner started (30s)");
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.rent.scan();
    } catch (err) {
      this.logger.warn(`rent scan failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
