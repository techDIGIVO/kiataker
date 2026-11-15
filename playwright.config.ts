import { defineConfig, devices } from "@playwright/test";

/**
 * UI end-to-end regression (the layer the smoke test cannot reach). Drives the real admin
 * in a browser. Expects the stack running (`pnpm dev` starts the API on 4000 + web on 3000);
 * if it is already up, the web server is reused. Browsers: `pnpm exec playwright install chromium`.
 */
export default defineConfig({
  testDir: "./e2e",
  // Serial against one dev server: avoids compile/API contention and flaky timeouts.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 1,
  reporter: [["list"]],
  // The dev server compiles each route on first hit; under serial load that cold-compile can be
  // slow, so allow generous timeouts (a production build serves pre-compiled pages and is fast).
  timeout: 90_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
