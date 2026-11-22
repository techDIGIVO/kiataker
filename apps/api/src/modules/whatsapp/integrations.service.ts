import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { AiService } from "./ai.service.js";
import { env } from "../../common/config/env.js";
import { OutboundService } from "../../common/messaging/outbound.service.js";
import { Conflict } from "../../common/errors/domain-errors.js";

const mask = (v?: string | null) => (v && v.length > 3 ? "••••" + v.slice(-4) : v ? "••••" : null);

/**
 * Integrations and credentials (PRD §44: going live is configuration, not code). Staff
 * enter the keys the platform needs; this service stores them and reports what is in place.
 * Secrets are never returned in full, only a masked hint and a "set" flag.
 */
@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ai: AiService,
    private readonly outbound: OutboundService,
  ) {}

  private async get(key: string): Promise<Record<string, string>> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return (row?.value as Record<string, string>) ?? {};
  }

  private async set(key: string, data: Record<string, string>, actor: string) {
    const current = await this.get(key);
    const next = { ...current, ...data };
    // Drop empty strings so a blank field does not wipe an existing secret.
    for (const k of Object.keys(next)) if (next[k] === "") delete next[k];
    await this.prisma.setting.upsert({
      where: { key },
      update: { value: next as object, author: actor },
      create: { key, value: next as object, author: actor },
    });
    await this.prisma.$transaction((tx) =>
      this.audit.record(tx, { actor, action: "integrations.updated", objectRef: `setting:${key}` }),
    );
  }

  /** A full picture of what is configured and currently in place. */
  async status() {
    const aiCfg = await this.ai.getConfig();
    const aiKey = await this.ai.resolveKey(aiCfg.provider);
    const wa = await this.get("whatsapp.credentials");
    const ps = await this.get("payments.credentials");

    return {
      ai: {
        provider: aiCfg.provider,
        model: aiCfg.model,
        temperature: aiCfg.temperature,
        systemStyle: aiCfg.systemStyle,
        keySet: aiCfg.provider === "fake" ? true : Boolean(aiKey),
        keyHint: mask(aiKey?.key),
        working: aiCfg.provider === "fake" || Boolean(aiKey),
        note:
          aiCfg.provider === "fake"
            ? "Running on the local deterministic engine (no LLM key needed)."
            : aiKey?.source === "env"
              ? "Hosted model; using the API key from the server environment (AI_API_KEY). A key saved here overrides it."
              : "Hosted model; needs an API key.",
      },
      whatsapp: {
        mode: env.WHATSAPP_ADAPTER,
        phoneNumberIdSet: Boolean(wa.phoneNumberId),
        accessTokenSet: Boolean(wa.accessToken),
        accessTokenHint: mask(wa.accessToken),
        verifyTokenSet: Boolean(wa.verifyToken),
        appSecretSet: Boolean(wa.appSecret),
        businessNumber: "+234 906 500 9370",
        working: env.WHATSAPP_ADAPTER === "fake" || (Boolean(wa.phoneNumberId) && Boolean(wa.accessToken)),
        note: env.WHATSAPP_ADAPTER === "fake" ? "Local simulator is live. Enter Meta Cloud API keys to go live on the real number." : "Meta Cloud API.",
      },
      email: {
        mode: env.EMAIL_ADAPTER,
        keySet: Boolean(env.RESEND_API_KEY),
        keyHint: mask(env.RESEND_API_KEY),
        from: env.EMAIL_FROM ?? null,
        working: env.EMAIL_ADAPTER === "resend",
        note:
          env.EMAIL_CONFIG_WARNING ??
          (env.EMAIL_ADAPTER === "resend"
            ? "Sending through Resend. Use Send test email to check delivery."
            : "Off. Set RESEND_API_KEY and EMAIL_FROM on the server to send sign-in codes and tenant links by email."),
      },
      payments: {
        mode: env.PAYMENTS_ADAPTER,
        secretKeySet: Boolean(ps.secretKey),
        secretKeyHint: mask(ps.secretKey),
        publicKeySet: Boolean(ps.publicKey),
        feeBps: await this.feeBps(),
        working: env.PAYMENTS_ADAPTER === "fake" || Boolean(ps.secretKey),
        note: env.PAYMENTS_ADAPTER === "fake" ? "Test mode. Enter Paystack keys to settle live (behind its own gate)." : "Paystack.",
      },
    };
  }

  /** Send a test email so staff can confirm delivery end to end; reports exactly what happened. */
  async sendTestEmail(to: string, actor: string) {
    const address = (to ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) throw new Conflict("Enter a valid email address");
    const delivery = await this.outbound.email(
      address,
      "Kiataker test email",
      "This is a test email from the Kiataker admin. If you can read it, email delivery is working.",
    );
    await this.prisma.$transaction((tx) => this.audit.record(tx, { actor, action: "admin.integrations.email_test", objectRef: "integrations:email", reason: delivery.status }));
    return delivery;
  }

  async saveAiKey(provider: string, apiKey: string, actor: string) {
    await this.set("ai.keys", { [provider]: apiKey }, actor);
    return { saved: true };
  }
  async saveWhatsApp(data: Record<string, string>, actor: string) {
    await this.set("whatsapp.credentials", data, actor);
    return { saved: true };
  }
  async savePayments(data: Record<string, string>, actor: string) {
    await this.set("payments.credentials", data, actor);
    return { saved: true };
  }

  /** Platform coordination fee in basis points (default 5%). Read by PaymentsService too. */
  async feeBps(): Promise<number> {
    const row = await this.prisma.setting.findUnique({ where: { key: "payments.config" } });
    const v = (row?.value as { feeBps?: number } | undefined)?.feeBps;
    return typeof v === "number" && v >= 0 && v <= 2000 ? v : 500;
  }

  async savePaymentsConfig(feeBps: number, actor: string) {
    if (!Number.isFinite(feeBps) || feeBps < 0 || feeBps > 2000) {
      throw new Error("Fee must be between 0% and 20%");
    }
    const value = { feeBps: Math.round(feeBps) };
    await this.prisma.setting.upsert({
      where: { key: "payments.config" },
      update: { value, author: actor },
      create: { key: "payments.config", value, author: actor },
    });
    await this.prisma.$transaction((tx) => this.audit.record(tx, { actor, action: "integrations.updated", objectRef: "setting:payments.config" }));
    return { saved: true, feeBps: value.feeBps };
  }
}
