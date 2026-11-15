import { describe, it, expect } from "vitest";
import { parseDsn, buildSentryEnvelope } from "./sentry.util.js";

describe("parseDsn", () => {
  it("parses a standard DSN into an envelope url", () => {
    const t = parseDsn("https://abc123@o456.ingest.sentry.io/789");
    expect(t).not.toBeNull();
    expect(t?.publicKey).toBe("abc123");
    expect(t?.projectId).toBe("789");
    expect(t?.envelopeUrl).toBe("https://o456.ingest.sentry.io/api/789/envelope/");
  });

  it("returns null for a missing or malformed DSN", () => {
    expect(parseDsn(undefined)).toBeNull();
    expect(parseDsn("")).toBeNull();
    expect(parseDsn("not a url")).toBeNull();
    expect(parseDsn("https://o456.ingest.sentry.io/789")).toBeNull(); // no public key
  });
});

describe("buildSentryEnvelope", () => {
  it("builds a three-line envelope carrying the error event and request id", () => {
    const { eventId, body } = buildSentryEnvelope(
      { requestId: "req-1", name: "TypeError", message: "boom", stack: "at x", method: "GET", path: "/v1/x", environment: "test" },
      () => new Date("2026-01-01T00:00:00.000Z"),
    );
    const parts = body.split("\n");
    expect(parts).toHaveLength(3);
    expect(JSON.parse(parts[0] as string).event_id).toBe(eventId);
    expect(JSON.parse(parts[1] as string).type).toBe("event");
    const ev = JSON.parse(parts[2] as string);
    expect(ev.level).toBe("error");
    expect(ev.tags.request_id).toBe("req-1");
    expect(ev.exception.values[0].type).toBe("TypeError");
    expect(ev.exception.values[0].value).toBe("boom");
  });
});
