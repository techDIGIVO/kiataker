/**
 * Adds one staff login per Command Centre to a PRODUCTION database, at the client's request:
 *
 *   ceo@kiataker.ng, operations@kiataker.ng, product@kiataker.ng, legal@kiataker.ng,
 *   accounts@kiataker.ng   all with the password "kiataker-dev"
 *
 * WARNING: that password is published in this repository, and ceo@kiataker.ng holds the CEO
 * seat (super-admin). Anyone who has seen the code can sign in as super-admin. Suspend or
 * remove these accounts in /admin/team as soon as they are no longer needed.
 *
 * Unlike `seed` (dev only), this creates no demo landlords, properties or tenants, and
 * encrypts the emails the way the API expects. Existing accounts are never changed: an email
 * that is already registered is skipped, so re-running is safe.
 *
 *   JWT_ACCESS_SECRET=<same value as the API> CONFIRM_PUBLISHED_PASSWORD=yes \
 *   pnpm --filter @kiataker/db seed:centre-logins
 */
import { PrismaClient } from "@prisma/client";
import { seedReferenceData, CENTRES } from "./reference-data";
import { DEV_STAFF_PASSWORD, productionEncryptionSecret, makeEncrypt, valueHash, hashPassword } from "./seed-utils";

function fail(message: string): never {
  console.error(`✗ seed:centre-logins: ${message}`);
  process.exit(1);
}

if (process.env.CONFIRM_PUBLISHED_PASSWORD !== "yes") {
  fail(
    `these logins use the published password "${DEV_STAFF_PASSWORD}", and ceo@kiataker.ng is a super-admin. ` +
      "Set CONFIRM_PUBLISHED_PASSWORD=yes to proceed.",
  );
}
const encrypt = makeEncrypt(productionEncryptionSecret(fail));

const prisma = new PrismaClient();

async function main() {
  const { centres } = await seedReferenceData(prisma);
  const passwordHash = hashPassword(DEV_STAFF_PASSWORD);

  for (const c of CENTRES) {
    const email = `${c.key}@kiataker.ng`;
    const hash = valueHash(email);
    const existing = await prisma.contactPoint.findUnique({ where: { channel_valueHash: { channel: "EMAIL", valueHash: hash } } });
    if (existing) {
      console.log(`- ${email}: already registered, left unchanged`);
      continue;
    }
    const { seat } = centres.get(c.key)!;
    await prisma.$transaction(async (tx) => {
      const staff = await tx.participant.create({
        data: {
          displayName: `${c.name} Staff`,
          kind: "STAFF",
          status: "ACTIVE",
          emailVerified: true,
          passwordHash,
          createdBy: "seed-centre-logins",
        },
      });
      await tx.contactPoint.create({
        data: { participantId: staff.id, channel: "EMAIL", valueHash: hash, valueEncrypted: encrypt(email), verifiedAt: new Date(), primary: true },
      });
      await tx.seatAssignment.create({ data: { seatId: seat.id, participantId: staff.id } });
    });
    console.log(`✔ ${email}: created (${c.name})`);
  }

  console.log(`\nPassword for all of the above: ${DEV_STAFF_PASSWORD}`);
  console.log("ceo@kiataker.ng is a super-admin. Suspend or remove these logins in /admin/team when no longer needed.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
