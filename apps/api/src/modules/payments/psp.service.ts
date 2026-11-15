import { Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { env } from "../../common/config/env.js";

/**
 * Payment Service Provider adapter (PRD §24, P0-11). Two modes behind one interface:
 *  - "fake": deterministic local test mode. No network. The hosted checkout is our own
 *     /pay page and completion is driven by a signed webhook or the dev-complete route.
 *  - "paystack": the real Paystack API with a transaction split so the rent settles
 *     directly to the landlord and Kiataker's fee is taken as a split (BP-07, no custody).
 * Keys are read at call time from settings, so the admin can set them with no redeploy.
 */

/** Shared secret the fake PSP signs its webhooks with (mirrored in scripts/smoke.mjs). */
export const FAKE_PSP_SECRET = "kiataker-fake-psp-secret";

export interface CheckoutInput {
  reference: string;
  amountKobo: bigint;
  netKobo: bigint;
  feeKobo: bigint;
  email: string;
  callbackUrl: string;
  subaccountCode?: string;
}
export interface CheckoutResult {
  authorizationUrl: string;
  providerRef: string;
}
export interface PspEvent {
  type: string;
  reference: string;
  providerRef: string;
  amountKobo: bigint;
}

@Injectable()
export class PspService {
  constructor(private readonly prisma: PrismaService) {}

  mode(): "fake" | "paystack" {
    return env.PAYMENTS_ADAPTER;
  }

  private async credentials(): Promise<{ secretKey?: string; publicKey?: string }> {
    const row = await this.prisma.setting.findUnique({ where: { key: "payments.credentials" } });
    return (row?.value as { secretKey?: string; publicKey?: string }) ?? {};
  }

  async initializeCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    if (this.mode() === "fake") {
      return { authorizationUrl: `${env.WEB_BASE_URL}/pay/${input.reference}`, providerRef: `fake_${input.reference}` };
    }
    // Paystack live path.
    const { secretKey } = await this.credentials();
    if (!secretKey) throw new Error("Paystack secret key is not set");
    const body: Record<string, unknown> = {
      email: input.email,
      amount: Number(input.amountKobo), // Paystack amount is in kobo
      reference: input.reference,
      callback_url: input.callbackUrl,
    };
    // A transaction split keeps the net with the landlord and the fee with Kiataker.
    if (input.subaccountCode) {
      body.split = {
        type: "flat",
        bearer_type: "subaccount",
        subaccounts: [{ subaccount: input.subaccountCode, share: Number(input.netKobo) }],
      };
    }
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { authorization: `Bearer ${secretKey}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { status: boolean; message?: string; data?: { authorization_url: string; reference: string } };
    if (!json.status || !json.data) throw new Error(json.message ?? "Paystack could not start the checkout");
    return { authorizationUrl: json.data.authorization_url, providerRef: json.data.reference };
  }

  /** Verify a webhook signature. Paystack uses HMAC-SHA512 of the raw body with the secret key. */
  async verifySignature(rawBody: string, signature: string | undefined): Promise<boolean> {
    if (!signature) return false;
    let secret: string;
    let algo: "sha256" | "sha512";
    if (this.mode() === "fake") {
      secret = FAKE_PSP_SECRET;
      algo = "sha256";
    } else {
      const { secretKey } = await this.credentials();
      if (!secretKey) return false;
      secret = secretKey;
      algo = "sha512";
    }
    const expected = createHmac(algo, secret).update(rawBody).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parseEvent(rawBody: string): PspEvent {
    const json = JSON.parse(rawBody) as { event?: string; data?: { reference?: string; amount?: number } };
    const data = json.data ?? {};
    return {
      type: json.event ?? "unknown",
      reference: data.reference ?? "",
      providerRef: data.reference ?? "",
      amountKobo: BigInt(data.amount ?? 0),
    };
  }
}
