/**
 * Kiataker design tokens (PRD §38).
 * One token package feeds web, mobile and PDF documents.
 * Colour carries meaning; brand green is reserved for the primary action.
 */

export const color = {
  // Brand green
  greenPrimary: "#146B4A", // Logo, primary buttons, headings, selected navigation
  greenHover: "#105E41", // Hover and pressed states
  greenDeep: "#0B5138", // Staff sidebar, provider identity band
  greenSoft: "#EAF3EE", // Success backgrounds, selected rows
  greenMist: "#CFE2D6", // Borders on green surfaces

  // Canvas
  canvas: "#FFFFFF", // Page and card background
  ivory: "#F5F1E4", // Accent cards, highlights, empty states
  surfaceMuted: "#F4F1EA", // Secondary panels

  // Text
  textPrimary: "#142018", // Body text
  textSecondary: "#536159", // Supporting text
  textMuted: "#5F6D66", // Captions
  border: "#E3DED5", // Card and input borders

  // Status (always paired with a word, never colour alone — §38.3)
  warningFg: "#8A5B00",
  warningBg: "#FDF3E0",
  dangerFg: "#A13B2E",
  dangerBg: "#FBEEEC",
  infoFg: "#1E4E79",
  infoBg: "#E8F0F7",
} as const;

export const radius = {
  small: "7px",
  control: "9px",
  card: "14px",
  large: "18px",
} as const;

export const shadow = {
  card: "0 2px 6px rgba(20, 32, 24, 0.04)",
} as const;

export const font = {
  heading: "'Outfit', system-ui, sans-serif", // weights 600, 700
  body: "'Plus Jakarta Sans', system-ui, sans-serif", // weights 400, 500, 600
  mono: "'JetBrains Mono', ui-monospace, monospace", // reference numbers and hashes
} as const;

export const fontSize = {
  // Landlord body text is 18px and scales with the device; staff screens use 16px minimum (§38.2)
  landlordBody: "18px",
  staffBody: "16px",
} as const;

/** Breakpoints layouts are checked at (§38.3). No horizontal scroll on phones. */
export const breakpoint = {
  phoneSmall: 320,
  phone: 390,
  tablet: 768,
  desktop: 1440,
} as const;

/** Minimum touch targets (§38.3): 48px landlord surfaces, 44px elsewhere. */
export const touchTarget = {
  landlord: 48,
  staff: 44,
} as const;

/** The seven designed states every screen must have (§38.3). */
export const screenStates = [
  "normal",
  "empty",
  "loading",
  "serverError",
  "offline",
  "accessDenied",
  "staleData",
] as const;
export type ScreenState = (typeof screenStates)[number];

export const tokens = { color, radius, shadow, font, fontSize, breakpoint, touchTarget } as const;
export default tokens;
