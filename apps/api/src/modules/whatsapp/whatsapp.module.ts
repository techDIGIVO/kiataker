import { Module } from "@nestjs/common";
import { WhatsAppController } from "./whatsapp.controller.js";
import { AiAdminController } from "./ai-admin.controller.js";
import { ChannelAdminController } from "./channel.controller.js";
import { ConversationService } from "./conversation.service.js";
import { MetaService } from "./meta.service.js";
import { ChannelService } from "./channel.service.js";
import { AiService } from "./ai.service.js";
import { IntegrationsService } from "./integrations.service.js";
import { PropertyModule } from "../property/property.module.js";
import { TenancyModule } from "../tenancy/tenancy.module.js";
import { ActionModule } from "../action/action.module.js";
import { NoticesModule } from "../notices/notices.module.js";
import { MaintenanceModule } from "../maintenance/maintenance.module.js";
import { PaymentsModule } from "../payments/payments.module.js";
import { DocumentsModule } from "../documents/documents.module.js";
import { ConditionModule } from "../condition/condition.module.js";
import { ScopeModule } from "../scope/scope.module.js";
import { NdpaModule } from "../ndpa/ndpa.module.js";

@Module({
  imports: [PropertyModule, TenancyModule, ActionModule, NoticesModule, MaintenanceModule, PaymentsModule, DocumentsModule, ConditionModule, ScopeModule, NdpaModule],
  controllers: [WhatsAppController, AiAdminController, ChannelAdminController],
  providers: [ConversationService, MetaService, ChannelService, AiService, IntegrationsService],
})
export class WhatsAppModule {}
