export * from "@prisma/client";
import { PrismaClient } from "@prisma/client";

/** Shared Prisma client factory. Business history is append-only; see §28.2 data rules. */
export function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}
