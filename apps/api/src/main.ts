import "reflect-metadata";
// Money is BigInt kobo (§28). Serialise it as a string in JSON responses.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (this: bigint) {
  return this.toString();
};
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { AllExceptionsFilter } from "./common/errors/all-exceptions.filter.js";
import { env } from "./common/config/env.js";
import { securityHeaders, rateLimit } from "./common/security/security.middleware.js";
import { observability } from "./common/observability/observability.middleware.js";
import { MetricsService } from "./common/observability/metrics.service.js";
import { ErrorReporter } from "./common/observability/error-reporter.service.js";
import { UPLOADS_DIR } from "./modules/cms/uploads.service.js";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["log", "warn", "error"],
    rawBody: true, // needed to verify PSP webhook signatures over the exact bytes received
  });
  const isProduction = env.NODE_ENV === "production";
  // Do not advertise the server stack (§34).
  app.getHttpAdapter().getInstance().disable("x-powered-by");
  // Behind a load balancer req.ip is the proxy unless Express trusts it; rate limits are per IP.
  app.set("trust proxy", env.TRUST_PROXY);
  if (isProduction && env.DEV_TOOLS) {
    Logger.warn("DEV_TOOLS is on in production: simulator and test-payment routes are public. Never use this for a public deployment.", "Bootstrap");
  }
  if (env.EMAIL_CONFIG_WARNING) Logger.warn(env.EMAIL_CONFIG_WARNING, "Bootstrap");
  Logger.log(`Email: ${env.EMAIL_ADAPTER === "resend" ? `sending through Resend as ${env.EMAIL_FROM}` : "off (test mode)"}`, "Bootstrap");
  // Security headers, then observability (request id + metrics), then rate limiting (Phase 5).
  const metrics = app.get(MetricsService);
  app.use(securityHeaders(isProduction));
  app.use(observability(metrics, isProduction));
  app.use(rateLimit({ max: env.RATE_LIMIT_MAX, authMax: env.RATE_LIMIT_AUTH_MAX, windowMs: env.RATE_LIMIT_WINDOW_MS }));
  app.setGlobalPrefix("v1");
  // Base64 image uploads for the CMS can be several MB.
  app.useBodyParser("json", { limit: "12mb" });
  // Serve uploaded CMS media at /uploads/<file>.
  app.useStaticAssets(UPLOADS_DIR, { prefix: "/uploads/" });
  app.useGlobalFilters(new AllExceptionsFilter(app.get(ErrorReporter)));
  app.enableCors({ origin: [env.WEB_BASE_URL], credentials: true });
  await app.listen(env.API_PORT);
  Logger.log(`Kiataker API on http://localhost:${env.API_PORT}/v1 (health: /v1/health)`, "Bootstrap");
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal bootstrap error", err);
  process.exit(1);
});
