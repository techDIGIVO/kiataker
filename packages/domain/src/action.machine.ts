import { StateMachine } from "./machine.js";

export type ActionStatus =
  | "PENDING"
  | "AVAILABLE"
  | "ACKNOWLEDGED"
  | "IN_PROGRESS"
  | "WAITING_ON_OTHER_PARTY"
  | "BLOCKED"
  | "OVERDUE"
  | "COMPLETED"
  | "CANCELLED"
  | "ESCALATED";

export type ActionEvent =
  | "MAKE_AVAILABLE"
  | "ACKNOWLEDGE"
  | "START"
  | "WAIT"
  | "BLOCK"
  | "UNBLOCK"
  | "OVERDUE"
  | "COMPLETE"
  | "CANCEL"
  | "ESCALATE";

/**
 * Action status machine (§9, ACT-02, ACT-04). An action closes only from a qualifying
 * source event, never from a UI click.
 */
export const actionMachine = new StateMachine<ActionStatus, ActionEvent>("action", "PENDING", [
  { from: "PENDING", event: "MAKE_AVAILABLE", to: "AVAILABLE" },
  { from: "AVAILABLE", event: "ACKNOWLEDGE", to: "ACKNOWLEDGED" },
  { from: "ACKNOWLEDGED", event: "START", to: "IN_PROGRESS" },
  { from: "AVAILABLE", event: "START", to: "IN_PROGRESS" },
  { from: "IN_PROGRESS", event: "WAIT", to: "WAITING_ON_OTHER_PARTY" },
  { from: "WAITING_ON_OTHER_PARTY", event: "START", to: "IN_PROGRESS" },
  { from: "AVAILABLE", event: "BLOCK", to: "BLOCKED" },
  { from: "IN_PROGRESS", event: "BLOCK", to: "BLOCKED" },
  { from: "BLOCKED", event: "UNBLOCK", to: "AVAILABLE" },
  { from: "AVAILABLE", event: "OVERDUE", to: "OVERDUE" },
  { from: "IN_PROGRESS", event: "OVERDUE", to: "OVERDUE" },
  { from: "OVERDUE", event: "ESCALATE", to: "ESCALATED" },
  { from: "AVAILABLE", event: "COMPLETE", to: "COMPLETED" },
  { from: "IN_PROGRESS", event: "COMPLETE", to: "COMPLETED" },
  { from: "WAITING_ON_OTHER_PARTY", event: "COMPLETE", to: "COMPLETED" },
  { from: "OVERDUE", event: "COMPLETE", to: "COMPLETED" },
  { from: "ESCALATED", event: "COMPLETE", to: "COMPLETED" },
  { from: "AVAILABLE", event: "CANCEL", to: "CANCELLED" },
  { from: "PENDING", event: "CANCEL", to: "CANCELLED" },
]);

export type MandateStatus =
  | "PENDING_ACCEPTANCE"
  | "ACTIVE"
  | "SUSPENDED"
  | "TERMINATED"
  | "EXPIRED";
export type MandateEvent = "ACCEPT" | "SUSPEND" | "RESUME" | "TERMINATE" | "EXPIRE";

export const mandateMachine = new StateMachine<MandateStatus, MandateEvent>(
  "mandate",
  "PENDING_ACCEPTANCE",
  [
    { from: "PENDING_ACCEPTANCE", event: "ACCEPT", to: "ACTIVE" },
    { from: "ACTIVE", event: "SUSPEND", to: "SUSPENDED" },
    { from: "SUSPENDED", event: "RESUME", to: "ACTIVE" },
    { from: "ACTIVE", event: "TERMINATE", to: "TERMINATED" },
    { from: "SUSPENDED", event: "TERMINATE", to: "TERMINATED" },
    { from: "ACTIVE", event: "EXPIRE", to: "EXPIRED" },
  ],
);
