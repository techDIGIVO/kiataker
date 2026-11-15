import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { CryptoService } from "../../common/crypto/crypto.service.js";
import { MetaService } from "./meta.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { NotFound, Conflict } from "../../common/errors/domain-errors.js";
import { env } from "../../common/config/env.js";

export interface QuietHours {
  startHour: number;
  endHour: number;
}
const DEFAULT_QUIET: QuietHours = { startHour: 21, endHour: 8 };

/**
 * WhatsApp channel hardening (PRD §24, go-live). Business-initiated messages must use a
 * Meta-approved template, and proactive sends respect the landlord's quiet hours: a message
 * raised during quiet hours is deferred to the next open window, not dropped. Replies to an
 * inbound message are not proactive and never gated here.
 */
@Injectable()
export class ChannelService {
  private readonly logger = new Logger("ChannelService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly meta: MetaService,
    private readonly audit: AuditService,
  ) {}

  // ---- Support inbox (P2) ----

  /** Conversations, newest activity first, from a single scan of the recent message log (no N+1). */
  async inbox() {
    const recent = await this.prisma.messageLog.findMany({ where: { channel: "whatsapp" }, orderBy: { at: "desc" }, take: 1000 });
    const byAddress = new Map<string, { address: string; lastBody: string; lastDirection: string; lastAt: Date; count: number }>();
    for (const m of recent) {
      const e = byAddress.get(m.address);
      if (!e) byAddress.set(m.address, { address: m.address, lastBody: m.body, lastDirection: m.direction, lastAt: m.at, count: 1 });
      else e.count += 1;
    }
    return [...byAddress.values()].map((e) => ({ address: e.address, lastBody: e.lastBody, lastDirection: e.lastDirection, lastAt: e.lastAt.toISOString(), recentCount: e.count }));
  }

  /** The full message thread for one conversation, oldest first. */
  async thread(address: string) {
    const messages = await this.prisma.messageLog.findMany({ where: { channel: "whatsapp", address }, orderBy: { at: "asc" }, take: 300 });
    return { address, messages: messages.map((m) => ({ direction: m.direction, body: m.body, at: m.at.toISOString() })) };
  }

  /** Staff reply into a conversation: log it and send over the Cloud API (no-op without credentials). */
  async staffReply(staffId: string, address: string, text: string) {
    if (!text?.trim()) throw new Conflict("A reply needs some text");
    await this.prisma.messageLog.create({ data: { channel: "whatsapp", address, direction: "out", body: text.trim() } });
    try {
      await this.meta.sendText(address, text.trim());
    } catch (e) {
      this.logger.warn(`Staff reply send failed (logged anyway): ${(e as Error).message}`);
    }
    await this.prisma.$transaction((tx) => this.audit.record(tx, { actor: staffId, action: "admin.inbox.reply", objectRef: `inbox:${address}`, reason: "staff reply" }));
    return { sent: true };
  }

  // ---- Templates ----

  listTemplates() {
    return this.prisma.whatsAppTemplate.findMany({ orderBy: { createdAt: "desc" } });
  }

