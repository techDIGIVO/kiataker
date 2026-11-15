import { Controller, Get } from "@nestjs/common";
import { MetricsService } from "./metrics.service.js";
import { ErrorReporter } from "./error-reporter.service.js";
import { Public } from "../auth/public.decorator.js";

/**
 * Read-only metrics for uptime monitoring and dashboards (P0-12). Aggregate counts only, no PII,
 * so it is public like health. On an internal network this is what a scraper or status page hits.
 */
@Controller("metrics")
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly reporter: ErrorReporter,
  ) {}

  @Public()
  @Get()
  snapshot() {
    return { ...this.metrics.snapshot(), errorReporting: { configured: this.reporter.configured, captured: this.reporter.count } };
  }
}
