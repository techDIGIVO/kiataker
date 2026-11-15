-- CreateTable
CREATE TABLE "TenancyCloseout" (
    "id" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "landlordId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "cautionFeeKobo" BIGINT NOT NULL DEFAULT 0,
    "deductionsKobo" BIGINT NOT NULL DEFAULT 0,
    "deductions" JSONB NOT NULL DEFAULT '[]',
    "outcome" TEXT,
    "refundKobo" BIGINT NOT NULL DEFAULT 0,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenancyCloseout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenancyCloseout_tenancyId_key" ON "TenancyCloseout"("tenancyId");

-- CreateIndex
CREATE INDEX "TenancyCloseout_landlordId_idx" ON "TenancyCloseout"("landlordId");
