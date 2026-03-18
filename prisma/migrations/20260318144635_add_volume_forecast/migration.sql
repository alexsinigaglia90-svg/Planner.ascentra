-- CreateTable
CREATE TABLE "VolumeForecast" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "confidence" TEXT NOT NULL DEFAULT 'firm',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VolumeForecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolumeActual" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VolumeActual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VolumeForecast_organizationId_date_idx" ON "VolumeForecast"("organizationId", "date");

-- CreateIndex
CREATE INDEX "VolumeForecast_processId_date_idx" ON "VolumeForecast"("processId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "VolumeForecast_organizationId_processId_date_key" ON "VolumeForecast"("organizationId", "processId", "date");

-- CreateIndex
CREATE INDEX "VolumeActual_organizationId_date_idx" ON "VolumeActual"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "VolumeActual_organizationId_processId_date_key" ON "VolumeActual"("organizationId", "processId", "date");

-- AddForeignKey
ALTER TABLE "VolumeForecast" ADD CONSTRAINT "VolumeForecast_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolumeForecast" ADD CONSTRAINT "VolumeForecast_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolumeActual" ADD CONSTRAINT "VolumeActual_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolumeActual" ADD CONSTRAINT "VolumeActual_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE;
