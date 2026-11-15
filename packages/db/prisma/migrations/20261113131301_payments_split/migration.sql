-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "authorizationUrl" TEXT,
ADD COLUMN     "feeKobo" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "netKobo" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "payerEmail" TEXT,
ADD COLUMN     "providerRef" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'SUCCESS';

-- CreateIndex
CREATE INDEX "Payment_reference_idx" ON "Payment"("reference");
