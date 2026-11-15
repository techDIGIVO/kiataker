-- CreateTable
CREATE TABLE "ConditionCheck" (
    "id" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "landlordId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'BASELINE',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "items" JSONB NOT NULL DEFAULT '[]',
    "tenantConfirmTokenHash" TEXT,
    "tenantConfirmExpiresAt" TIMESTAMP(3),
    "tenantNote" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConditionCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConditionCheck_tenancyId_idx" ON "ConditionCheck"("tenancyId");

-- CreateIndex
CREATE INDEX "ConditionCheck_landlordId_idx" ON "ConditionCheck"("landlordId");
