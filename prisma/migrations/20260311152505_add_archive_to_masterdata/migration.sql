-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "EmployeeFunction" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false;
