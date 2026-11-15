-- CreateTable
CREATE TABLE "RentCharge" (
    "id" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amountKobo" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DUE',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "rentChargeId" TEXT,
    "amountKobo" BIGINT NOT NULL,
    "provenance" TEXT NOT NULL,
    "reference" TEXT,
    "evidenceRef" TEXT,
    "recordedBy" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentCharge_tenancyId_idx" ON "RentCharge"("tenancyId");

-- CreateIndex
CREATE INDEX "RentCharge_status_dueDate_idx" ON "RentCharge"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "RentCharge_tenancyId_periodStart_key" ON "RentCharge"("tenancyId", "periodStart");

-- CreateIndex
CREATE INDEX "Payment_tenancyId_idx" ON "Payment"("tenancyId");
