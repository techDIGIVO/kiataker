import { z } from "zod";
import { KoboSchema } from "./common.js";

export const TenancyRouteSchema = z.enum(["EXISTING", "ORIGINATION"]);
export const TenancyStatusSchema = z.enum([
  "RECORDED",
  "TENANT_NOTIFIED",
  "TENANT_CONFIRMED",
  "TENANT_DISPUTED",
  "RECONCILED",
  "RENEWED",
  "ENDED",
]);

/** Record an existing tenancy (TEN route EXISTING, GJ-03). Opens with the accuracy prompt. */
export const RecordExistingTenancySchema = z.object({
  propertyId: z.string(),
  tenant: z.object({
    name: z.string().min(2).max(120),
    whatsapp: z.string().optional(),
    email: z.string().email().optional(),
  }),
  terms: z.object({
    rentKobo: KoboSchema,
    frequency: z.enum(["monthly", "quarterly", "biannual", "annual"]),
    cautionFeeKobo: KoboSchema.optional(),
    serviceChargeKobo: KoboSchema.optional(),
    noticePeriod: z.string().optional(),
    commencementDate: z.string(),
    expiryDate: z.string(),
  }),
  accuracyAcknowledged: z.literal(true, {
    errorMap: () => ({ message: "Please confirm the details are accurate before recording" }),
  }),
});
export type RecordExistingTenancyInput = z.infer<typeof RecordExistingTenancySchema>;

export const TenancySchema = z.object({
  id: z.string(),
  propertyId: z.string(),
  route: TenancyRouteSchema,
  status: TenancyStatusSchema,
  lifecyclePhase: z.enum(["FUTURE_DATED", "CURRENT", "EXPIRED"]),
  commencementDate: z.string().nullable(),
  expiryDate: z.string().nullable(),
  createdAt: z.string(),
});
export type Tenancy = z.infer<typeof TenancySchema>;

/** Tenant confirms, disputes or corrects (BP-19). They never approve or decline. */
export const TenantResponseSchema = z.object({
  kind: z.enum(["CONFIRM", "DISPUTE", "CORRECT"]),
  note: z.string().max(1000).optional(),
});
