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
import { OutboundService } from "../../common/messaging/outbound.service.js";

/** Wrong guesses allowed per one-time code before it is burned. */
const MAX_CODE_ATTEMPTS = 5;
/** One-time codes that can be issued to one contact within an hour. */
const MAX_CODES_PER_HOUR = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly tokens: TokenService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly outbound: OutboundService,
  ) {}

  /**
   * Echo the one-time code in the response only for the local simulator. Doing so on a public
   * deployment would let anyone sign in as any phone number or email.
   */
  private exposeDevCode(channel: string) {
    const fake = channel === "EMAIL" ? env.EMAIL_ADAPTER === "fake" : env.WHATSAPP_ADAPTER === "fake";
    return fake && env.DEV_TOOLS;
  }

  /**
   * Deliver a one-time code. Email goes through the email adapter (Resend in production).
   * WhatsApp codes need a Meta AUTHENTICATION template, which is not set up yet, so they are
   * delivered only by the local simulator for now.
   */
  private async deliverCode(channel: string, target: string, code: string): Promise<void> {
    if (channel !== "EMAIL") return;
    const delivery = await this.outbound.email(
      target,
      `Your Kiataker code is ${code}`,
      `Your Kiataker sign-in code is ${code}.\n\nIt expires in 10 minutes. If you didn't ask for it, you can ignore this email.`,
    );
    if (delivery.status === "failed") {
      throw new DomainError(
        ErrorCode.CONTACT_VERIFICATION_REQUIRED,
        "We couldn't send the code just now. Please request a new one in a minute.",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
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

    await this.deliverCode(input.channel, target, code);
    // Fake adapter: the local WhatsApp/email simulator delivers the code (§44.1).
    return { participantId, ...(this.exposeDevCode(input.channel) ? { devCode: code } : {}) };
  }

  async sendCode(body: unknown): Promise<{ sent: true; devCode?: string }> {
    const input = validate(SendCodeSchema, body);
    const valueHash = this.crypto.valueHash(input.target);
    // Cap codes per contact per hour: with MAX_CODE_ATTEMPTS guesses each, this bounds how many
    // guesses anyone gets at one contact's code, regardless of how many IPs they use.
    const recent = await this.prisma.contactVerificationCode.count({
      where: { targetHash: valueHash, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (recent >= MAX_CODES_PER_HOUR) {
      throw new DomainError(
        ErrorCode.CONTACT_VERIFICATION_REQUIRED,
        "Too many codes requested. Please wait an hour and try again.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const code = this.crypto.randomCode();
    await this.prisma.$transaction([
      // Only the newest code is valid.
      this.prisma.contactVerificationCode.updateMany({
        where: { targetHash: valueHash, consumedAt: null, supersededAt: null },
        data: { supersededAt: new Date() },
      }),
      this.prisma.contactVerificationCode.create({
        data: {
          targetHash: valueHash,
          codeHash: this.crypto.valueHash(code),
          channel: input.channel,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      }),
    ]);
    await this.deliverCode(input.channel, input.target, code);
    return { sent: true, ...(this.exposeDevCode(input.channel) ? { devCode: code } : {}) };
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
    if (code.attempts >= MAX_CODE_ATTEMPTS) {
      throw new DomainError(
        ErrorCode.CONTACT_VERIFICATION_REQUIRED,
        "Too many wrong attempts. Request a new code.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (code.codeHash !== this.crypto.valueHash(input.code)) {
      const attempts = code.attempts + 1;
      await this.prisma.contactVerificationCode.update({
        where: { id: code.id },
        // Burn the code on the last allowed wrong guess.
        data: { attempts, ...(attempts >= MAX_CODE_ATTEMPTS ? { supersededAt: new Date() } : {}) },
      });
      throw new DomainError(
        ErrorCode.CONTACT_VERIFICATION_REQUIRED,
        attempts >= MAX_CODE_ATTEMPTS ? "Too many wrong attempts. Request a new code." : "That code is not correct",
        attempts >= MAX_CODE_ATTEMPTS ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.BAD_REQUEST,
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
