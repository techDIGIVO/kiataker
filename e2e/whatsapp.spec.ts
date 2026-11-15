import { test, expect } from "@playwright/test";

/** The WhatsApp simulator is the landlord's surface; it exposes the chat flows. */

test("the WhatsApp simulator offers the new chat flows", async ({ page }) => {
  await page.goto("/simulator");
  // Wait for the on-mount greeting so the send() busy guard has cleared.
  await expect(page.getByText(/Welcome/i)).toBeVisible();
  const input = page.getByPlaceholder("Message");
  await input.fill("menu");
  await input.press("Enter");
  await expect(page.getByText("Report a problem")).toBeVisible();
  await expect(page.getByText("Collect rent")).toBeVisible();
  await expect(page.getByText("My issues")).toBeVisible();
});

// Plain-language intent classification (e.g. "my tap is leaking" → report a problem) is covered
// by the smoke suite and was verified live in the simulator; it is intentionally not asserted
// here because it needs one engine round-trip that is flaky on a dev DB saturated by repeated
// smoke runs. Run smoke for that path.
