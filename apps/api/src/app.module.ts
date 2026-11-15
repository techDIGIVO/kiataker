import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./common/prisma/prisma.module.js";
import { CoreModule } from "./common/core.module.js";
import { ObservabilityModule } from "./common/observability/observability.module.js";
import { SchedulerModule } from "./common/scheduler/scheduler.module.js";
import { JwtAuthGuard } from "./common/auth/jwt-auth.guard.js";
import { HealthModule } from "./modules/health/health.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { TermsModule } from "./modules/terms/terms.module.js";
import { PropertyModule } from "./modules/property/property.module.js";
import { TenancyModule } from "./modules/tenancy/tenancy.module.js";
import { ActionModule } from "./modules/action/action.module.js";
import { SecureTasksModule } from "./modules/tasks/secure-tasks.module.js";
import { AdminModule } from "./modules/admin/admin.module.js";
import { CmsModule } from "./modules/cms/cms.module.js";
import { WhatsAppModule } from "./modules/whatsapp/whatsapp.module.js";
import { RentModule } from "./modules/rent/rent.module.js";
import { NoticesModule } from "./modules/notices/notices.module.js";
import { MaintenanceModule } from "./modules/maintenance/maintenance.module.js";
import { PaymentsModule } from "./modules/payments/payments.module.js";
import { DocumentsModule } from "./modules/documents/documents.module.js";
import { ConditionModule } from "./modules/condition/condition.module.js";
import { IntakeModule } from "./modules/intake/intake.module.js";
import { ScopeModule } from "./modules/scope/scope.module.js";
import { NdpaModule } from "./modules/ndpa/ndpa.module.js";
import { TemplatesModule } from "./modules/templates/templates.module.js";

@Module({
  imports: [
    PrismaModule,
    CoreModule,
    ObservabilityModule,
    SchedulerModule,
    HealthModule,
    AuthModule,
    TermsModule,
    PropertyModule,
    TenancyModule,
    ActionModule,
    SecureTasksModule,
    AdminModule,
    CmsModule,
    WhatsAppModule,
    RentModule,
    NoticesModule,
    MaintenanceModule,
    PaymentsModule,
    DocumentsModule,
    ConditionModule,
    IntakeModule,
    ScopeModule,
    NdpaModule,
    TemplatesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
