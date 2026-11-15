#!/usr/bin/env node
// Kiataker copy lint (PRD §39, P0-10). Fails the build on any banned term on the surfaces
// listed, or on an em dash anywhere in copy or templates.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname } from "node:path";
import { bannedRules } from "./src/banned.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

/** Parse copy registry entries (surfaces + text) without importing TypeScript. */
function parseRegistry() {
  const file = resolve(here, "src", "registry.ts");
  const src = readFileSync(file, "utf8");
  const re = /surfaces:\s*\[([^\]]*)\][\s\S]*?text:\s*"((?:[^"\\]|\\.)*)"/g;
  const entries = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    const surfaces = m[1]
      .split(",")
      .map((s) => s.trim().replace(/["']/g, ""))
      .filter(Boolean);
    const text = m[2].replace(/\\"/g, '"').replace(/\\'/g, "'");
    entries.push({ surfaces, text });
  }
  return { file, entries };
}

function ruleApplies(rule, surfaces) {
  if (rule.surfaces === "all") return true;
  return rule.surfaces.some((s) => surfaces.includes(s));
}

const violations = [];

// 1. Registry entries, checked by their declared surfaces.
const { file: regFile, entries } = parseRegistry();
for (const entry of entries) {
  for (const rule of bannedRules) {
    if (ruleApplies(rule, entry.surfaces) && rule.pattern.test(entry.text)) {
      violations.push(
        `${regFile}: [${rule.id}] "${entry.text.slice(0, 60)}" → use: ${rule.use}`,
      );
    }
  }
}

// 2. Em dash scan across templates and web copy (all surfaces).
const emDash = bannedRules.find((r) => r.id === "em-dash");
const scanDirs = ["apps/web/src", "apps/web/app", "packages/templates"].map((d) =>
  resolve(repoRoot, d),
);
const exts = new Set([".ts", ".tsx", ".html", ".md", ".json"]);
function walk(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = resolve(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (exts.has(extname(name))) {
      const text = readFileSync(p, "utf8");
      if (emDash.pattern.test(text)) {
        const line = text.split("\n").findIndex((l) => /—/.test(l)) + 1;
        violations.push(`${p}:${line}: [em-dash] em dash is banned in copy and templates`);
      }
    }
  }
}
scanDirs.forEach(walk);

if (violations.length) {
  console.error(`✗ copy lint: ${violations.length} violation(s)\n`);
  violations.forEach((v) => console.error("  " + v));
  process.exit(1);
}
console.log(`✔ copy lint: ${entries.length} registry entries clean, no banned terms.`);
