import { Injectable, Logger } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { ConversationService, type OutMsg } from "./conversation.service.js";
import { env } from "../../common/config/env.js";

interface MetaCredentials {
  phoneNumberId?: string;
  accessToken?: string;
  verifyToken?: string;
  appSecret?: string;
}

interface ParsedInbound {
  from: string;
  text?: string;
  replyId?: string;
}

/**
 * Meta WhatsApp Cloud API adapter (PRD §24, P2-?, go-live). Verifies the webhook subscription
 * and every inbound payload's signature, routes messages into the same ConversationService the
 * local simulator uses, and (in live mode) sends replies back through the Cloud API. The local
 * simulator keeps working unchanged; this is what makes the real WhatsApp number live.
 */
@Injectable()
export class MetaService {
  private readonly logger = new Logger("MetaService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversation: ConversationService,
  ) {}

  private async credentials(): Promise<MetaCredentials> {
    const row = await this.prisma.setting.findUnique({ where: { key: "whatsapp.credentials" } });
    return (row?.value as MetaCredentials) ?? {};
  }

  /** GET subscription handshake: echo the challenge only when the verify token matches. */
  async verifyChallenge(mode: string | undefined, token: string | undefined, challenge: string | undefined): Promise<string | null> {
    const { verifyToken } = await this.credentials();
    if (mode === "subscribe" && token && verifyToken && token === verifyToken) return challenge ?? "";
    return null;
  }

  /** Verify the X-Hub-Signature-256 header: HMAC-SHA256 of the raw body with the app secret. */
  async verifySignature(rawBody: string, header: string | undefined): Promise<boolean> {
    const { appSecret } = await this.credentials();
    if (!appSecret || !header) return false;
    const provided = header.startsWith("sha256=") ? header.slice(7) : header;
    const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /** Extract inbound messages (text and interactive replies) from a Cloud API payload. */
  parseInbound(body: unknown): ParsedInbound[] {
    const out: ParsedInbound[] = [];
    const entries = (body as { entry?: unknown[] })?.entry ?? [];
    for (const entry of entries) {
      const changes = (entry as { changes?: unknown[] })?.changes ?? [];
      for (const change of changes) {
        const messages = (change as { value?: { messages?: unknown[] } })?.value?.messages ?? [];
        for (const m of messages) {
          const msg = m as { from?: string; type?: string; text?: { body?: string }; interactive?: { button_reply?: { id?: string }; list_reply?: { id?: string } } };
          if (!msg.from) continue;
          if (msg.type === "interactive") {
            const replyId = msg.interactive?.button_reply?.id ?? msg.interactive?.list_reply?.id;
            out.push({ from: msg.from, replyId });
          } else {
            out.push({ from: msg.from, text: msg.text?.body });
          }
        }
      }
    }
    return out;
  }

  /** Route a verified webhook: handle each message and, in live mode, send the replies back. */
  async handleWebhook(body: unknown): Promise<{ received: true; handled: number }> {
    const inbound = this.parseInbound(body);
    for (const msg of inbound) {
      const { messages } = await this.conversation.handle(msg.from, { text: msg.text, replyId: msg.replyId });
      if (env.WHATSAPP_ADAPTER === "meta") await this.send(msg.from, messages);
    }
    return { received: true, handled: inbound.length };
  }

  /** Send a single plain-text message through the Cloud API (used by proactive notifications). */
  async sendText(to: string, text: string): Promise<void> {
    await this.send(to, [{ type: "text", text }]);
  }

  /** Send replies through the Cloud API (live mode only). The simulator reads the message log. */
  private async send(to: string, messages: OutMsg[]): Promise<void> {
    const { phoneNumberId, accessToken } = await this.credentials();
    if (!phoneNumberId || !accessToken) {
      this.logger.warn("Meta send skipped: credentials not set");
      return;
    }
    for (const m of messages) {
      const payload = this.toCloudPayload(to, m);
      try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
          method: "POST",
          headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) {
          // Meta returns { error: { code, message } }: an expired token, an unapproved template,
          // or a closed 24-hour window all land here. Log it; never the recipient or the body.
          const detail = (await res.json().catch(() => null)) as { error?: { code?: number; message?: string } } | null;
          this.logger.error(`Meta send rejected: HTTP ${res.status} code=${detail?.error?.code ?? "?"} ${detail?.error?.message ?? ""}`.trim());
        }
      } catch (e) {
        this.logger.error(`Meta send failed: ${(e as Error).message}`);
      }
    }
  }

  /** Map our OutMsg to a Cloud API message (text, interactive buttons, interactive list). */
  private toCloudPayload(to: string, m: OutMsg): Record<string, unknown> {
    const base = { messaging_product: "whatsapp", to };
    if (m.type === "text") return { ...base, type: "text", text: { body: m.text } };
    if (m.type === "buttons") {
      return {
        ...base,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: m.text },
          action: { buttons: m.buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })) },
        },
      };
    }
    return {
      ...base,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: m.text },
        action: { button: m.button.slice(0, 20), sections: [{ rows: m.items.slice(0, 10).map((i) => ({ id: i.id, title: i.title.slice(0, 24), description: i.description?.slice(0, 72) })) }] },
      },
    };
  }
}
