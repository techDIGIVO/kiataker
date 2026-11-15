import { z } from "zod";
import { ValidationFailed } from "../errors/domain-errors.js";

/** Validate input against a Zod schema or throw the one error shape (§42). */
export function validate<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationFailed(result.error.flatten());
  }
  return result.data;
}
