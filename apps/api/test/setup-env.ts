// Load .env.local into process.env for integration tests against a real Postgres (§50).
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, "..", "..", "..", ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

// Tests create and delete data. Refuse to run them against anything but a local database, so a
// production or staging URL left in .env.local can never be written to by a test run.
const dbUrl = process.env.DATABASE_URL ?? "";
let dbHost = "";
try {
  dbHost = new URL(dbUrl).hostname;
} catch {
  /* no or malformed URL: tests that need a database will fail on their own */
}
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "postgres", "host.docker.internal"]);
if (dbHost && !LOCAL_HOSTS.has(dbHost) && process.env.ALLOW_REMOTE_TEST_DB !== "yes") {
  throw new Error(
    `Refusing to run tests: DATABASE_URL points at "${dbHost}", which is not a local database. ` +
      "Point it at your local Postgres (see .env.example), or set ALLOW_REMOTE_TEST_DB=yes for a disposable remote one.",
  );
}
