-- AlterTable
ALTER TABLE "Process" ADD COLUMN     "activeEndTime" TEXT,
ADD COLUMN     "activeStartTime" TEXT,
ADD COLUMN     "breakPriority" TEXT NOT NULL DEFAULT 'normal';

-- AlterTable
ALTER TABLE "ShiftTemplate" ADD COLUMN     "breakMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "breakMode" TEXT NOT NULL DEFAULT 'all',
ADD COLUMN     "breakWindowStart" TEXT;

-- CreateTable
CREATE TABLE "ProcessBreakCover" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceProcessId" TEXT NOT NULL,
    "targetProcessId" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ProcessBreakCover_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcessBreakCover_organizationId_sourceProcessId_targetProc_key" ON "ProcessBreakCover"("organizationId", "sourceProcessId", "targetProcessId");

-- AddForeignKey
ALTER TABLE "ProcessBreakCover" ADD CONSTRAINT "ProcessBreakCover_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessBreakCover" ADD CONSTRAINT "ProcessBreakCover_sourceProcessId_fkey" FOREIGN KEY ("sourceProcessId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessBreakCover" ADD CONSTRAINT "ProcessBreakCover_targetProcessId_fkey" FOREIGN KEY ("targetProcessId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE;
