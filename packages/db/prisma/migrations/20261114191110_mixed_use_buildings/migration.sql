-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "buildingId" TEXT;

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "landlordId" TEXT NOT NULL,
    "addressRaw" TEXT NOT NULL,
    "use" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Building_reference_key" ON "Building"("reference");

-- CreateIndex
CREATE INDEX "Building_landlordId_idx" ON "Building"("landlordId");

-- CreateIndex
CREATE INDEX "Property_buildingId_idx" ON "Property"("buildingId");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;
