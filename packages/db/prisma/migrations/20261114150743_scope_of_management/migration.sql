-- CreateTable
CREATE TABLE "ScopeOfManagement" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "landlordId" TEXT NOT NULL,
    "rentCollection" BOOLEAN NOT NULL DEFAULT true,
    "maintenance" BOOLEAN NOT NULL DEFAULT true,
    "notices" BOOLEAN NOT NULL DEFAULT true,
    "inspections" BOOLEAN NOT NULL DEFAULT true,
    "renewals" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'AGREED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "agreedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScopeOfManagement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScopeOfManagement_propertyId_key" ON "ScopeOfManagement"("propertyId");
