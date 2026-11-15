-- CreateTable
CREATE TABLE "SealedDocument" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TENANCY_AGREEMENT',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "contentHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "tenancyId" TEXT,
    "createdBy" TEXT,
    "sealedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SealedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSignature" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerRole" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'ESIGN',
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "tokenHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "signatureHash" TEXT,
    "evidenceRef" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SealedDocument_reference_key" ON "SealedDocument"("reference");

-- CreateIndex
CREATE INDEX "DocumentSignature_documentId_idx" ON "DocumentSignature"("documentId");

-- AddForeignKey
ALTER TABLE "DocumentSignature" ADD CONSTRAINT "DocumentSignature_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SealedDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
