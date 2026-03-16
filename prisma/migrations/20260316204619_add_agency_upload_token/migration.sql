-- CreateTable
CREATE TABLE "AgencyUploadToken" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "agencyName" TEXT NOT NULL,
    "agencyEmail" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "uploadedCount" INTEGER,
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyUploadToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgencyUploadToken_token_key" ON "AgencyUploadToken"("token");

-- CreateIndex
CREATE INDEX "AgencyUploadToken_organizationId_idx" ON "AgencyUploadToken"("organizationId");

-- CreateIndex
CREATE INDEX "AgencyUploadToken_token_idx" ON "AgencyUploadToken"("token");

-- AddForeignKey
ALTER TABLE "AgencyUploadToken" ADD CONSTRAINT "AgencyUploadToken_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
