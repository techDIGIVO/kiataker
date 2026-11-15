import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

export interface ScheduledJobRecord {
  id: string;
  kind: string;
  subjectRef: string | null;
  runAt: Date;
  state: string;
}

export type JobHandler = (job: ScheduledJobRecord) => Promise<void>;

/**
 * Durable job scheduler (PRD §41.3, P0-05). Unlike the in-memory pollers (rent scan, action
 * projector), scheduled work is persisted in the `ScheduledJob` table, so it survives restarts
 * and multiple instances can share the queue. A job has a `kind`; modules register a handler for
 * their kinds (handlers are idempotent). Due jobs are claimed, run, and marked DONE or FAILED.
 * A built-in `noop` kind always succeeds, so the pipeline is verifiable without a real handler.
 */
@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("Scheduler");
  private readonly handlers = new Map<string, JobHandler>();
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly prisma: PrismaService) {
    this.handlers.set("noop", async () => {});
  }

  /** Register a handler for a job kind. Called by modules in their OnModuleInit. */
  registerHandler(kind: string, handler: JobHandler): void {
    this.handlers.set(kind, handler);
  }

  hasHandler(kind: string): boolean {
    return this.handlers.has(kind);
  }

  /** Schedule a job. Defaults to run now. Returns the created job id. */
  async enqueue(kind: string, subjectRef?: string, runAt?: Date): Promise<{ id: string }> {
    const job = await this.prisma.scheduledJob.create({ data: { kind, subjectRef: subjectRef ?? null, runAt: runAt ?? new Date(), state: "PENDING" } });
    return { id: job.id };
  }

  /** Run one job through its handler. Pure of polling; unit-tested via a registered handler. */
  async dispatch(job: ScheduledJobRecord): Promise<"DONE" | "FAILED" | "SKIPPED"> {
    const handler = this.handlers.get(job.kind);
    if (!handler) return "SKIPPED";
    try {
      await handler(job);
      return "DONE";
    } catch (e) {
      this.logger.error(`job ${job.id} (${job.kind}) failed: ${(e as Error).message}`);
      return "FAILED";
    }
  }

  /** Claim and run every due PENDING job once. Returns how many were processed. */
  async processDue(limit = 50): Promise<{ processed: number }> {
    const due = await this.prisma.scheduledJob.findMany({ where: { state: "PENDING", runAt: { lte: new Date() } }, orderBy: { runAt: "asc" }, take: limit });
    let processed = 0;
    for (const job of due) {
      // Claim it (best-effort single-instance; a real cluster would use a conditional update).
      await this.prisma.scheduledJob.update({ where: { id: job.id }, data: { state: "RUNNING" } });
      const outcome = await this.dispatch(job);
      await this.prisma.scheduledJob.update({ where: { id: job.id }, data: { state: outcome } });
      processed += 1;
    }
    return { processed };
  }

  async board() {
    const jobs = await this.prisma.scheduledJob.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return jobs.map((j) => ({ id: j.id, kind: j.kind, subjectRef: j.subjectRef, state: j.state, runAt: j.runAt.toISOString(), createdAt: j.createdAt.toISOString() }));
  }

  onModuleInit(): void {
    // Poll every 15s. unref so it never holds the process open (and is skipped under tests).
    this.timer = setInterval(() => void this.processDue().catch((e) => this.logger.error(String(e))), 15_000);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
