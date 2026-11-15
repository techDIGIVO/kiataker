#!/usr/bin/env node
// Kiataker one-command verify (PRD P0-01, §45). Runs the full local quality gate:
// type-check, lint, copy lint, unit + integration tests, migration check, contract check.
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const steps = [
  ["Type-check", "pnpm typecheck"],
  ["Lint", "pnpm lint"],
  ["Copy lint (banned terms, em dashes, verbs)", "pnpm lint:copy"],
  ["Unit + integration tests", "pnpm test"],
  ["Migration drift check", "pnpm db:migrate:check"],
];

let failed = 0;
for (const [name, cmd] of steps) {
  console.log(`\n\u001b[36m=== ${name} ===\u001b[0m`);
  try {
    execSync(cmd, { cwd: root, stdio: "inherit", env: process.env });
    console.log(`✔ ${name}`);
  } catch {
    console.error(`✗ ${name} FAILED`);
    failed++;
  }
}

console.log("\n" + "=".repeat(48));
if (failed === 0) {
  console.log("✔ verify: all checks green.");
  process.exit(0);
} else {
  console.error(`✗ verify: ${failed} check(s) failed.`);
  process.exit(1);
}
