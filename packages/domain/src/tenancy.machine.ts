import { StateMachine } from "./machine.js";

export type TenancyStatus =
  | "RECORDED"
  | "TENANT_NOTIFIED"
  | "TENANT_CONFIRMED"
  | "TENANT_DISPUTED"
  | "RECONCILED"
  | "RENEWED"
  | "ENDED";

export type TenancyEvent =
  | "NOTIFY"
  | "TENANT_CONFIRM"
  | "TENANT_DISPUTE"
  | "TENANT_CORRECT"
  | "RECONCILE"
  | "RENEW"
  | "END";

/** Tenancy status machine (§13, GJ-03, GJ-04). Tenants confirm, dispute or correct only. */
export const tenancyMachine = new StateMachine<TenancyStatus, TenancyEvent>(
  "tenancy",
  "RECORDED",
  [
    { from: "RECORDED", event: "NOTIFY", to: "TENANT_NOTIFIED" },
    { from: "TENANT_NOTIFIED", event: "TENANT_CONFIRM", to: "TENANT_CONFIRMED" },
    { from: "TENANT_NOTIFIED", event: "TENANT_DISPUTE", to: "TENANT_DISPUTED" },
    { from: "TENANT_NOTIFIED", event: "TENANT_CORRECT", to: "TENANT_DISPUTED" },
    { from: "TENANT_DISPUTED", event: "RECONCILE", to: "RECONCILED" },
    { from: "TENANT_CONFIRMED", event: "RENEW", to: "RENEWED" },
    { from: "RECONCILED", event: "RENEW", to: "RENEWED" },
    { from: "TENANT_CONFIRMED", event: "END", to: "ENDED" },
    { from: "RECONCILED", event: "END", to: "ENDED" },
    { from: "RENEWED", event: "END", to: "ENDED" },
  ],
);

export type OccupancyState =
  | "EXPECTED"
  | "ACTIVE"
  | "VACATING"
  | "VACATED"
  | "POSSESSION_DISPUTED"
  | "CLOSED";

export type OccupancyEvent = "ACTIVATE" | "GIVE_NOTICE" | "VACATE" | "DISPUTE" | "CLOSE" | "RESOLVE";

/** Occupancy is the lasting lifecycle; the tenancy is the contract (BP-05). */
export const occupancyMachine = new StateMachine<OccupancyState, OccupancyEvent>(
  "occupancy",
  "EXPECTED",
  [
    { from: "EXPECTED", event: "ACTIVATE", to: "ACTIVE" },
    { from: "ACTIVE", event: "GIVE_NOTICE", to: "VACATING" },
    { from: "VACATING", event: "VACATE", to: "VACATED" },
    { from: "ACTIVE", event: "DISPUTE", to: "POSSESSION_DISPUTED" },
    { from: "VACATING", event: "DISPUTE", to: "POSSESSION_DISPUTED" },
    { from: "POSSESSION_DISPUTED", event: "RESOLVE", to: "VACATED" },
    { from: "VACATED", event: "CLOSE", to: "CLOSED" },
  ],
);
