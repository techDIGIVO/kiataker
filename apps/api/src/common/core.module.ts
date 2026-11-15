import { Global, Module } from "@nestjs/common";
import { CryptoService } from "./crypto/crypto.service.js";
import { OutboxService } from "./outbox/outbox.service.js";
import { AuditService } from "./audit/audit.service.js";
import { ControlsService } from "./controls/controls.service.js";
import { ControlGovernanceService } from "./controls/control-governance.service.js";
import { IdempotencyService } from "./idempotency/idempotency.service.js";
import { TokenService } from "./auth/token.service.js";
import { MetricsService } from "./observability/metrics.service.js";
import { ErrorReporter } from "./observability/error-reporter.service.js";
import { LabelService } from "./read/label.service.js";
import { SchedulerService } from "./scheduler/scheduler.service.js";

/** Shared platform services, available to every module (adapters at the edges, §41.8). */
@Global()
@Module({
  providers: [
    CryptoService,
    OutboxService,
    AuditService,
    ControlsService,
    ControlGovernanceService,
    IdempotencyService,
    TokenService,
    MetricsService,
    ErrorReporter,
    LabelService,
    SchedulerService,
  ],
  exports: [
    CryptoService,
    OutboxService,
    AuditService,
    ControlsService,
    ControlGovernanceService,
    IdempotencyService,
    TokenService,
    MetricsService,
    ErrorReporter,
    LabelService,
    SchedulerService,
  ],
})
export class CoreModule {}
