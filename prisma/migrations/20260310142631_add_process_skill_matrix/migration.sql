-- CreateTable
CREATE TABLE "Process" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Process_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeProcessScore" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeProcessScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Process_organizationId_sortOrder_idx" ON "Process"("organizationId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Process_organizationId_name_key" ON "Process"("organizationId", "name");

-- CreateIndex
CREATE INDEX "EmployeeProcessScore_organizationId_idx" ON "EmployeeProcessScore"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeProcessScore_employeeId_processId_key" ON "EmployeeProcessScore"("employeeId", "processId");

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeProcessScore" ADD CONSTRAINT "EmployeeProcessScore_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeProcessScore" ADD CONSTRAINT "EmployeeProcessScore_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE;
