import type { Request, Response, NextFunction } from "express";

/**
 * Security response headers (PRD §34, Phase 5 hardening). No external dependency: the API is a
 * JSON service, so a strict default-src 'none' policy is safe, and framing is denied outright.
 * HSTS is only meaningful over TLS, so it is set in production alone.
 */
export function securityHeaders(isProduction: boolean) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
    res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    if (isProduction) {
      res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    }
    next();
  };
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

/**
 * In-memory fixed-window rate limiter (per key). Pure and deterministic, so it is unit-tested on
 * its own. One process holds the window; a multi-instance deployment would move this to Redis,
 * but the contract (hit -> decision) stays the same.
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  hit(key: string): RateLimitDecision {
    const t = this.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= t) {
      const resetAt = t + this.windowMs;
      this.hits.set(key, { count: 1, resetAt });
      return { allowed: true, limit: this.max, remaining: this.max - 1, resetMs: this.windowMs };
    }
    entry.count += 1;
    const remaining = Math.max(0, this.max - entry.count);
    return { allowed: entry.count <= this.max, limit: this.max, remaining, resetMs: Math.max(0, entry.resetAt - t) };
  }

  /** Drop expired entries so the map does not grow without bound. */
  sweep(): void {
    const t = this.now();
    for (const [key, entry] of this.hits) if (entry.resetAt <= t) this.hits.delete(key);
  }
}

/**
 * Rate-limit middleware (per IP, with a tighter bucket for auth). Health checks are exempt so
 * monitoring never trips it. Returns the standard error shape on a 429 and always sets the
 * X-RateLimit-* headers so clients can back off.
 */
export function rateLimit(opts: { max: number; authMax: number; windowMs: number }) {
  const general = new RateLimiter(opts.max, opts.windowMs);
  const auth = new RateLimiter(opts.authMax, opts.windowMs);
  setInterval(() => {
    general.sweep();
    auth.sweep();
  }, opts.windowMs).unref?.();

  return (req: Request, res: Response, next: NextFunction): void => {
    const path = req.path || req.url || "";
    if (path === "/v1/health" || path === "/health" || path === "/v1/metrics") return next();
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const isAuth = path.startsWith("/v1/auth/");
    const limiter = isAuth ? auth : general;
    const decision = limiter.hit(`${isAuth ? "auth" : "all"}:${ip}`);
    res.setHeader("X-RateLimit-Limit", String(decision.limit));
    res.setHeader("X-RateLimit-Remaining", String(decision.remaining));
    if (!decision.allowed) {
      res.setHeader("Retry-After", String(Math.ceil(decision.resetMs / 1000)));
      res.status(429).json({ code: "RATE_LIMITED", message: "Too many requests. Please slow down and try again shortly.", requestId: (req.headers["x-request-id"] as string) ?? "" });
      return;
    }
    next();
  };
}
