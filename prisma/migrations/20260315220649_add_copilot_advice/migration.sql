-- CreateTable
CREATE TABLE "CopilotAdvice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "action" TEXT,
    "estimatedSavings" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'active',
    "departmentId" TEXT,
    "departmentName" TEXT,
    "processId" TEXT,
    "employeeId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "actualSavings" DOUBLE PRECISION,

    CONSTRAINT "CopilotAdvice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CopilotAdvice_organizationId_status_idx" ON "CopilotAdvice"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CopilotAdvice_organizationId_type_idx" ON "CopilotAdvice"("organizationId", "type");

-- CreateIndex
CREATE INDEX "CopilotAdvice_organizationId_createdAt_idx" ON "CopilotAdvice"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "CopilotAdvice" ADD CONSTRAINT "CopilotAdvice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
