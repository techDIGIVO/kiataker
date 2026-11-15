import { z } from "zod";

export const BuildingUseSchema = z.enum(["RESIDENTIAL", "COMMERCIAL", "MIXED_USE"]);
export const UnitUseSchema = z.enum(["RESIDENTIAL", "SHOP", "OFFICE", "WAREHOUSE", "OTHER_BUSINESS"]);
export const PropertyStateSchema = z.enum(["DRAFT", "MANAGED", "TERMINATED"]);

/** Create a Property File. Management starts at this moment (BP-01, GJ-02). */
export const CreatePropertySchema = z.object({
  addressRaw: z.string().min(5).max(240),
  buildingUse: BuildingUseSchema,
  unitUse: UnitUseSchema.optional(),
  building: z.string().max(120).optional(),
  unit: z.string().max(120).optional(),
  acceptMandate: z.literal(true, {
    errorMap: () => ({ message: "The Mandate must be accepted to create a Property File" }),
  }),
});
export type CreatePropertyInput = z.infer<typeof CreatePropertySchema>;

export const PropertySchema = z.object({
  id: z.string(),
  reference: z.string(),
  addressRaw: z.string(),
  buildingUse: BuildingUseSchema,
  unitUse: UnitUseSchema.nullable(),
  state: PropertyStateSchema,
  qcStatus: z.enum(["NOT_STARTED", "IN_REVIEW", "PASSED", "FLAGGED"]),
  managedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Property = z.infer<typeof PropertySchema>;

export const PropertyTimelineEventSchema = z.object({
  id: z.string(),
  eventType: z.string(),
  summary: z.string(),
  at: z.string(),
});
