import { Body, Controller, Get, Post, Put, UseGuards } from "@nestjs/common";
import { AiService, AI_PROVIDERS, type AiConfig } from "./ai.service.js";
import { IntegrationsService } from "./integrations.service.js";
import { StaffGuard } from "../admin/staff.guard.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";

/** Admin control of the WhatsApp AI agent and the platform's integration keys. Staff only. */
@UseGuards(StaffGuard)
@Controller("internal")
export class AiAdminController {
  constructor(
    private readonly ai: AiService,
    private readonly integrations: IntegrationsService,
  ) {}

  @Get("ai/config")
  async config() {
    return { config: await this.ai.getConfig(), providers: AI_PROVIDERS };
  }

  @Put("ai/config")
  update(@CurrentUser() user: RequestUser, @Body() body: Partial<AiConfig>) {
    return this.ai.setConfig(body, user.sub);
  }

  /** Verify the AI live: classify a sample message and report which path (LLM or fallback) ran. */
  @Post("ai/test")
  test(@Body() body: { message: string }) {
    return this.ai.classifyWithDiagnostics(body?.message ?? "");
  }

  @Get("integrations/status")
  status() {
    return this.integrations.status();
  }

  @Post("integrations/email/test")
  emailTest(@CurrentUser() user: RequestUser, @Body() body: { to: string }) {
    return this.integrations.sendTestEmail(body?.to, user.sub);
  }

  @Put("integrations/ai-key")
  aiKey(@CurrentUser() user: RequestUser, @Body() body: { provider: string; apiKey: string }) {
    return this.integrations.saveAiKey(body.provider, body.apiKey, user.sub);
  }

  @Put("integrations/whatsapp")
  whatsapp(@CurrentUser() user: RequestUser, @Body() body: Record<string, string>) {
    return this.integrations.saveWhatsApp(body, user.sub);
  }

  @Put("integrations/payments")
  payments(@CurrentUser() user: RequestUser, @Body() body: Record<string, string>) {
    return this.integrations.savePayments(body, user.sub);
  }

  @Put("integrations/payments-config")
  paymentsConfig(@CurrentUser() user: RequestUser, @Body() body: { feeBps: number }) {
    return this.integrations.savePaymentsConfig(Number(body.feeBps), user.sub);
  }
}
