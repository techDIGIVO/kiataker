import { Injectable } from "@nestjs/common";
import {
  SignupSchema,
  SendCodeSchema,
  VerifyCodeSchema,
  LoginSchema,
  AcceptTermsSchema,
  type TokenPair,
  type Me,
} from "@kiataker/contracts";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { CryptoService } from "../../common/crypto/crypto.service.js";
import { TokenService } from "../../common/auth/token.service.js";
import { OutboxService } from "../../common/outbox/outbox.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { validate } from "../../common/validation/validate.js";
import {
  Conflict,
  NotFound,
  Unauthenticated,
  DomainError,
} from "../../common/errors/domain-errors.js";
import { ErrorCode } from "@kiataker/contracts";
import { env } from "../../common/config/env.js";
import { HttpStatus } from "@nestjs/common";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly tokens: TokenService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  private isFake() {
    return env.WHATSAPP_ADAPTER === "fake";
  }

  /** ACC: say hello, create an account, verify contact details (GJ-01). */
  async signup(body: unknown): Promise<{ participantId: string; devCode?: string }> {
    const input = validate(SignupSchema, body);
    const target = input.channel === "EMAIL" ? input.email : input.phone;
    if (!target) throw new Conflict("A phone or email is required for the chosen channel");
    const valueHash = this.crypto.valueHash(target);

    const existing = await this.prisma.contactPoint.findUnique({
      where: { channel_valueHash: { channel: input.channel, valueHash } },
    });
    if (existing) throw new Conflict("This contact is already registered");

    const code = this.crypto.randomCode();
    const participantId = await this.prisma.$transaction(async (tx) => {
      const participant = await tx.participant.create({
        data: { displayName: input.displayName, kind: "LANDLORD", status: "ACTIVE" },
      });
      await tx.contactPoint.create({
        data: {
          participantId: participant.id,
          channel: input.channel,
          valueHash,
          valueEncrypted: this.crypto.encrypt(target),
          primary: true,
        },
      });
      await tx.contactVerificationCode.create({
        data: {
          targetHash: valueHash,
          codeHash: this.crypto.valueHash(code),
          channel: input.channel,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });
      await this.outbox.emit(tx, "participant.signed_up", participant.id, { channel: input.channel });
      await this.audit.record(tx, {
        actor: participant.id,
        action: "participant.signup",
        objectRef: `participant:${participant.id}`,
      });
      return participant.id;
    });

    // Fake adapter: the local WhatsApp/email simulator delivers the code (§44.1).
    return { participantId, ...(this.isFake() ? { devCode: code } : {}) };
  }

  async sendCode(body: unknown): Promise<{ sent: true; devCode?: string }> {
    const input = validate(SendCodeSchema, body);
    const valueHash = this.crypto.valueHash(input.target);
    const code = this.crypto.randomCode();
    await this.prisma.contactVerificationCode.create({
      data: {
        targetHash: valueHash,
        codeHash: this.crypto.valueHash(code),
        channel: input.channel,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    return { sent: true, ...(this.isFake() ? { devCode: code } : {}) };
  }

  async verifyCode(body: unknown): Promise<TokenPair> {
    const input = validate(VerifyCodeSchema, body);
    const valueHash = this.crypto.valueHash(input.target);
    const code = await this.prisma.contactVerificationCode.findFirst({
      where: { targetHash: valueHash, consumedAt: null, supersededAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!code || code.expiresAt < new Date()) {
      throw new DomainError(
        ErrorCode.CONTACT_VERIFICATION_REQUIRED,
        "No valid code. Request a new one.",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (code.codeHash !== this.crypto.valueHash(input.code)) {
      await this.prisma.contactVerificationCode.update({
        where: { id: code.id },
        data: { attempts: { increment: 1 } },
      });
      throw new DomainError(
        ErrorCode.CONTACT_VERIFICATION_REQUIRED,
        "That code is not correct",
        HttpStatus.BAD_REQUEST,
      );
    }

    const contact = await this.prisma.contactPoint.findUnique({
      where: { channel_valueHash: { channel: input.channel, valueHash } },
      include: { participant: true },
    });
    if (!contact) throw new NotFound("No account for this contact");

    const participant = await this.prisma.$transaction(async (tx) => {
      await tx.contactVerificationCode.update({
        where: { id: code.id },
        data: { consumedAt: new Date() },
      });
      await tx.contactPoint.update({ where: { id: contact.id }, data: { verifiedAt: new Date() } });
      const p = await tx.participant.update({
        where: { id: contact.participantId },
        data: input.channel === "EMAIL" ? { emailVerified: true } : { phoneVerified: true },
      });
      await this.outbox.emit(tx, "contact.verified", p.id, { channel: input.channel });
      return p;
    });

    return this.issueTokens(participant.id, participant.kind);
  }

  async login(body: unknown): Promise<TokenPair> {
    const input = validate(LoginSchema, body);
    const valueHash = this.crypto.valueHash(input.email);
    const contact = await this.prisma.contactPoint.findUnique({
      where: { channel_valueHash: { channel: "EMAIL", valueHash } },
      include: { participant: true },
    });
    if (!contact?.participant.passwordHash) throw new Unauthenticated("Email or password is wrong");
    if (!this.crypto.verifyPassword(input.password, contact.participant.passwordHash)) {
      throw new Unauthenticated("Email or password is wrong");
    }
    if (contact.participant.status !== "ACTIVE") throw new Unauthenticated("This account is not active");
    return this.issueTokens(contact.participant.id, contact.participant.kind);
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    let sub: string;
    try {
      sub = this.tokens.verifyRefresh(refreshToken).sub;
    } catch {
      throw new Unauthenticated("Session expired");
    }
    const participant = await this.prisma.participant.findUnique({ where: { id: sub } });
    if (!participant) throw new Unauthenticated();
    return {
      accessToken: this.tokens.signAccess({ sub: participant.id, kind: participant.kind }),
      expiresIn: env.ACCESS_TOKEN_TTL,
    };
  }

  async me(participantId: string): Promise<Me> {
    const p = await this.prisma.participant.findUnique({
      where: { id: participantId },
      include: {
        seatAssignments: { include: { seat: { include: { commandCentre: true } } } },
      },
    });
    if (!p) throw new NotFound("Account not found");
    return {
      id: p.id,
      displayName: p.displayName,
      kind: p.kind,
      emailVerified: p.emailVerified,
      phoneVerified: p.phoneVerified,
      seats: p.seatAssignments.map((a) => ({
        centre: a.seat.commandCentre.key,
        role: a.seat.role,
      })),
    };
  }

  /** Combined acceptance of Terms, Mandate and privacy notice in one step (ACC-02). */
  async acceptTerms(participantId: string, body: unknown): Promise<{ accepted: true }> {
    const input = validate(AcceptTermsSchema, body);
    await this.prisma.$transaction(async (tx) => {
      const acceptance = await tx.termsAcceptance.create({
        data: { participantId, channel: input.channel },
      });
      for (const termsVersionId of input.termsVersionIds) {
        await tx.termsAcceptanceVersion.create({
          data: { acceptanceId: acceptance.id, termsVersionId },
        });
      }
      await this.outbox.emit(tx, "terms.accepted", participantId, {
        count: input.termsVersionIds.length,
      });
      await this.audit.record(tx, {
        actor: participantId,
        action: "terms.accept",
        objectRef: `participant:${participantId}`,
        after: { termsVersionIds: input.termsVersionIds },
      });
    });
    return { accepted: true };
  }

  private async issueTokens(participantId: string, kind: Me["kind"]): Promise<TokenPair> {
    const accessToken = this.tokens.signAccess({ sub: participantId, kind });
    const refreshToken = this.tokens.signRefresh(participantId);
    await this.prisma.session.create({
      data: {
        participantId,
        refreshTokenHash: this.crypto.valueHash(refreshToken),
        expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL * 1000),
      },
    });
    return { accessToken, refreshToken, expiresIn: env.ACCESS_TOKEN_TTL };
  }
}
