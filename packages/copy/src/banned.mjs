// Kiataker banned-term table (PRD §39). Shared by the copy lint and its tests.
// Each rule: a matcher (regex), the surfaces it applies to, and the correction.

/** @typedef {{ id: string, pattern: RegExp, surfaces: string[]|"all", use: string }} BannedRule */

/** @type {BannedRule[]} */
export const bannedRules = [
  // Landlord action buttons may only use the approved verbs.
  {
    id: "landlord-verbs",
    pattern: /\b(Send|Schedule|Prepare|Message|Chase)\b/,
    surfaces: ["landlord"],
    use: "Approve, Decline, Confirm, Decide, Review, Choose, Consent, Sign, Instruct",
  },
  { id: "work-order", pattern: /\b(work order|jobs?)\b/i, surfaces: "all", use: "Work" },
  { id: "bid", pattern: /\bbid\b/i, surfaces: "all", use: "Quote" },
  {
    id: "caution-fee-bare",
    pattern: /\bcaution fee\b(?!\s*\(security deposit under the Lagos State Tenancy Law\))/i,
    surfaces: "all",
    use: "Caution Fee (security deposit under the Lagos State Tenancy Law)",
  },
  {
    id: "seven-day-notice",
    pattern: /\b(7[-\s]?Day Notice to Recover Possession|Seven[-\s]?Day Notice)\b/i,
    surfaces: "all",
    use: "Notice of Owner's Intention to Apply to Recover Possession",
  },
  {
    id: "tenant-invite",
    pattern: /\binvit(e|ation)\b/i,
    surfaces: ["tenant"],
    use: "notify, notification",
  },
  {
    id: "banned-product-terms",
    pattern:
      /\b(Tenant App|Tenant Portal|Tenant Passport|Trust Score|Tenant Rating|Landlord Rating|Provider rating|star rating)\b/i,
    surfaces: "all",
    use: "none — remove",
  },
  {
    id: "ownership-claims",
    pattern: /\b(verify ownership|title verified|Property Owner|ownership history)\b/i,
    surfaces: "all",
    use: 'Participant Basis, "the landlord named in this record"',
  },
  {
    id: "legal-claims",
    pattern: /\b(legally binding|legal validity|legally enforceable|law[-\s]?firm[-\s]?grade)\b/i,
    surfaces: "all",
    use: "verified, evidenced, on record, with delivery evidence",
  },
  { id: "rent-increase", pattern: /\bRent Increase\b/, surfaces: "all", use: "Rent Review" },
  { id: "verified-landlord", pattern: /\bverified landlords?\b/i, surfaces: "all", use: "the VERIFIED stage" },
  { id: "property-os", pattern: /\bProperty OS\b/i, surfaces: "all", use: "Kiataker, your property record" },
  { id: "pwa", pattern: /\bPWA\b/, surfaces: "all", use: "mobile app, web surfaces" },
  { id: "ndpr", pattern: /\bNDPR\b/, surfaces: "all", use: "NDPA (Nigeria Data Protection Act 2023)" },
  {
    id: "cp-codes",
    pattern: /\bCP-\d{2}\b/,
    surfaces: ["landlord", "tenant"],
    use: "plain service names",
  },
  {
    id: "brand-misspelling",
    pattern: /\b(KIATAKER|KiaTaker|KIA-TAKER)\b/,
    surfaces: "all",
    use: "Kiataker (brand), KIA TAKER LTD (company)",
  },
  // Em dash: banned in all copy and templates.
  { id: "em-dash", pattern: /—/, surfaces: "all", use: "Full stop, comma, colon or brackets" },
];
