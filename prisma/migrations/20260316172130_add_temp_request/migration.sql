-- CreateTable
CREATE TABLE "TempRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "shiftTemplateId" TEXT,
    "departmentId" TEXT,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approvedBy" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "agencyName" TEXT,
    "agencyEmail" TEXT,
    "sentToAgencyAt" TIMESTAMP(3),
    "agencyResponse" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TempRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TempRequest_organizationId_status_idx" ON "TempRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "TempRequest_organizationId_createdAt_idx" ON "TempRequest"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "TempRequest" ADD CONSTRAINT "TempRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TempRequest" ADD CONSTRAINT "TempRequest_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "ShiftTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TempRequest" ADD CONSTRAINT "TempRequest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
