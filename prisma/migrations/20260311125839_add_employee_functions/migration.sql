-- CreateTable: EmployeeFunction — job function / role labels with overhead flag
CREATE TABLE "EmployeeFunction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "overhead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeFunction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeFunction_organizationId_name_key" ON "EmployeeFunction"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "EmployeeFunction" ADD CONSTRAINT "EmployeeFunction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: add nullable functionId to Employee (backward-compatible — existing rows keep NULL)
ALTER TABLE "Employee" ADD COLUMN "functionId" TEXT;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "EmployeeFunction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
