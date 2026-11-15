import { randomBytes } from "node:crypto";

/**
 * Minimal, dependency-free Sentry transport (P0-12, Phase 5). The Sentry SDK pulls a large
 * OpenTelemetry tree; for a straight error forward we only need the DSN parse and the envelope
 * format, which are small and stable. Both pure parts are unit-tested. `send()` is fire-and-forget.
 */

export interface SentryTarget {
  publicKey: string;
  host: string;
  projectId: string;
  envelopeUrl: string;
}

export interface SentryEvent {
  requestId: string;
  name: string;
  message: string;
  stack?: string;
  method?: string;
  path?: string;
  environment: string;
  release?: string;
}

/** Parse a Sentry DSN `https://<key>@<host>/<project>` (optionally with a path prefix). */
export function parseDsn(dsn: string | undefined): SentryTarget | null {
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    const publicKey = u.username;
    const projectId = u.pathname.replace(/^\/+/, "").split("/").filter(Boolean).pop() ?? "";
    if (!publicKey || !projectId) return null;
    const pathPrefix = u.pathname.replace(/\/?[^/]*$/, ""); // everything before the project id
    const base = `${u.protocol}//${u.host}${pathPrefix}`.replace(/\/$/, "");
    return { publicKey, host: u.host, projectId, envelopeUrl: `${base}/api/${projectId}/envelope/` };
  } catch {
    return null;
  }
}

/** Build a Sentry envelope (newline-delimited JSON) carrying one error event. */
export function buildSentryEnvelope(event: SentryEvent, now: () => Date = () => new Date()): { eventId: string; body: string } {
  const eventId = randomBytes(16).toString("hex");
  const sentAt = now().toISOString();
  const payload = {
    event_id: eventId,
    timestamp: sentAt,
    platform: "node",
    level: "error",
    environment: event.environment,
    release: event.release,
    tags: { request_id: event.requestId, method: event.method, path: event.path },
    exception: {
      values: [{ type: event.name, value: event.message, stacktrace: event.stack ? { frames: [] } : undefined }],
    },
  };
  const header = JSON.stringify({ event_id: eventId, sent_at: sentAt });
  const itemHeader = JSON.stringify({ type: "event" });
  return { eventId, body: `${header}\n${itemHeader}\n${JSON.stringify(payload)}` };
}

/** Fire-and-forget POST of an error event to Sentry. Errors are swallowed; it never throws. */
export async function sendToSentry(target: SentryTarget, event: SentryEvent): Promise<void> {
  const { body } = buildSentryEnvelope(event);
  try {
    await fetch(target.envelopeUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-sentry-envelope",
        "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${target.publicKey}, sentry_client=kiataker/1.0`,
      },
      body,
    });
  } catch {
    // Observability must never break the request path.
  }
}
