/**
 * Parsing for what landlords type in chat. Pure functions so they are unit-tested directly.
 */

/** Rent and money bounds for chat input, in naira. ₦5bn also rules out a pasted phone number
 *  (a Nigerian mobile without its leading 0 is 7-9 billion). */
export const NAIRA_MIN = 1_000;
export const NAIRA_MAX = 5_000_000_000;

const MULTIPLIER: Record<string, number> = {
  "": 1,
  k: 1e3,
  thousand: 1e3,
  m: 1e6,
  mil: 1e6,
  million: 1e6,
  b: 1e9,
  bn: 1e9,
  billion: 1e9,
};

/**
 * A naira amount as people type it: "1500000", "1,500,000", "₦1.5m", "N800k", "1.2 million",
 * "2m naira". Returns whole naira, or null when it isn't clearly an amount (a phone number
 * such as "08031234567" or "+2348031234567", words, zero).
 */
export function parseNaira(input: string): number | null {
  let t = input.trim().toLowerCase();
  if (/^\+/.test(t) || /^0\d/.test(t.replace(/^(₦|ngn|n)\s*/, ""))) return null;
  t = t
    .replace(/^(₦|ngn|n)\s*/, "")
    .replace(/\s*(naira|ngn)$/, "")
    .replace(/[,\s]/g, "");
  const m = /^(\d+(?:\.\d+)?)(k|thousand|m|mil|million|b|bn|billion)?$/.exec(t);
  if (!m) return null;
  const naira = Math.round(Number(m[1]) * (MULTIPLIER[m[2] ?? ""] ?? 1));
  return Number.isFinite(naira) && naira > 0 ? naira : null;
}

/** Parse and range-check a rent-like amount; returns the amount or a reply explaining the problem. */
export function readAmount(input: string, { min = NAIRA_MIN, max = NAIRA_MAX } = {}): { naira: number } | { problem: string } {
  const digits = input.replace(/\D/g, "");
  if (/^\+|^0\d/.test(input.trim()) && digits.length >= 10) {
    return { problem: "That looks like a phone number. Please send the amount in naira, for example 1500000 or 1.5m." };
  }
  const naira = parseNaira(input);
  if (naira === null) return { problem: "Please send the amount in figures, for example 1500000 or 1.5m." };
  if (naira < min) return { problem: `That seems too low (₦${naira.toLocaleString("en-NG")}). Please send the full amount in naira, for example 1500000.` };
  if (naira > max) return { problem: `That seems too high (₦${naira.toLocaleString("en-NG")}). Please check the figure and send it again.` };
  return { naira };
}

/**
 * A phone number in E.164 form (+234...). Accepts Nigerian mobiles as people write them
 * ("0803 123 4567", "803-123-4567", "2348031234567", "+234 803 123 4567") and other
 * countries' numbers given with a leading +. Returns null for anything else.
 */
export function normalizePhone(input: string): string | null {
  const t = input.trim().replace(/[\s\-().]/g, "");
  const ng = /^(?:\+?234|0)?([789][01]\d{8})$/.exec(t);
  if (ng) return `+234${ng[1]}`;
  if (/^\+234/.test(t)) return null; // a +234 number that isn't a valid Nigerian mobile
  if (/^\+[1-9]\d{7,14}$/.test(t)) return t;
  return null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** A tenant contact typed in chat: a WhatsApp number, or an email for tenants without WhatsApp. */
export function readContact(input: string): { whatsapp: string } | { email: string } | null {
  const t = input.trim();
  if (EMAIL.test(t)) return { email: t.toLowerCase() };
  const phone = normalizePhone(t);
  return phone ? { whatsapp: phone } : null;
}

/** "+2348031234567" -> "+234 803 123 4567" for confirmations. */
export function displayPhone(e164: string): string {
  const m = /^\+234(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `+234 ${m[1]} ${m[2]} ${m[3]}` : e164;
}
