-- CreateTable
CREATE TABLE "SkillReview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "previousLevel" INTEGER NOT NULL,
    "verdict" TEXT NOT NULL,
    "newLevel" INTEGER NOT NULL,
    "reviewedBy" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SkillReview_organizationId_period_idx" ON "SkillReview"("organizationId", "period");

-- CreateIndex
CREATE INDEX "SkillReview_organizationId_employeeId_idx" ON "SkillReview"("organizationId", "employeeId");

-- CreateIndex
CREATE INDEX "SkillReview_organizationId_processId_idx" ON "SkillReview"("organizationId", "processId");

-- CreateIndex
CREATE INDEX "SkillReview_employeeId_processId_createdAt_idx" ON "SkillReview"("employeeId", "processId", "createdAt");

-- AddForeignKey
ALTER TABLE "SkillReview" ADD CONSTRAINT "SkillReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillReview" ADD CONSTRAINT "SkillReview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillReview" ADD CONSTRAINT "SkillReview_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE;
