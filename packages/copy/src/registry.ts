/**
 * Kiataker copy registry (PRD §39). Every user-facing string lives here with a key,
 * a locale, a version and the surfaces it appears on. No user-facing string is hard-coded.
 * A lint (lint.mjs) fails the build on any banned term or em dash.
 */

export type Surface =
  | "landlord" // WhatsApp portal, mobile app
  | "tenant" // secure tasks, notifications
  | "provider" // Konnect web link
  | "staff" // admin / Command Centres
  | "public"; // landing page, verifier

export interface CopyEntry {
  key: string;
  locale: "en-NG";
  version: number;
  surfaces: Surface[];
  text: string;
}

export const copyEntries: CopyEntry[] = [
  // ---- Public / landing (WEB-01..WEB-05) ----
  {
    key: "public.hero.hook",
    locale: "en-NG",
    version: 1,
    surfaces: ["public"],
    text: "Collect your rent, we'll handle the rest.",
  },
  {
    key: "public.hero.subhead",
    locale: "en-NG",
    version: 1,
    surfaces: ["public"],
    text: "Rent settles directly to your account through a licensed payment partner. Kiataker never holds your rent, deposits or any customer money.",
  },
  {
    key: "public.cta.whatsapp",
    locale: "en-NG",
    version: 1,
    surfaces: ["public"],
    text: "Chat with Kiataker",
  },
  {
    key: "public.cta.appstore",
    locale: "en-NG",
    version: 1,
    surfaces: ["public"],
    text: "Download on the App Store",
  },
  {
    key: "public.cta.playstore",
    locale: "en-NG",
    version: 1,
    surfaces: ["public"],
    text: "Get it on Google Play",
  },
  {
    key: "public.cta.store_soon",
    locale: "en-NG",
    version: 1,
    surfaces: ["public"],
    text: "Coming soon",
  },
  {
    key: "public.provider.join",
    locale: "en-NG",
    version: 1,
    surfaces: ["public"],
    text: "Join as a Service Provider",
  },
  {
    key: "public.how.title",
    locale: "en-NG",
    version: 1,
    surfaces: ["public"],
    text: "How it works",
  },
  // ---- Landlord buttons: only Approve, Decline, Confirm, Decide, Review, Choose, Consent, Sign, Instruct (§1.3) ----
  {
    key: "landlord.action.approve",
    locale: "en-NG",
    version: 1,
    surfaces: ["landlord"],
    text: "Approve",
  },
  {
    key: "landlord.action.decline",
    locale: "en-NG",
    version: 1,
    surfaces: ["landlord"],
    text: "Decline",
  },
  {
    key: "landlord.action.confirm",
    locale: "en-NG",
    version: 1,
    surfaces: ["landlord"],
    text: "Confirm",
  },
  {
    key: "landlord.action.review",
    locale: "en-NG",
    version: 1,
    surfaces: ["landlord"],
    text: "Review",
  },
  {
    key: "landlord.action.instruct",
    locale: "en-NG",
    version: 1,
    surfaces: ["landlord"],
    text: "Instruct",
  },
  // ---- Action Centre labels (§9) ----
  {
    key: "landlord.action_centre.act_now",
    locale: "en-NG",
    version: 1,
    surfaces: ["landlord", "staff"],
    text: "Act Now",
  },
  {
    key: "landlord.action_centre.upcoming",
    locale: "en-NG",
    version: 1,
    surfaces: ["landlord", "staff"],
    text: "Upcoming",
  },
  {
    key: "landlord.action_centre.waiting",
    locale: "en-NG",
    version: 1,
    surfaces: ["landlord", "staff"],
    text: "Waiting",
  },
  {
    key: "landlord.action_centre.updates",
    locale: "en-NG",
    version: 1,
    surfaces: ["landlord", "staff"],
    text: "Updates",
  },
  {
    key: "landlord.action_centre.all_clear",
    locale: "en-NG",
    version: 1,
    surfaces: ["landlord", "staff"],
    text: "All clear",
  },
  // ---- Accuracy prompt before recording a tenancy (TEN-08) ----
  {
    key: "landlord.tenancy.accuracy_prompt",
    locale: "en-NG",
    version: 1,
    surfaces: ["landlord"],
    text: "Please check these details carefully. Kiataker records the tenancy as you state it, then asks the tenant to confirm. Creating a record is not the tenant's agreement.",
  },
  // ---- Caution Fee full legal phrase (§39, terminology) ----
  {
    key: "term.caution_fee",
    locale: "en-NG",
    version: 1,
    surfaces: ["landlord", "tenant", "staff", "public"],
    text: "Caution Fee (security deposit under the Lagos State Tenancy Law)",
  },
];

export const copyByKey: Record<string, CopyEntry> = Object.fromEntries(
  copyEntries.map((e) => [e.key, e]),
);
