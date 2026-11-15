-- CreateTable
CREATE TABLE "DataSubjectRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ACCESS',
    "subjectId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "verifyTokenHash" TEXT,
    "verifyExpiresAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "package" JSONB,
    "refusedReason" TEXT,
    "raisedBy" TEXT,
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSubjectRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DataSubjectRequest_reference_key" ON "DataSubjectRequest"("reference");

-- CreateIndex
CREATE INDEX "DataSubjectRequest_subjectId_idx" ON "DataSubjectRequest"("subjectId");
