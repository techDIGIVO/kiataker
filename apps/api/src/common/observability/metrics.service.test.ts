import { describe, it, expect } from "vitest";
import { MetricsService } from "./metrics.service.js";

describe("MetricsService", () => {
  it("counts requests by status class and tracks server errors", () => {
    const m = new MetricsService();
    m.record(200, "/v1/health", 3);
    m.record(201, "/v1/properties", 10);
    m.record(404, "/v1/nope", 1);
    m.record(500, "/v1/boom", 40);
    const snap = m.snapshot();
    expect(snap.requests.total).toBe(4);
    expect(snap.requests.byStatusClass["2xx"]).toBe(2);
    expect(snap.requests.byStatusClass["4xx"]).toBe(1);
    expect(snap.requests.byStatusClass["5xx"]).toBe(1);
    expect(snap.requests.serverErrors).toBe(1);
    expect(snap.slowestMs).toBe(40);
  });

  it("collapses ids in the per-route tally to keep cardinality low", () => {
    const m = new MetricsService();
    m.record(200, "/v1/buildings/0191a0c2-1111-7000-8000-000000000001", 5);
    m.record(200, "/v1/buildings/0191a0c2-2222-7000-8000-000000000002", 5);
    const snap = m.snapshot();
    const unit = snap.topRoutes.find((r) => r.route === "/v1/buildings/:id");
    expect(unit?.count).toBe(2);
  });

  it("reports an error rate", () => {
    const m = new MetricsService();
    m.record(200, "/a", 1);
    m.record(500, "/b", 1);
    expect(m.snapshot().requests.errorRate).toBe(0.5);
  });
});
