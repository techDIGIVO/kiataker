import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Req } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { ConversationService } from "./conversation.service.js";
import { MetaService } from "./meta.service.js";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { Public } from "../../common/auth/public.decorator.js";

/**
 * WhatsApp surface. /whatsapp/inbound is the local simulator entry (the browser chat window
 * that behaves like the Meta Cloud API, PRD §44.1). The production webhook with signature
 * verification is added when the Meta adapter is switched on.
 */
@Public()
@Controller("whatsapp")
export class WhatsAppController {
  constructor(
    private readonly conversation: ConversationService,
    private readonly meta: MetaService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("inbound")
  inbound(@Body() body: { from: string; text?: string; replyId?: string }) {
    return this.conversation.handle(body.from, { text: body.text, replyId: body.replyId });
  }

  /** Meta Cloud API subscription handshake. Echoes the challenge when the verify token matches. */
  @Get("webhook")
  async verifyWebhook(@Query() q: Record<string, string>): Promise<string> {
    const challenge = await this.meta.verifyChallenge(q["hub.mode"], q["hub.verify_token"], q["hub.challenge"]);
    if (challenge === null) throw new ForbiddenException("Verification failed");
    return challenge;
  }

  /** Meta Cloud API inbound webhook. Rejects an unsigned or wrong-signature body, then routes. */
  @Post("webhook")
  async metaWebhook(@Req() req: RawBodyRequest<Request>, @Body() body: unknown) {
    const raw = req.rawBody?.toString("utf8") ?? JSON.stringify(body ?? {});
    const sig = req.headers["x-hub-signature-256"] as string | undefined;
    if (!(await this.meta.verifySignature(raw, sig))) throw new ForbiddenException("Invalid signature");
    return this.meta.handleWebhook(body);
  }

  @Get("thread/:address")
  async thread(@Param("address") address: string) {
    const msgs = await this.prisma.messageLog.findMany({
      where: { channel: "whatsapp", address },
      orderBy: { at: "asc" },
      take: 100,
    });
    return msgs.map((m) => ({ direction: m.direction, body: m.body, at: m.at.toISOString() }));
  }
}
