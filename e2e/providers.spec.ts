import { test, expect } from "@playwright/test";

/** The public provider application page (GJ-10) is reachable without an account. */

test("a provider can reach the Konnect apply page", async ({ page }) => {
  await page.goto("/provider/apply");
  await expect(page.getByRole("heading", { name: /Join Konnect/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Apply to join/i })).toBeVisible();
});
