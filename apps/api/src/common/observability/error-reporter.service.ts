import { Injectable, Logger } from "@nestjs/common";
import { env } from "../config/env.js";
import { parseDsn, sendToSentry, type SentryTarget } from "./sentry.util.js";

/**
 * Error reporting seam (P0-12, Phase 5 observability). Unexpected server errors are captured here
 * as a structured event with the request id, so they are searchable in the logs and correlate to
 * the client's x-request-id. When `SENTRY_DSN` is set, the event is also forwarded to Sentry via a
 * small dependency-free transport (fire-and-forget). Nothing here exposes anything to the client.
 */
@Injectable()
export class ErrorReporter {
  private readonly logger = new Logger("ErrorReporter");
  private readonly target: SentryTarget | null = parseDsn(env.SENTRY_DSN);
  private captured = 0;

  /** Whether an external tracker is configured (a valid DSN is set). */
  get configured(): boolean {
    return this.target !== null;
  }

  capture(error: Error, context: { requestId: string; path?: string; method?: string }): void {
    this.captured += 1;
    const event = {
      kind: "error" as const,
      requestId: context.requestId,
      method: context.method,
      path: context.path,
      name: error.name,
      message: error.message,
      at: new Date().toISOString(),
    };
    // Structured, one line, no PII in the shape itself (message is developer-facing, logged only).
    this.logger.error(JSON.stringify(event));
    this.logger.error(error.stack ?? error.message);
    if (this.target) {
      void sendToSentry(this.target, {
        requestId: context.requestId,
        name: error.name,
        message: error.message,
        stack: error.stack,
        method: context.method,
        path: context.path,
        environment: env.NODE_ENV,
      });
    }
  }

  get count(): number {
    return this.captured;
  }
}
