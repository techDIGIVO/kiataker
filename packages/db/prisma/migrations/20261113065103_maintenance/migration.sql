-- CreateTable
CREATE TABLE "MaintenanceIssue" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "tenancyId" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'REPORTED',
    "reportedBy" TEXT,
    "evidenceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceQuote" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerRef" TEXT,
    "amountKobo" BIGINT NOT NULL,
    "scope" TEXT NOT NULL,
    "assumptions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "sealedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Work" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "evidence" JSONB,
    "acceptedBy" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Work_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenanceIssue_propertyId_idx" ON "MaintenanceIssue"("propertyId");

-- CreateIndex
CREATE INDEX "ServiceQuote_issueId_idx" ON "ServiceQuote"("issueId");

-- CreateIndex
CREATE INDEX "Work_issueId_idx" ON "Work"("issueId");
