import { z } from "zod";

const DEV_SECRET_PREFIX = "dev-";
const boolString = z.enum(["true", "false", "1", "0"]).transform((v) => v === "true" || v === "1");

/** Typed environment (§44). Every live value is read here, never written in code. */
const EnvSchema = z
  .object({
    NODE_ENV: z.string().default("development"),
    API_PORT: z.coerce.number().default(4000),
    API_BASE_URL: z.string().default("http://localhost:4000"),
    WEB_BASE_URL: z.string().default("http://localhost:3000"),
    DATABASE_URL: z.string(),
    JWT_ACCESS_SECRET: z.string().default("dev-access-secret-change-me"),
    JWT_REFRESH_SECRET: z.string().default("dev-refresh-secret-change-me"),
    ACCESS_TOKEN_TTL: z.coerce.number().default(900),
    REFRESH_TOKEN_TTL: z.coerce.number().default(2592000),
    WHATSAPP_ADAPTER: z.enum(["fake", "meta"]).default("fake"),
    PAYMENTS_ADAPTER: z.enum(["fake", "paystack"]).default("fake"),
    AI_ADAPTER: z.enum(["fake", "hosted"]).default("fake"),
    // Optional AI key from the environment, used when no key has been saved in /admin/ai (a key
    // saved there wins). AI_PROVIDER is inferred from the key's prefix when unset. AI_MODEL
    // defaults to the provider's recommended model.
    AI_API_KEY: z.string().optional(),
    AI_PROVIDER: z.enum(["anthropic", "openai", "google"]).optional(),
    AI_MODEL: z.string().optional(),
    // Dev-only surfaces: the WhatsApp simulator endpoints, one-time codes echoed in responses,
    // and the "mark paid" test completion. Unset = on outside production, off in production.
    // They let a caller act as any phone number, so never turn them on for a public deployment.
    DEV_TOOLS: boolString.optional(),
    // Express "trust proxy" (so req.ip is the client, not the load balancer, for rate limiting).
    // Unset = 1 hop in production (Render/Railway/Fly/ALB), off elsewhere. Accepts a hop count,
    // true/false, or an Express preset such as "loopback".
    TRUST_PROXY: z.string().optional(),
    // Rate limiting (§34, Phase 5 hardening). Per-IP fixed window. Defaults are generous for dev;
    // tighten in production (e.g. RATE_LIMIT_MAX=600, RATE_LIMIT_AUTH_MAX=20).
    RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().default(5000),
    RATE_LIMIT_AUTH_MAX: z.coerce.number().default(60),
    // Observability (§44, P0-12). When an error tracker DSN is set, unexpected errors are forwarded.
    SENTRY_DSN: z.string().optional(),
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV !== "production") return;
    // Production must never run on the published dev secrets: anyone could forge a staff token.
    for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const) {
      const value = e[key];
      if (value.startsWith(DEV_SECRET_PREFIX) || value.length < 32) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: "must be set to a random value of at least 32 characters in production" });
      }
    }
    if (e.JWT_ACCESS_SECRET === e.JWT_REFRESH_SECRET) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["JWT_REFRESH_SECRET"], message: "must differ from JWT_ACCESS_SECRET" });
    }
  });

/** Parse an Express "trust proxy" value from its env string. */
function trustProxyValue(raw: string | undefined, isProduction: boolean): boolean | number | string {
  if (raw === undefined || raw === "") return isProduction ? 1 : false;
  if (/^\d+$/.test(raw)) return Number(raw);
  if (raw === "true" || raw === "false") return raw === "true";
  return raw;
}

/** Which LLM provider an API key belongs to, from its well-known prefix. */
export function inferAiProvider(key: string): "anthropic" | "openai" | "google" | undefined {
  if (key.startsWith("AIza")) return "google";
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("sk-")) return "openai";
  return undefined;
}

function loadEnv() {
  // An empty value (e.g. "DEV_TOOLS=" copied from .env.example) means "unset", not "".
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v.trim() !== ""));
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join(".") || "(env)"}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join("\n")}`);
  }
  const parsed = result.data;
  const isProduction = parsed.NODE_ENV === "production";
  const aiApiKey = parsed.AI_API_KEY?.trim() || undefined;
  const aiProvider = parsed.AI_PROVIDER ?? (aiApiKey ? inferAiProvider(aiApiKey) : undefined);
  if (aiApiKey && !aiProvider) {
    throw new Error("Invalid environment configuration:\n  - AI_PROVIDER: set it to anthropic, openai or google (could not tell from AI_API_KEY)");
  }
  return {
    ...parsed,
    AI_API_KEY: aiApiKey,
    AI_PROVIDER: aiProvider,
    DEV_TOOLS: parsed.DEV_TOOLS ?? !isProduction,
    TRUST_PROXY: trustProxyValue(parsed.TRUST_PROXY, isProduction),
  };
}

export const env = loadEnv();
export type Env = typeof env;
