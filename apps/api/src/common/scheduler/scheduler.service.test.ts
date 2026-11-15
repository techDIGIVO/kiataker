import { describe, it, expect } from "vitest";
import { SchedulerService, type ScheduledJobRecord } from "./scheduler.service.js";

// dispatch() is pure of prisma, so it is unit-tested directly with a stub prisma.
const svc = new SchedulerService({} as never);
const job = (kind: string): ScheduledJobRecord => ({ id: "j1", kind, subjectRef: null, runAt: new Date(), state: "PENDING" });

describe("SchedulerService.dispatch", () => {
  it("runs a registered handler and reports DONE", async () => {
    let ran = false;
    svc.registerHandler("test.ok", async () => { ran = true; });
    expect(await svc.dispatch(job("test.ok"))).toBe("DONE");
    expect(ran).toBe(true);
  });

  it("reports SKIPPED when no handler is registered for the kind", async () => {
    expect(await svc.dispatch(job("unknown.kind"))).toBe("SKIPPED");
  });

  it("reports FAILED when the handler throws", async () => {
    svc.registerHandler("test.boom", async () => { throw new Error("boom"); });
    expect(await svc.dispatch(job("test.boom"))).toBe("FAILED");
  });

  it("has a built-in noop handler", () => {
    expect(svc.hasHandler("noop")).toBe(true);
  });
});
