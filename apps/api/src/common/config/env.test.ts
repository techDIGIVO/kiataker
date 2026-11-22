import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// env.ts parses process.env at import time, so each case sets the environment and re-imports.
const STRONG_A = "a".repeat(40);
const STRONG_B = "b".repeat(40);
const KEYS = ["NODE_ENV", "DATABASE_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "DEV_TOOLS", "TRUST_PROXY", "AI_API_KEY", "AI_PROVIDER", "AI_MODEL", "EMAIL_ADAPTER", "RESEND_API_KEY", "EMAIL_FROM"] as const;

async function load(vars: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, { DATABASE_URL: "postgresql://x@localhost/x" }, vars);
  vi.resetModules();
  return (await import("./env.js")).env;
}

describe("env", () => {
  let saved: Record<string, string | undefined>;
  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    vi.resetModules();
  });

  it("refuses to start in production on the default dev JWT secrets", async () => {
    await expect(load({ NODE_ENV: "production" })).rejects.toThrow(/JWT_ACCESS_SECRET/);
  });

  it("refuses short or identical JWT secrets in production", async () => {
    await expect(load({ NODE_ENV: "production", JWT_ACCESS_SECRET: "short", JWT_REFRESH_SECRET: STRONG_B })).rejects.toThrow(/JWT_ACCESS_SECRET/);
    await expect(load({ NODE_ENV: "production", JWT_ACCESS_SECRET: STRONG_A, JWT_REFRESH_SECRET: STRONG_A })).rejects.toThrow(/must differ/);
  });

  it("accepts strong secrets in production and turns dev tools off, trusts one proxy hop", async () => {
    const env = await load({ NODE_ENV: "production", JWT_ACCESS_SECRET: STRONG_A, JWT_REFRESH_SECRET: STRONG_B });
    expect(env.DEV_TOOLS).toBe(false);
    expect(env.TRUST_PROXY).toBe(1);
  });

  it("keeps dev tools on and the proxy untrusted in development", async () => {
    const env = await load({ NODE_ENV: "development" });
    expect(env.DEV_TOOLS).toBe(true);
    expect(env.TRUST_PROXY).toBe(false);
  });

  it("infers the AI provider from the key prefix", async () => {
    expect((await load({ AI_API_KEY: "AIzaTEST" })).AI_PROVIDER).toBe("google");
    expect((await load({ AI_API_KEY: "sk-ant-TEST" })).AI_PROVIDER).toBe("anthropic");
    expect((await load({ AI_API_KEY: "sk-TEST" })).AI_PROVIDER).toBe("openai");
    expect((await load({})).AI_PROVIDER).toBeUndefined();
  });

  it("prefers an explicit AI_PROVIDER and rejects a key it cannot attribute", async () => {
    expect((await load({ AI_API_KEY: "custom-key", AI_PROVIDER: "google" })).AI_PROVIDER).toBe("google");
    await expect(load({ AI_API_KEY: "custom-key" })).rejects.toThrow(/AI_PROVIDER/);
  });

  it("treats empty values as unset", async () => {
    const env = await load({ NODE_ENV: "development", DEV_TOOLS: "", AI_PROVIDER: "", AI_API_KEY: "", TRUST_PROXY: "" });
    expect(env.DEV_TOOLS).toBe(true);
    expect(env.AI_PROVIDER).toBeUndefined();
    expect(env.TRUST_PROXY).toBe(false);
  });

  it("picks the email adapter from RESEND_API_KEY and needs a sender", async () => {
    expect((await load({})).EMAIL_ADAPTER).toBe("fake");
    expect((await load({ RESEND_API_KEY: "re_x", EMAIL_FROM: "Kiataker <no-reply@kiataker.ng>" })).EMAIL_ADAPTER).toBe("resend");
    // A half-finished setup keeps email off with a warning instead of stopping the API.
    const noFrom = await load({ RESEND_API_KEY: "re_x" });
    expect(noFrom.EMAIL_ADAPTER).toBe("fake");
    expect(noFrom.EMAIL_CONFIG_WARNING).toMatch(/EMAIL_FROM/);
    const noKey = await load({ EMAIL_ADAPTER: "resend", EMAIL_FROM: "x@y.z" });
    expect(noKey.EMAIL_ADAPTER).toBe("fake");
    expect(noKey.EMAIL_CONFIG_WARNING).toMatch(/RESEND_API_KEY/);
  });

  it("honours explicit DEV_TOOLS and TRUST_PROXY values", async () => {
    const env = await load({ NODE_ENV: "development", DEV_TOOLS: "false", TRUST_PROXY: "loopback" });
    expect(env.DEV_TOOLS).toBe(false);
    expect(env.TRUST_PROXY).toBe("loopback");
  });
});
