import { test, expect } from "@playwright/test";

/** The public document verifier (GJ-14) is reachable without an account. */

test("the public verifier reports an unknown reference", async ({ page }) => {
  await page.goto("/verify/KT-DOC-NOTREAL");
  await expect(page.getByRole("heading", { name: /Not found/i })).toBeVisible();
});
