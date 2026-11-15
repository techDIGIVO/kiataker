import { defineConfig } from "vitest/config";

// NestJS DI needs decorator metadata. tsc emits it; for Vitest we run the pre-built
// integration tests against a real Postgres (PRD §50). Unit tests of pure services
// instantiate classes directly, so no reflection is required.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test/setup-env.ts"],
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    testTimeout: 30000,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
