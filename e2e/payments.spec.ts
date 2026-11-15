import { test, expect } from "@playwright/test";

/** GJ-12 end to end: staff raise a checkout, the tenant pays, the payment settles. */

const STAFF = { email: "operations@kiataker.ng", password: "kiataker-dev" };

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await page.locator('input[type="email"]').fill(STAFF.email);
  await page.locator('input[type="password"]').fill(STAFF.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/admin");
}

test("Payments Command Centre renders the split and no-custody note", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/payments");
  await expect(page.getByRole("heading", { name: /^Payments$/i })).toBeVisible();
  await expect(page.getByText(/Kiataker never holds the money/i)).toBeVisible();
  await expect(page.getByText(/Settled to landlords/i)).toBeVisible();
});

test("a tenant can pay a raised checkout end to end (test mode)", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/payments");

  // Raise a checkout for the first tenancy in arrears.
  await page.locator("select").selectOption({ index: 1 });
  await page.getByRole("button", { name: /create payment link/i }).click();

  const payLink = page.getByRole("link", { name: /tenant pay page/i });
  await expect(payLink).toBeVisible();
  const href = await payLink.getAttribute("href");
  expect(href).toContain("/pay/KTX-");

  // Open the hosted pay page and pay (test mode simulates Paystack success).
  await page.goto(href!);
  await expect(page.getByRole("heading", { name: /pay your rent/i })).toBeVisible();
  await page.getByRole("button", { name: /pay now/i }).click();
  await expect(page.getByRole("heading", { name: /payment received/i })).toBeVisible();
  await expect(page.getByText(/settled to your landlord/i)).toBeVisible();
});
