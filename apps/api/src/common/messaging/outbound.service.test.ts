import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// env.ts parses process.env at import time, so each case sets the environment and re-imports.
const KEYS = ["WHATSAPP_ADAPTER", "EMAIL_ADAPTER", "RESEND_API_KEY", "EMAIL_FROM"] as const;

function fakePrisma(template?: { name: string; language: string; status: string }) {
  return {
    messageLog: { create: vi.fn().mockResolvedValue({}) },
    setting: { findUnique: vi.fn().mockResolvedValue({ value: { phoneNumberId: "PNID", accessToken: "TOKEN" } }) },
    whatsAppTemplate: { findUnique: vi.fn().mockResolvedValue(template ?? null) },
  };
}

async function load(vars: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, vars);
  vi.resetModules();
  return (await import("./outbound.service.js")).OutboundService;
}

describe("OutboundService", () => {
  let saved: Record<string, string | undefined>;
  const fetchMock = vi.fn();
  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("logs and reports test mode without calling Meta when the adapter is fake", async () => {
    const Outbound = await load({ WHATSAPP_ADAPTER: "fake" });
    const prisma = fakePrisma();
    const out = new Outbound(prisma as never);
    expect(await out.whatsapp("+2348031234567", "hello")).toEqual({ status: "test_mode", channel: "whatsapp" });
    expect(prisma.messageLog.create).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends an approved template, with params, to someone outside the 24-hour window", async () => {
    const Outbound = await load({ WHATSAPP_ADAPTER: "meta" });
    fetchMock.mockResolvedValue({ ok: true });
    const out = new Outbound(fakePrisma({ name: "tenancy_confirm_request", language: "en", status: "APPROVED" }) as never);
    const r = await out.whatsapp("+2348031234567", "rendered text", { name: "tenancy_confirm_request", params: ["Chidi", "1,200,000"] });
    expect(r.status).toBe("sent");
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.to).toBe("2348031234567");
    expect(body.type).toBe("template");
    expect(body.template.name).toBe("tenancy_confirm_request");
    expect(body.template.components[0].parameters).toEqual([{ type: "text", text: "Chidi" }, { type: "text", text: "1,200,000" }]);
  });

  it("falls back to text when the template is not approved, and reports Meta's refusal", async () => {
    const Outbound = await load({ WHATSAPP_ADAPTER: "meta" });
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: { code: 131047, message: "Re-engagement message" } }) });
    const out = new Outbound(fakePrisma({ name: "tenancy_confirm_request", language: "en", status: "DRAFT" }) as never);
    const r = await out.whatsapp("+2348031234567", "rendered text", { name: "tenancy_confirm_request", params: [] });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).type).toBe("text");
    expect(r).toEqual({ status: "failed", channel: "whatsapp", reason: expect.stringContaining("131047") });
  });

  it("sends email through Resend when configured", async () => {
    const Outbound = await load({ RESEND_API_KEY: "re_test", EMAIL_FROM: "Kiataker <no-reply@kiataker.ng>" });
    fetchMock.mockResolvedValue({ ok: true });
    const out = new Outbound(fakePrisma() as never);
    expect(await out.email("a@b.co", "Subject", "Body")).toEqual({ status: "sent", channel: "email" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body)).toEqual({ from: "Kiataker <no-reply@kiataker.ng>", to: ["a@b.co"], subject: "Subject", text: "Body" });
  });

  it("does not send email in fake mode", async () => {
    const Outbound = await load({});
    const out = new Outbound(fakePrisma() as never);
    expect(await out.email("a@b.co", "Subject", "Body")).toEqual({ status: "test_mode", channel: "email" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
