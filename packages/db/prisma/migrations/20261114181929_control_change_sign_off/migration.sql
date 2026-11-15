-- CreateTable
CREATE TABLE "ControlChangeRequest" (
    "id" TEXT NOT NULL,
    "controlKey" TEXT NOT NULL,
    "fromEnabled" BOOLEAN NOT NULL,
    "toEnabled" BOOLEAN NOT NULL,
    "risk" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT NOT NULL,
    "decidedBy" TEXT,
    "decisionReason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ControlChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ControlChangeRequest_status_idx" ON "ControlChangeRequest"("status");

-- CreateIndex
CREATE INDEX "ControlChangeRequest_controlKey_idx" ON "ControlChangeRequest"("controlKey");
