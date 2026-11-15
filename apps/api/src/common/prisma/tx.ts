import type { Prisma } from "@kiataker/db";

/** An interactive transaction client (used so writes + outbox + audit commit together). */
export type Tx = Prisma.TransactionClient;
