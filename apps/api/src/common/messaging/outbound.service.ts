import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { env } from "../config/env.js";

/**
 * What happened to a message, stated truthfully so callers never claim more than was done:
 * "sent" = the provider accepted it; "test_mode" = the adapter is fake, nothing left the
 * building; "failed" = the provider refused it or could not be reached.
 */
export type DeliveryStatus = "sent" | "test_mode" | "failed";
export interface Delivery {
  status: DeliveryStatus;
  channel: "whatsapp" | "email";
  reason?: string;
}

interface MetaCredentials {
  phoneNumberId?: string;
  accessToken?: string;
}

/**
 * Outbound messages to people (adapters at the edge, §41.8). WhatsApp goes through the Meta
 * Cloud API when WHATSAPP_ADAPTER=meta; email through Resend when EMAIL_ADAPTER=resend. Every
 * WhatsApp message is also written to the message log, which the simulator and inbox read.
 */
@Injectable()
export class OutboundService {
  private readonly logger = new Logger("Outbound");

  constructor(private readonly prisma: PrismaService) {}

  /** POST one message payload to the WhatsApp Cloud API. Never logs the recipient or the body. */
  async postToCloud(payload: Record<string, unknown>): Promise<{ ok: true } | { ok: false; reason: string }> {
    const row = await this.prisma.setting.findUnique({ where: { key: "whatsapp.credentials" } });
    const { phoneNumberId, accessToken } = (row?.value as MetaCredentials) ?? {};
    if (!phoneNumberId || !accessToken) {
      this.logger.warn("Meta send skipped: credentials not set");
      return { ok: false, reason: "WhatsApp credentials are not set" };
    }
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return { ok: true };
      // Meta returns { error: { code, message } }: an expired token, an unapproved template, or a
      // closed 24-hour window all land here.
      const detail = (await res.json().catch(() => null)) as { error?: { code?: number; message?: string } } | null;
      const reason = `HTTP ${res.status} code=${detail?.error?.code ?? "?"} ${detail?.error?.message ?? ""}`.trim();
      this.logger.error(`Meta send rejected: ${reason}`);
      return { ok: false, reason };
    } catch (e) {
      this.logger.error(`Meta send failed: ${(e as Error).message}`);
      return { ok: false, reason: (e as Error).message };
    }
  }

  /**
   * Send a WhatsApp message to someone who may not have written to us recently (a tenant, a
   * proactive notification). Meta delivers free text only within 24 hours of the person's last
   * message, so when `template` names a template marked APPROVED in the WhatsApp channel admin,
   * it goes out as that template with `params` filling {{1}}, {{2}}, ...; otherwise as text.
   */
  async whatsapp(to: string, text: string, template?: { name: string; params: string[] }): Promise<Delivery> {
    await this.prisma.messageLog.create({ data: { channel: "whatsapp", address: to, direction: "out", body: text } });
    if (env.WHATSAPP_ADAPTER !== "meta") return { status: "test_mode", channel: "whatsapp" };

    const tpl = template ? await this.prisma.whatsAppTemplate.findUnique({ where: { name: template.name } }) : null;
    const base = { messaging_product: "whatsapp", to: to.replace(/^\+/, "") };
    const payload =
      template && tpl?.status === "APPROVED"
        ? {
            ...base,
            type: "template",
            template: {
              name: tpl.name,
              language: { code: tpl.language },
              components: template.params.length
                ? [{ type: "body", parameters: template.params.map((value) => ({ type: "text", text: value })) }]
                : [],
            },
          }
        : { ...base, type: "text", text: { body: text } };
    const result = await this.postToCloud(payload);
    return result.ok ? { status: "sent", channel: "whatsapp" } : { status: "failed", channel: "whatsapp", reason: result.reason };
  }

  /** Send a plain-text email. In fake mode only the fact of sending is logged, never the body. */
  async email(to: string, subject: string, text: string): Promise<Delivery> {
    if (env.EMAIL_ADAPTER !== "resend") {
      this.logger.log(`Email not sent (EMAIL_ADAPTER=fake): "${subject}"`);
      return { status: "test_mode", channel: "email" };
    }
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return { status: "sent", channel: "email" };
      const detail = (await res.json().catch(() => null)) as { name?: string; message?: string } | null;
      const reason = `HTTP ${res.status} ${detail?.name ?? ""} ${detail?.message ?? ""}`.replace(/\s+/g, " ").trim();
      this.logger.error(`Email send rejected: ${reason}`);
      return { status: "failed", channel: "email", reason };
    } catch (e) {
      this.logger.error(`Email send failed: ${(e as Error).message}`);
      return { status: "failed", channel: "email", reason: (e as Error).message };
    }
  }
}
