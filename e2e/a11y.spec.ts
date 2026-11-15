import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility audit (Phase 5). Runs axe-core (WCAG 2.0/2.1 A + AA) across the public and admin
 * surfaces. The gate is: no serious or critical violations. Moderate/minor findings are printed
 * for follow-up but do not fail, so the bar is meaningful and stable.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const STAFF = { email: "operations@kiataker.ng", password: "kiataker-dev" };

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await page.locator('input[type="email"]').fill(STAFF.email);
  await page.locator('input[type="password"]').fill(STAFF.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/admin");
}

async function audit(page: import("@playwright/test").Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const minor = results.violations.filter((v) => v.impact !== "serious" && v.impact !== "critical");
  const fmt = (v: (typeof results.violations)[number]) => `${v.impact}: ${v.id} (${v.nodes.length}) - ${v.help}`;
  if (process.env.A11Y_DUMP) {
    for (const v of results.violations) {
      for (const n of v.nodes) {
        console.log(`[a11y-node] ${label} | ${v.impact} | ${v.id} | ${JSON.stringify(n.target)} | ${(n.any[0]?.message ?? n.failureSummary ?? "").replace(/\n/g, " ")}`);
      }
    }
  }
  if (serious.length) console.log(`\n[a11y] ${label} SERIOUS/CRITICAL:\n  ${serious.map(fmt).join("\n  ")}`);
  if (minor.length) console.log(`\n[a11y] ${label} moderate/minor:\n  ${minor.map(fmt).join("\n  ")}`);
  expect(serious, `${label}: ${serious.map(fmt).join("; ")}`).toEqual([]);
}

const PUBLIC = [
  { path: "/", label: "landing page" },
  { path: "/admin/login", label: "admin login" },
  { path: "/provider/apply", label: "provider apply" },
  { path: "/verify/KT-DOC-UNKNOWN", label: "document verifier" },
];

for (const s of PUBLIC) {
  test(`a11y: ${s.label}`, async ({ page }) => {
    await page.goto(s.path);
    await page.waitForLoadState("networkidle");
    await audit(page, s.label);
  });
}

const ADMIN = [
  { path: "/admin", label: "admin dashboard" },
  { path: "/admin/buildings", label: "admin buildings" },
  { path: "/admin/sign-off", label: "admin sign-off" },
  { path: "/admin/ndpa", label: "admin data requests" },
  { path: "/admin/ai", label: "admin integrations (forms)" },
  { path: "/admin/intake", label: "admin intake (forms)" },
];

for (const s of ADMIN) {
  test(`a11y: ${s.label}`, async ({ page }) => {
    await signIn(page);
    await page.goto(s.path);
    await page.waitForLoadState("networkidle");
    await audit(page, s.label);
  });
}
