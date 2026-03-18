'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext, canMutate } from '@/lib/auth/context'
import { upsertVolumeForecast, bulkUpsertVolumeForecasts } from '@/lib/queries/volumes'

/**
 * Save a single volume forecast cell (from the grid).
 */
export async function saveVolumeForecastAction(data: {
  processId: string
  date: string
  volume: number
  confidence?: string
}): Promise<{ ok: boolean; error?: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'Geen rechten.' }

  try {
    await upsertVolumeForecast({
      organizationId: orgId,
      processId: data.processId,
      date: data.date,
      volume: data.volume,
      source: 'manual',
      confidence: data.confidence ?? 'firm',
    })
    revalidatePath('/demand')
    return { ok: true }
  } catch (err) {
    console.error('saveVolumeForecastAction error:', err)
    return { ok: false, error: 'Kon volume niet opslaan.' }
  }
}

/**
 * Bulk save volume forecasts (entire grid save or CSV import).
 */
export async function bulkSaveVolumeForecastsAction(entries: {
  processId: string
  date: string
  volume: number
  confidence?: string
  source?: string
}[]): Promise<{ ok: boolean; count?: number; error?: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'Geen rechten.' }

  try {
    const count = await bulkUpsertVolumeForecasts(
      entries.map((e) => ({
        organizationId: orgId,
        processId: e.processId,
        date: e.date,
        volume: e.volume,
        source: e.source ?? 'manual',
        confidence: e.confidence ?? 'firm',
      })),
    )
    revalidatePath('/demand')
    revalidatePath('/planning2')
    return { ok: true, count }
  } catch (err) {
    console.error('bulkSaveVolumeForecastsAction error:', err)
    return { ok: false, error: 'Kon volumes niet opslaan.' }
  }
}

/**
 * Import volumes from CSV data (parsed client-side).
 */
export async function importVolumesFromCSVAction(rows: {
  processName: string
  date: string
  volume: number
}[]): Promise<{ ok: boolean; imported?: number; skipped?: number; error?: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'Geen rechten.' }

  try {
    // Resolve process names to IDs
    const { prisma } = await import('@/lib/db/client')
    const processes = await prisma.process.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
    })
    const processMap = new Map(processes.map((p) => [p.name.toLowerCase().trim(), p.id]))

    const entries: { organizationId: string; processId: string; date: string; volume: number; source: string }[] = []
    let skipped = 0

    for (const row of rows) {
      const processId = processMap.get(row.processName.toLowerCase().trim())
      if (!processId) {
        skipped++
        continue
      }
      if (isNaN(row.volume) || row.volume < 0) {
        skipped++
        continue
      }
      entries.push({
        organizationId: orgId,
        processId,
        date: row.date,
        volume: row.volume,
        source: 'import',
      })
    }

    const count = await bulkUpsertVolumeForecasts(entries)
    revalidatePath('/demand')
    revalidatePath('/planning2')
    return { ok: true, imported: count, skipped }
  } catch (err) {
    console.error('importVolumesFromCSVAction error:', err)
    return { ok: false, error: 'Import mislukt.' }
  }
}