  createTemplate(input: { name: string; category?: string; language?: string; body: string }) {
    const name = input.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!name) throw new Conflict("A template name is required");
    if (!input.body?.trim()) throw new Conflict("A template body is required");
    return this.prisma.whatsAppTemplate.create({
      data: { name, category: input.category ?? "UTILITY", language: input.language ?? "en", body: input.body.trim(), status: "DRAFT" },
    });
  }

  /** Submit for Meta approval. In live mode this would call the Graph API; here it is marked SUBMITTED. */
  async submitTemplate(id: string) {
    const t = await this.prisma.whatsAppTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFound("Template not found");
    return this.prisma.whatsAppTemplate.update({ where: { id }, data: { status: "SUBMITTED", rejectionReason: null } });
  }

  /** Record Meta's decision (staff reflect the Business Manager outcome). */
  async setTemplateStatus(id: string, status: "APPROVED" | "REJECTED", rejectionReason?: string) {
    const t = await this.prisma.whatsAppTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFound("Template not found");
    return this.prisma.whatsAppTemplate.update({ where: { id }, data: { status, rejectionReason: status === "REJECTED" ? rejectionReason ?? "Rejected" : null } });
  }

  // ---- Quiet hours ----

  async getQuietHours(): Promise<QuietHours> {
    const row = await this.prisma.setting.findUnique({ where: { key: "whatsapp.quietHours" } });
    const v = row?.value as Partial<QuietHours> | undefined;
    const startHour = typeof v?.startHour === "number" ? v.startHour : DEFAULT_QUIET.startHour;
    const endHour = typeof v?.endHour === "number" ? v.endHour : DEFAULT_QUIET.endHour;
    return { startHour, endHour };
  }

  async setQuietHours(startHour: number, endHour: number, actor: string): Promise<QuietHours> {
    for (const h of [startHour, endHour]) if (!Number.isInteger(h) || h < 0 || h > 23) throw new Conflict("Hours must be whole numbers from 0 to 23");
    const value = { startHour, endHour };
    await this.prisma.setting.upsert({ where: { key: "whatsapp.quietHours" }, update: { value, author: actor }, create: { key: "whatsapp.quietHours", value, author: actor } });
    return value;
  }

  isQuiet(at: Date, q: QuietHours): boolean {
    const h = at.getHours();
    if (q.startHour === q.endHour) return false;
    if (q.startHour < q.endHour) return h >= q.startHour && h < q.endHour;
    return h >= q.startHour || h < q.endHour; // wraps past midnight
  }

  private nextOpen(at: Date, q: QuietHours): Date {
    const open = new Date(at);
    open.setMinutes(0, 0, 0);
    open.setHours(q.endHour);
    if (open <= at) open.setDate(open.getDate() + 1);
    return open;
  }

  // ---- Proactive notifications ----

  /** Queue a proactive notification: skipped if the template is unapproved, deferred in quiet hours. */
  async enqueue(participantId: string, templateName: string, params: string[] = []) {
    const template = await this.prisma.whatsAppTemplate.findUnique({ where: { name: templateName } });
    if (!template || template.status !== "APPROVED") {
      return this.prisma.whatsAppNotification.create({
        data: { participantId, templateName, params, status: "SKIPPED", reason: `template ${templateName} is not approved` },
      });
    }
    const q = await this.getQuietHours();
    const now = new Date();
    if (this.isQuiet(now, q)) {
      return this.prisma.whatsAppNotification.create({
        data: { participantId, templateName, params, status: "DEFERRED", reason: "quiet hours", scheduledFor: this.nextOpen(now, q) },
      });
    }
    const notification = await this.prisma.whatsAppNotification.create({ data: { participantId, templateName, params, status: "QUEUED" } });
    await this.deliver(notification.id, template.body, participantId, params);
    return this.prisma.whatsAppNotification.findUnique({ where: { id: notification.id } });
  }

  /** Send everything that was deferred and is now due (outside quiet hours). */
  async processDue(): Promise<{ sent: number }> {
    const q = await this.getQuietHours();
    const now = new Date();
    if (this.isQuiet(now, q)) return { sent: 0 };
    // Outside quiet hours we flush the whole deferred queue (the gate above already passed).
    const due = await this.prisma.whatsAppNotification.findMany({ where: { status: "DEFERRED" }, take: 200 });
    let sent = 0;
    for (const n of due) {
      const template = await this.prisma.whatsAppTemplate.findUnique({ where: { name: n.templateName } });
      if (!template || template.status !== "APPROVED") {
        await this.prisma.whatsAppNotification.update({ where: { id: n.id }, data: { status: "SKIPPED", reason: "template no longer approved" } });
        continue;
      }
      await this.deliver(n.id, template.body, n.participantId, (n.params as string[]) ?? []);
      sent++;
    }
    return { sent };
  }

  listNotifications() {
    return this.prisma.whatsAppNotification.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  }

  /** Render the template, log the outbound message, and (in live mode) send via the Cloud API. */
  private async deliver(notificationId: string, body: string, participantId: string, params: string[]): Promise<void> {
    const text = body.replace(/\{\{(\d+)\}\}/g, (_m, i) => params[Number(i) - 1] ?? "");
    const address = await this.resolveAddress(participantId);
    if (address) {
      await this.prisma.messageLog.create({ data: { channel: "whatsapp", address, direction: "out", body: text } });
      if (env.WHATSAPP_ADAPTER === "meta") await this.meta.sendText(address, text);
    } else {
      this.logger.warn(`No WhatsApp address for participant ${participantId}; notification not delivered`);
    }
    await this.prisma.whatsAppNotification.update({ where: { id: notificationId }, data: { status: "SENT", sentAt: new Date() } });
  }

  private async resolveAddress(participantId: string): Promise<string | null> {
    const contact = await this.prisma.contactPoint.findFirst({ where: { participantId, channel: "WHATSAPP" }, orderBy: { primary: "desc" } });
    if (!contact) return null;
    try {
      return this.crypto.decrypt(contact.valueEncrypted);
    } catch {
      return null;
    }
  }
}
