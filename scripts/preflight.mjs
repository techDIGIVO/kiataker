#!/usr/bin/env node
// Kiataker preflight (PRD P0-01a). Confirms prerequisites before the local stack starts.
import { execSync } from "node:child_process";

const check = (label, cmd, min) => {
  try {
    const v = execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    console.log(`✔ ${label}: ${v}`);
    return true;
  } catch {
    console.error(`✗ ${label}: not found${min ? ` (need ${min})` : ""}`);
    return false;
  }
};

console.log("Kiataker preflight\n");
let ok = true;
ok = check("Node", "node -v", ">=22") && ok;
ok = check("pnpm", "pnpm -v", ">=9") && ok;
check("Docker (optional)", "docker -v");
check("Postgres client (optional)", "psql --version");

process.exit(ok ? 0 : 1);
