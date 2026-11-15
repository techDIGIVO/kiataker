import { Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import type { MetricsService } from "./metrics.service.js";

const logger = new Logger("Request");

/**
 * Observability middleware (P0-12, Phase 5). Gives every request a stable id (reused from an
 * inbound x-request-id, or minted), echoes it on the response for client/support correlation,
 * and on finish records one structured log line and the request in the metrics. Runs before the
 * rate limiter so even a 429 is counted and carries its id. JSON log lines in production.
 */
export function observability(metrics: MetricsService, isProduction: boolean) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();
    req.headers["x-request-id"] = requestId; // so the exception filter reuses the same id
    res.setHeader("x-request-id", requestId);
    const start = Date.now();

    res.on("finish", () => {
      const ms = Date.now() - start;
      const path = req.path || req.url || "";
      const status = res.statusCode;
      metrics.record(status, path, ms);
      const line = { requestId, method: req.method, path, status, ms };
      const text = isProduction ? JSON.stringify(line) : `${req.method} ${path} ${status} ${ms}ms ${requestId}`;
      if (status >= 500) logger.error(text);
      else if (status >= 400) logger.warn(text);
      else logger.log(text);
    });

    next();
  };
}
