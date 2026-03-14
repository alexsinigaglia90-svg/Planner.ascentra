-- AlterTable: add planning fields to Process
ALTER TABLE "Process" ADD COLUMN "departmentId"     TEXT;
ALTER TABLE "Process" ADD COLUMN "normUnit"         TEXT;
ALTER TABLE "Process" ADD COLUMN "normPerHour"      INTEGER;
ALTER TABLE "Process" ADD COLUMN "minStaff"         INTEGER;
ALTER TABLE "Process" ADD COLUMN "maxStaff"         INTEGER;
ALTER TABLE "Process" ADD COLUMN "requiredSkillId"  TEXT;
ALTER TABLE "Process" ADD COLUMN "active"           BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_requiredSkillId_fkey"
  FOREIGN KEY ("requiredSkillId") REFERENCES "Skill"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
