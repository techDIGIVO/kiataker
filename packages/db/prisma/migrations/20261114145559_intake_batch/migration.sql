-- CreateTable
CREATE TABLE "IntakeBatch" (
    "id" TEXT NOT NULL,
    "landlordId" TEXT NOT NULL,
    "createdBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "rows" JSONB NOT NULL DEFAULT '[]',
    "confirmTokenHash" TEXT,
    "confirmExpiresAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "committedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntakeBatch_landlordId_idx" ON "IntakeBatch"("landlordId");
