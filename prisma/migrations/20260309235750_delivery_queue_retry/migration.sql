-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DeliveryLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "templateData" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    CONSTRAINT "DeliveryLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DeliveryLog" ("createdAt", "errorMessage", "id", "organizationId", "recipient", "sentAt", "status", "subject", "templateData", "type", "userId") SELECT "createdAt", "errorMessage", "id", "organizationId", "recipient", "sentAt", "status", "subject", "templateData", "type", "userId" FROM "DeliveryLog";
DROP TABLE "DeliveryLog";
ALTER TABLE "new_DeliveryLog" RENAME TO "DeliveryLog";
CREATE INDEX "DeliveryLog_organizationId_createdAt_idx" ON "DeliveryLog"("organizationId", "createdAt");
CREATE INDEX "DeliveryLog_organizationId_status_idx" ON "DeliveryLog"("organizationId", "status");
CREATE INDEX "DeliveryLog_status_nextRetryAt_idx" ON "DeliveryLog"("status", "nextRetryAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
