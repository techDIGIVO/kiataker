-- CreateTable
CREATE TABLE "TenancyOrigination" (
    "id" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "landlordId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "termsSet" BOOLEAN NOT NULL DEFAULT true,
    "tenantAccepted" BOOLEAN NOT NULL DEFAULT false,
    "cautionFeeSettled" BOOLEAN NOT NULL DEFAULT false,
    "tenantAcceptTokenHash" TEXT,
    "tenantAcceptExpiresAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenancyOrigination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenancyOrigination_tenancyId_key" ON "TenancyOrigination"("tenancyId");

-- CreateIndex
CREATE INDEX "TenancyOrigination_landlordId_idx" ON "TenancyOrigination"("landlordId");
