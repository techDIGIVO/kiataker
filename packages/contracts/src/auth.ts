import { z } from "zod";

/** Nigerian phone, E.164-ish. */
export const PhoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{7,14}$/, "Enter a valid phone number");

export const SignupSchema = z.object({
  displayName: z.string().min(2).max(120),
  channel: z.enum(["WHATSAPP", "EMAIL"]),
  phone: PhoneSchema.optional(),
  email: z.string().email().optional(),
});
export type SignupInput = z.infer<typeof SignupSchema>;

export const SendCodeSchema = z.object({
  channel: z.enum(["WHATSAPP", "EMAIL", "PHONE"]),
  target: z.string().min(3),
});

export const VerifyCodeSchema = z.object({
  channel: z.enum(["WHATSAPP", "EMAIL", "PHONE"]),
  target: z.string().min(3),
  code: z.string().length(6),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const TokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});
export type TokenPair = z.infer<typeof TokenPairSchema>;

export const MeSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  kind: z.enum(["LANDLORD", "REPRESENTATIVE", "PROVIDER_USER", "STAFF"]),
  emailVerified: z.boolean(),
  phoneVerified: z.boolean(),
  seats: z.array(z.object({ centre: z.string(), role: z.string() })).optional(),
});
export type Me = z.infer<typeof MeSchema>;

/** Combined acceptance of Terms, Mandate and Privacy in one step (ACC-02). */
export const AcceptTermsSchema = z.object({
  termsVersionIds: z.array(z.string()).min(1),
  channel: z.string().default("app"),
});
