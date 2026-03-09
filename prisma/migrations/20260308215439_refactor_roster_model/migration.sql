/*
  Warnings:

  - You are about to drop the `Shift` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `shiftId` on the `Assignment` table. All the data in the column will be lost.
  - Added the required column `rosterDayId` to the `Assignment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shiftTemplateId` to the `Assignment` table without a default value. This is not possible if the table is not empty.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Shift";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "RosterDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rosterDayId" TEXT NOT NULL,
    "shiftTemplateId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "notes" TEXT,
    CONSTRAINT "Assignment_rosterDayId_fkey" FOREIGN KEY ("rosterDayId") REFERENCES "RosterDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Assignment_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "ShiftTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Assignment" ("employeeId", "id", "notes") SELECT "employeeId", "id", "notes" FROM "Assignment";
DROP TABLE "Assignment";
ALTER TABLE "new_Assignment" RENAME TO "Assignment";
CREATE UNIQUE INDEX "Assignment_rosterDayId_shiftTemplateId_employeeId_key" ON "Assignment"("rosterDayId", "shiftTemplateId", "employeeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "RosterDay_date_key" ON "RosterDay"("date");
