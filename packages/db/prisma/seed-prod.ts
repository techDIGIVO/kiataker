/**
 * Production seed: reference data plus ONE super-admin, nothing else. No demo landlords,
 * no known passwords. Run once after `migrate:deploy` on a new database:
 *
 *   JWT_ACCESS_SECRET=<same value as the API> \
 *   BOOTSTRAP_ADMIN_EMAIL=you@company.com \
 *   BOOTSTRAP_ADMIN_PASSWORD='<12+ chars>' \
 *   BOOTSTRAP_ADMIN_NAME='Your Name' \
 *   pnpm --filter @kiataker/db seed:prod
 *
 * The admin holds the CEO Command Centre seat (super-admin) and adds the rest of the team in
 * the admin. Idempotent: if the admin email already exists it is left untouched (the password
 * is never reset by re-running). Remove the BOOTSTRAP_ADMIN_* values from the host afterwards.
 */
import { PrismaClient } from "@prisma/client";
import { seedReferenceData } from "./reference-data";
import { productionEncryptionSecret, makeEncrypt, valueHash, hashPassword } from "./seed-utils";

function fail(message: string): never {
  console.error(`✗ seed:prod: ${message}`);
  process.exit(1);
}

const email = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? "").trim();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";
const displayName = (process.env.BOOTSTRAP_ADMIN_NAME ?? "Administrator").trim();

// Personal data is encrypted with a key derived from JWT_ACCESS_SECRET (mirrors the API's
// CryptoService). It must be the production value, or the API cannot read what is written here.
const encrypt = makeEncrypt(productionEncryptionSecret(fail));
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("BOOTSTRAP_ADMIN_EMAIL must be a valid email address.");
if (password.length < 12) fail("BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters.");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding production reference data...");
  const { centres } = await seedReferenceData(prisma);
  console.log("✔ Organisation, Command Centres, platform controls, routing rules and terms in place.");

  const hash = valueHash(email);
  const existing = await prisma.contactPoint.findUnique({
    where: { channel_valueHash: { channel: "EMAIL", valueHash: hash } },
  });
  if (existing) {
    console.log("✔ Admin email already registered; left unchanged.");
    return;
  }

  const { seat } = centres.get("ceo")!;
  await prisma.$transaction(async (tx) => {
    const admin = await tx.participant.create({
      data: {
        displayName,
        kind: "STAFF",
        status: "ACTIVE",
        emailVerified: true,
        passwordHash: hashPassword(password),
        createdBy: "seed-prod",
      },
    });
    await tx.contactPoint.create({
      data: {
        participantId: admin.id,
        channel: "EMAIL",
        valueHash: hash,
        valueEncrypted: encrypt(email),
        verifiedAt: new Date(),
        primary: true,
      },
    });
    await tx.seatAssignment.create({ data: { seatId: seat.id, participantId: admin.id } });
  });
  console.log("✔ Super-admin created (CEO Command Centre). Sign in at /admin and add the team from there.");
  console.log("  Now remove BOOTSTRAP_ADMIN_PASSWORD from the host's environment.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
