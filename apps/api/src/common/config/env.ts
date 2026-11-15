import { z } from "zod";

/** Typed environment (§44). Every live value is read here, never written in code. */
const EnvSchema = z.object({
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
  // Rate limiting (§34, Phase 5 hardening). Per-IP fixed window. Defaults are generous for dev;
  // tighten in production (e.g. RATE_LIMIT_MAX=600, RATE_LIMIT_AUTH_MAX=20).
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(5000),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().default(60),
  // Observability (§44, P0-12). When an error tracker DSN is set, unexpected errors are forwarded.
  SENTRY_DSN: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);
export type Env = z.infer<typeof EnvSchema>;
