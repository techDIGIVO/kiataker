import { z } from "zod";

/** One error shape across the whole API (§42, §29). */
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  requestId: z.string(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** Stable error codes (§42). */
export const ErrorCode = {
  BASE_TRUTH_NOT_CONFIRMED: "BASE_TRUTH_NOT_CONFIRMED",
  CONTACT_VERIFICATION_REQUIRED: "CONTACT_VERIFICATION_REQUIRED",
  CONTROL_DISABLED: "CONTROL_DISABLED",
  GATE_NOT_SATISFIED: "GATE_NOT_SATISFIED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  IDEMPOTENCY_REPLAY: "IDEMPOTENCY_REPLAY",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Money is integer kobo (§28, §42). Formatting happens at the edge. */
export const KoboSchema = z.coerce.bigint().nonnegative();

/** Cursor pagination for list endpoints (§29). */
export const PageQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PageQuery = z.infer<typeof PageQuerySchema>;

export function pageResponse<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

/** ISO 8601 date string in the API; display is handled at the edge (§42). */
export const IsoDateSchema = z.string().datetime();
