import { test, expect } from "@playwright/test";

/** Staff admin regression: sign in, then every Command Centre renders its own surface. */

const STAFF = { email: "operations@kiataker.ng", password: "kiataker-dev" };

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await page.locator('input[type="email"]').fill(STAFF.email);
  await page.locator('input[type="password"]').fill(STAFF.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/admin");
}

test("staff can sign in and reach the Operations overview", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: /Operations Command Centre/i })).toBeVisible();
});

test("Konnect Command Centre lists issues", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/konnect");
  await expect(page.getByRole("heading", { name: /Konnect & maintenance/i })).toBeVisible();
  await expect(page.getByText(/Vocabulary is Work and Quote/i)).toBeVisible();
});

test("Rent & arrears Command Centre renders", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/rent");
  await expect(page.getByRole("heading", { name: /Rent & arrears/i })).toBeVisible();
  await expect(page.getByText(/Kiataker only records it/i)).toBeVisible();
});

test("Notices Command Centre renders with truthful delivery", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/notices");
  await expect(page.getByRole("heading", { name: /^Notices$/i })).toBeVisible();
  await expect(page.getByText(/shown exactly as recorded/i)).toBeVisible();
});

test("Reconciliation Command Centre renders", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/reconciliation");
  await expect(page.getByRole("heading", { name: /^Reconciliation$/i })).toBeVisible();
});

test("Integrations & keys shows the key-control area for every adapter", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/ai");
  await expect(page.getByText(/What's in place/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Save Paystack keys/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Save WhatsApp keys/i })).toBeVisible();

  // The coordination fee is admin-configurable (definition-of-done #4). Set it to the 5% default.
  await expect(page.getByText(/Coordination fee/i)).toBeVisible();
  await page.locator('input[type="number"]').first().fill("5");
  await page.getByRole("button", { name: /Save fee/i }).click();
  await expect(page.getByText(/Coordination fee saved/i)).toBeVisible();
});

test("staff can toggle a platform control from the dashboard", async ({ page }) => {
  // A high-risk control prompts for a reason; auto-accept it.
  page.on("dialog", (d) => d.accept("e2e reason"));
  await signIn(page);
  await page.goto("/admin");
  const row = page.locator("tr", { hasText: "store_badges" });
  const btn = row.getByRole("button");
  await expect(btn).toBeVisible();
  const before = (await btn.innerText()).trim();
  await btn.click();
  await expect(btn).not.toHaveText(before, { timeout: 15_000 });
  // Flip it back so the control returns to its prior state.
  await btn.click();
  await expect(btn).toHaveText(before, { timeout: 15_000 });
});

test("the scope-of-management board renders", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/scope");
  await expect(page.getByRole("heading", { name: "Scope of management", exact: true })).toBeVisible();
  await expect(page.getByText(/defaults to full management/i)).toBeVisible();
});

test("the buildings board renders", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/buildings");
  await expect(page.getByRole("heading", { name: "Buildings", exact: true })).toBeVisible();
  await expect(page.getByText(/holding both flats and shops is mixed-use/i)).toBeVisible();
});

test("the statements board renders", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/statements");
  await expect(page.getByRole("heading", { name: "Statements", exact: true })).toBeVisible();
  await expect(page.getByText(/Landlord rent statements/i)).toBeVisible();
});

test("the support inbox renders", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/inbox");
  await expect(page.getByRole("heading", { name: "Support inbox", exact: true })).toBeVisible();
  await expect(page.getByText(/Every WhatsApp conversation/i)).toBeVisible();
});

test("the job queue board renders", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/jobs");
  await expect(page.getByRole("heading", { name: "Job queue", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Process due now/i })).toBeVisible();
});

test("the CEO sign-off queue renders", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/sign-off");
  await expect(page.getByRole("heading", { name: "CEO sign-off", exact: true })).toBeVisible();
  await expect(page.getByText(/wait here for a CEO/i)).toBeVisible();
});

test("the NDPA data-requests board renders", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/ndpa");
  await expect(page.getByRole("heading", { name: "Data requests", exact: true })).toBeVisible();
  await expect(page.getByText(/access and erasure/i)).toBeVisible();
});

test("the bulk intake board renders", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/intake");
  await expect(page.getByRole("heading", { name: "Bulk intake", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "New batch" })).toBeVisible();
});

test("the providers board renders", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/providers");
  await expect(page.getByRole("heading", { name: "Providers", exact: true })).toBeVisible();
  await expect(page.getByText("Applications")).toBeVisible();
});

test("the renewals board renders", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/renewals");
  await expect(page.getByRole("heading", { name: "Renewals", exact: true })).toBeVisible();
  await expect(page.getByText("Possession runways")).toBeVisible();
});

test("the condition-checks board renders", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/condition");
  await expect(page.getByRole("heading", { name: "Condition checks", exact: true })).toBeVisible();
  await expect(page.getByText("Awaiting tenant")).toBeVisible();
});

test("the close-outs board renders", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/closeouts");
  await expect(page.getByRole("heading", { name: "Close-outs", exact: true })).toBeVisible();
  await expect(page.getByText("Refunded to tenants")).toBeVisible();
});

test("the template studio renders", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/templates");
  await expect(page.getByRole("heading", { name: "Template studio", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "New template" })).toBeVisible();
});

test("the documents board renders", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/documents");
  await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
  await expect(page.getByText("Fully signed", { exact: true })).toBeVisible();
});

test("the originations board renders with gates", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/originations");
  await expect(page.getByRole("heading", { name: /New tenancies/i })).toBeVisible();
  await expect(page.getByText("In flight", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Originations", exact: true })).toBeVisible();
});

test("the WhatsApp channel admin manages templates and quiet hours", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/whatsapp");
  await expect(page.getByRole("heading", { name: /WhatsApp channel/i })).toBeVisible();
  await expect(page.getByText(/Quiet hours/i).first()).toBeVisible();
  await expect(page.getByText(/Message templates/i).first()).toBeVisible();

  const name = `e2e_tpl_${Date.now()}`;
  await page.getByPlaceholder("template_name").fill(name);
  await page.getByPlaceholder(/rent of/i).fill("Hello {{1}}");
  await page.getByRole("button", { name: /Create template/i }).click();
  await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });
});
