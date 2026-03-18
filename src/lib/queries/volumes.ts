import { prisma } from '@/lib/db/client'
import type { VolumeForecast, VolumeActual } from '@prisma/client'

export type { VolumeForecast, VolumeActual }

/**
 * Get all volume forecasts for a date range.
 */
export async function getVolumeForecasts(
  organizationId: string,
  startDate?: string,
  endDate?: string,
): Promise<VolumeForecast[]> {
  return prisma.volumeForecast.findMany({
    where: {
      organizationId,
      ...(startDate && endDate ? { date: { gte: startDate, lte: endDate } } : {}),
    },
    orderBy: [{ date: 'asc' }, { processId: 'asc' }],
  })
}

/**
 * Get volume forecasts grouped by process.
 */
export async function getVolumeForecastsByProcess(
  organizationId: string,
  processId: string,
  startDate?: string,
  endDate?: string,
): Promise<VolumeForecast[]> {
  return prisma.volumeForecast.findMany({
    where: {
      organizationId,
      processId,
      ...(startDate && endDate ? { date: { gte: startDate, lte: endDate } } : {}),
    },
    orderBy: { date: 'asc' },
  })
}

/**
 * Get volume actuals for forecast accuracy comparison.
 */
export async function getVolumeActuals(
  organizationId: string,
  startDate?: string,
  endDate?: string,
): Promise<VolumeActual[]> {
  return prisma.volumeActual.findMany({
    where: {
      organizationId,
      ...(startDate && endDate ? { date: { gte: startDate, lte: endDate } } : {}),
    },
    orderBy: [{ date: 'asc' }, { processId: 'asc' }],
  })
}

/**
 * Upsert a single volume forecast entry.
 */
export async function upsertVolumeForecast(data: {
  organizationId: string
  processId: string
  date: string
  volume: number
  source?: string
  confidence?: string
  notes?: string
}): Promise<VolumeForecast> {
  const { organizationId, processId, date, volume, source, confidence, notes } = data
  return prisma.volumeForecast.upsert({
    where: {
      organizationId_processId_date: { organizationId, processId, date },
    },
    create: {
      organizationId,
      processId,
      date,
      volume,
      source: source ?? 'manual',
      confidence: confidence ?? 'firm',
      notes,
    },
    update: {
      volume,
      ...(source !== undefined ? { source } : {}),
      ...(confidence !== undefined ? { confidence } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
  })
}

/**
 * Bulk upsert volume forecasts (for grid save / CSV import).
 */
export async function bulkUpsertVolumeForecasts(
  entries: {
    organizationId: string
    processId: string
    date: string
    volume: number
    source?: string
    confidence?: string
  }[],
): Promise<number> {
  if (entries.length === 0) return 0

  const ops = entries.map((e) =>
    prisma.volumeForecast.upsert({
      where: {
        organizationId_processId_date: {
          organizationId: e.organizationId,
          processId: e.processId,
          date: e.date,
        },
      },
      create: {
        organizationId: e.organizationId,
        processId: e.processId,
        date: e.date,
        volume: e.volume,
        source: e.source ?? 'manual',
        confidence: e.confidence ?? 'firm',
      },
      update: {
        volume: e.volume,
        ...(e.source ? { source: e.source } : {}),
        ...(e.confidence ? { confidence: e.confidence } : {}),
      },
    }),
  )

  const results = await prisma.$transaction(ops)
  return results.length
}

/**
 * Upsert a single volume actual entry.
 */
export async function upsertVolumeActual(data: {
  organizationId: string
  processId: string
  date: string
  volume: number
}): Promise<VolumeActual> {
  const { organizationId, processId, date, volume } = data
  return prisma.volumeActual.upsert({
    where: {
      organizationId_processId_date: { organizationId, processId, date },
    },
    create: { organizationId, processId, date, volume },
    update: { volume },
  })
}
