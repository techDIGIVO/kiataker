#!/usr/bin/env node
// Kiataker one-command setup (PRD P0-01). Installs deps, prepares env, generates the
// Prisma client, runs migrations and seeds the personas — on a clean machine.
import { execSync } from "node:child_process";
import { existsSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd) => {
  console.log(`\n\u001b[32m❯\u001b[0m ${cmd}`);
  execSync(cmd, { cwd: root, stdio: "inherit", env: process.env });
};

console.log("Kiataker setup — bringing the platform up on this machine.\n");

// 1. Env file
const envLocal = resolve(root, ".env.local");
if (!existsSync(envLocal)) {
  copyFileSync(resolve(root, ".env.example"), envLocal);
  console.log("Created .env.local from .env.example — edit it if your Postgres differs.");
}

// 2. Install
run("pnpm install");

// 3. Prisma client + migrations + seed
run("pnpm db:generate");
run("pnpm db:migrate");
run("pnpm db:seed");

console.log("\n✔ Setup complete. Start everything with: pnpm dev");
console.log("  API:    http://localhost:4000  (health: /v1/health)");
console.log("  Web:    http://localhost:3000");
