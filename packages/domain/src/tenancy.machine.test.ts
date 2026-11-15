import { describe, it, expect } from "vitest";
import { tenancyMachine, IllegalTransitionError } from "./index.js";

describe("tenancy state machine (GJ-03, GJ-04)", () => {
  it("records then notifies then tenant confirms", () => {
    let s = tenancyMachine.initial;
    s = tenancyMachine.next(s, "NOTIFY");
    expect(s).toBe("TENANT_NOTIFIED");
    s = tenancyMachine.next(s, "TENANT_CONFIRM");
    expect(s).toBe("TENANT_CONFIRMED");
  });

  it("a tenant dispute routes to reconciliation", () => {
    let s: typeof tenancyMachine.initial = "TENANT_NOTIFIED";
    s = tenancyMachine.next(s, "TENANT_DISPUTE");
    expect(s).toBe("TENANT_DISPUTED");
    s = tenancyMachine.next(s, "RECONCILE");
    expect(s).toBe("RECONCILED");
  });

  it("refuses an illegal transition and names the attempted state", () => {
    expect(() => tenancyMachine.next("RECORDED", "TENANT_CONFIRM")).toThrow(IllegalTransitionError);
  });
});
