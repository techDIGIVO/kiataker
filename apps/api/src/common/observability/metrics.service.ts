import { Injectable } from "@nestjs/common";

export type StatusClass = "2xx" | "3xx" | "4xx" | "5xx";

/**
 * In-process metrics (PRD §44, P0-12, Phase 5 observability). Aggregate counters only, no PII:
 * request totals by status class, server errors, a small per-route tally, and uptime. One process
 * holds these; a multi-instance deployment scrapes each and sums, or moves this to a metrics
 * backend. Exposed read-only at GET /v1/metrics for uptime and dashboards.
 */
@Injectable()
export class MetricsService {
  private readonly startedAt = Date.now();
  private total = 0;
  private readonly byClass: Record<StatusClass, number> = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
  private serverErrors = 0;
  private slowest = 0;
  private readonly routes = new Map<string, number>();

  private classify(status: number): StatusClass {
    if (status >= 500) return "5xx";
    if (status >= 400) return "4xx";
    if (status >= 300) return "3xx";
    return "2xx";
  }

  /** Record a finished request. `route` is the path with ids stripped, to keep cardinality low. */
  record(status: number, route: string, ms: number): void {
    this.total += 1;
    const cls = this.classify(status);
    this.byClass[cls] += 1;
    if (cls === "5xx") this.serverErrors += 1;
    if (ms > this.slowest) this.slowest = ms;
    const key = this.normaliseRoute(route);
    this.routes.set(key, (this.routes.get(key) ?? 0) + 1);
  }

  /** Collapse ids (uuids, hex tokens, numbers) so the per-route tally stays bounded. */
  private normaliseRoute(route: string): string {
    return (route.split("?")[0] ?? route)
      .split("/")
      .map((seg) => {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(seg)) return ":id";
        if (/^[0-9a-f]{16,}$/i.test(seg)) return ":token";
        if (/^\d+$/.test(seg)) return ":n";
        return seg;
      })
      .join("/");
  }

  snapshot() {
    const topRoutes = [...this.routes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([route, count]) => ({ route, count }));
    return {
      status: "ok" as const,
      startedAt: new Date(this.startedAt).toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      requests: {
        total: this.total,
        byStatusClass: { ...this.byClass },
        serverErrors: this.serverErrors,
        errorRate: this.total === 0 ? 0 : Number((this.serverErrors / this.total).toFixed(4)),
      },
      slowestMs: this.slowest,
      topRoutes,
    };
  }
}
