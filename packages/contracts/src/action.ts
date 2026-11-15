import { z } from "zod";

/** Action Centre labels differ by audience (§9). A contract test pins both label sets. */
export const ActionTabSchema = z.enum(["act", "upcoming", "waiting", "updates"]);

export const landlordActionLabels: Record<z.infer<typeof ActionTabSchema>, string> = {
  act: "Act Now",
  upcoming: "Upcoming",
  waiting: "Waiting",
  updates: "Updates",
};
export const providerActionLabels: Record<z.infer<typeof ActionTabSchema>, string> = {
  act: "Now",
  upcoming: "Soon",
  waiting: "Waiting",
  updates: "Updates",
};

export const ActionSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  callToAction: z.string(),
  priority: z.enum(["CRITICAL", "URGENT", "OVERDUE", "IMPORTANT", "NORMAL"]),
  status: z.string(),
  propertyScope: z.string().nullable(),
  dueTime: z.string().nullable(),
  deepLink: z.string(),
});
export type Action = z.infer<typeof ActionSchema>;

export const ActionSummarySchema = z.object({
  act: z.number(),
  upcoming: z.number(),
  waiting: z.number(),
  allClear: z.boolean(),
  nextKnownEvent: z.string().nullable(),
});
export type ActionSummary = z.infer<typeof ActionSummarySchema>;
