/**
 * Demand Bridge — connects volume forecasts to the planning engine.
 *
 * This is the missing link between:
 *   - Demand Engine (volume → FTE calculation, informational)
 *   - Planning Engine (headcount slots → staffing → autofill)
 *
 * Flow:
 *   VolumeForecast (per process per day)
 *   × Process.normPerHour (productivity norm)
 *   ÷ Efficiency factor (from skill mix)
 *   → Required labour hours per process per day
 *   → Distributed across shifts via ProcessShiftLink
 *   → ManpowerTarget per shift per weekday
 *
 * The ManpowerTarget is consumed by manpower.ts as tier-1 priority,
 * which feeds into staffing.ts → scoring.ts → autofill.ts.
 */

import type { ManpowerTarget, WeekdayName } from './manpower'
import { getWeekday } from './manpower'
import { calculateEfficiency, type ProcessNorm, type VolumeForecastEntry } from './demandEngine'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProcessShiftLinkEntry {
  processId: string
  shiftTemplateId: string
}

export interface ShiftInfo {
  id: string
  startTime: string
  endTime: string
}

export interface BridgeInput {
  forecasts: VolumeForecastEntry[]
  processes: ProcessNorm[]
  processShiftLinks: ProcessShiftLinkEntry[]
  shifts: ShiftInfo[]
  /** Employee process scores for efficiency calculation */
  employeeScores: { processId: string; level: number }[]
  dates: string[]
}

export interface BridgeResult {
  /** ManpowerTarget per shift, ready to feed into manpower.ts */
  targets: Map<string, ManpowerTarget>
  /** Detailed breakdown for UI transparency */
  details: BridgeDetail[]
}

export interface BridgeDetail {
  date: string
  shiftTemplateId: string
  shiftName?: string
  totalRequiredFTE: number
  byProcess: {
    processId: string
    processName: string
    volume: number
    normPerHour: number
    efficiency: number
    requiredHours: number
    requiredFTE: number
  }[]
  source: 'volume-driven'
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseHHMM(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function shiftDurationHours(start: string, end: string): number {
  let mins = parseHHMM(end) - parseHHMM(start)
  if (mins <= 0) mins += 1440 // overnight shift
  return mins / 60
}

// ── Core bridge computation ──────────────────────────────────────────────────

/**
 * Compute ManpowerTargets from volume forecasts.
 *
 * For each date:
 *   1. Look up volume per process
 *   2. Calculate required labour hours: volume ÷ (normPerHour × efficiency)
 *   3. Find which shifts this process runs in (via ProcessShiftLink)
 *   4. Distribute hours proportionally across those shifts
 *   5. Convert hours to FTE (hours ÷ shift duration)
 *   6. Sum all process FTEs per shift → total required headcount
 *   7. Build ManpowerTarget with weekday headcounts
 */
export function computeDemandTargets(input: BridgeInput): BridgeResult {
  const targets = new Map<string, ManpowerTarget>()
  const details: BridgeDetail[] = []

  // Build lookup maps
  const processMap = new Map(input.processes.map((p) => [p.id, p]))
  const shiftMap = new Map(input.shifts.map((s) => [s.id, s]))

  // ProcessShiftLink: processId → shiftTemplateIds
  const processToShifts = new Map<string, string[]>()
  for (const link of input.processShiftLinks) {
    const existing = processToShifts.get(link.processId) ?? []
    existing.push(link.shiftTemplateId)
    processToShifts.set(link.processId, existing)
  }

  // Volume forecast: processId:date → volume
  const volumeMap = new Map<string, VolumeForecastEntry>()
  for (const f of input.forecasts) {
    volumeMap.set(`${f.processId}:${f.date}`, f)
  }

  // Pre-compute efficiency per process
  const efficiencyMap = new Map<string, number>()
  for (const proc of input.processes) {
    const scores = input.employeeScores.filter((s) => s.processId === proc.id)
    const eff = calculateEfficiency(proc.id, scores.map((s) => ({ employeeId: '', level: s.level })))
    efficiencyMap.set(proc.id, eff)
  }

  // Per shift: accumulate FTE across all dates
  const shiftWeekdayFTE = new Map<string, Map<WeekdayName, number>>()

  for (const date of input.dates) {
    // Per shift: accumulate process FTEs for this date
    const shiftDateFTE = new Map<string, { total: number; byProcess: BridgeDetail['byProcess'] }>()

    for (const proc of input.processes) {
      if (!proc.normPerHour || proc.normPerHour <= 0) continue

      const forecast = volumeMap.get(`${proc.id}:${date}`)
      if (!forecast || forecast.volume <= 0) continue

      const efficiency = efficiencyMap.get(proc.id) ?? 1.0
      const effectiveNorm = proc.normPerHour * Math.max(0.1, efficiency)
      const requiredHours = forecast.volume / effectiveNorm

      // Find which shifts this process runs in
      const shiftIds = processToShifts.get(proc.id) ?? []
      if (shiftIds.length === 0) continue

      // Calculate total shift hours for proportional distribution
      const shiftDurations = shiftIds.map((sid) => {
        const s = shiftMap.get(sid)
        return s ? { id: sid, hours: shiftDurationHours(s.startTime, s.endTime) } : null
      }).filter((s): s is { id: string; hours: number } => s !== null)

      const totalShiftHours = shiftDurations.reduce((sum, s) => sum + s.hours, 0)
      if (totalShiftHours <= 0) continue

      // Distribute required hours proportionally across shifts
      for (const { id: shiftId, hours: shiftHours } of shiftDurations) {
        const proportion = shiftHours / totalShiftHours
        const processHoursInShift = requiredHours * proportion
        const processHeadcount = processHoursInShift / shiftHours

        const existing = shiftDateFTE.get(shiftId) ?? { total: 0, byProcess: [] }
        existing.total += processHeadcount
        existing.byProcess.push({
          processId: proc.id,
          processName: proc.name,
          volume: forecast.volume,
          normPerHour: proc.normPerHour,
          efficiency,
          requiredHours: processHoursInShift,
          requiredFTE: processHeadcount,
        })
        shiftDateFTE.set(shiftId, existing)
      }
    }

    // Build details and accumulate weekday targets
    for (const [shiftId, data] of shiftDateFTE) {
      const weekday = getWeekday(date)

      details.push({
        date,
        shiftTemplateId: shiftId,
        totalRequiredFTE: Math.ceil(data.total),
        byProcess: data.byProcess,
        source: 'volume-driven',
      })

      // Accumulate into weekday map
      const weekdayMap = shiftWeekdayFTE.get(shiftId) ?? new Map()
      const currentMax = weekdayMap.get(weekday) ?? 0
      // Use the maximum across all dates for the same weekday
      weekdayMap.set(weekday, Math.max(currentMax, Math.ceil(data.total)))
      shiftWeekdayFTE.set(shiftId, weekdayMap)
    }
  }

  // Convert accumulated weekday FTEs to ManpowerTargets
  for (const [shiftId, weekdayMap] of shiftWeekdayFTE) {
    const weekdayHeadcounts: Partial<Record<WeekdayName, number>> = {}
    for (const [weekday, fte] of weekdayMap) {
      weekdayHeadcounts[weekday] = fte
    }
    targets.set(shiftId, {
      shiftTemplateId: shiftId,
      weekdayHeadcounts,
    })
  }

  return { targets, details }
}
