#!/usr/bin/env node
// Kiataker packaging (PRD P0-01a, §53). Zips the whole project folder into one
// deliverable, after a clean verify, so it ships as a single package.
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stamp = new Date().toISOString().slice(0, 10);
const out = resolve(root, "release");
mkdirSync(out, { recursive: true });
const zip = resolve(out, `kiataker-${stamp}.zip`);

console.log("Packaging Kiataker for handover...");
execSync(
  `zip -r -q "${zip}" . -x "node_modules/*" -x "**/node_modules/*" -x ".git/*" -x ".turbo/*" -x "**/.next/*" -x "**/dist/*" -x "release/*" -x ".env.local"`,
  { cwd: root, stdio: "inherit" },
);
console.log(`✔ Wrote ${zip}`);
