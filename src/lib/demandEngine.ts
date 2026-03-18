/**
 * Demand Engine — econometric volume-to-staffing calculation.
 *
 * Converts volume forecasts into required FTE headcounts per process per day,
 * using process norms (normPerHour) and skill-weighted efficiency factors.
 *
 * Production function: L*(d,j) = V(d,j) / (p(j) × e(j,d))
 * Where:
 *   L* = required labour hours
 *   V  = forecast volume
 *   p  = norm per hour (from Process)
 *   e  = efficiency factor (from skill mix)
 *
 * Efficiency weights per skill level:
 *   Level 0: 0.0  (not deployable)
 *   Level 1: 0.5  (in training, half productivity)
 *   Level 2: 0.85 (operational, slightly below norm)
 *   Level 3: 1.0  (norm — reference point)
 *   Level 4: 1.15 (above norm)
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VolumeForecastEntry {
  processId: string
  date: string
  volume: number
  confidence: 'firm' | 'provisional'
  source: 'manual' | 'import' | 'api'
}

export interface ProcessNorm {
  id: string
  name: string
  normUnit: string | null
  normPerHour: number | null
  departmentId: string | null
}

export interface DemandResult {
  processId: string
  processName: string
  date: string
  volume: number
  normPerHour: number
  requiredHours: number
  requiredFTE: number           // at given shift length
  efficiency: number            // 0-1.15
  confidence: 'firm' | 'provisional'
  // Confidence bands
  requiredFTE_P10: number       // optimistic (90th percentile efficiency)
  requiredFTE_P50: number       // median
  requiredFTE_P90: number       // pessimistic (10th percentile efficiency)
}

export interface DailyDemandSummary {
  date: string
  totalRequiredHours: number
  totalRequiredFTE: number
  byProcess: DemandResult[]
  byDepartment: { departmentId: string; requiredFTE: number; requiredHours: number }[]
}

// ─── Efficiency calculation ──────────────────────────────────────────────────

const LEVEL_EFFICIENCY: Record<number, number> = {
  0: 0.0,
  1: 0.5,
  2: 0.85,
  3: 1.0,
  4: 1.15,
}

/**
 * Calculate efficiency factor for a process based on the skill mix
 * of available employees.
 *
 * If no employees have scored on this process, returns 1.0 (norm assumption).
 */
export function calculateEfficiency(
  processId: string,
  employeeLevels: { employeeId: string; level: number }[],
): number {
  const relevant = employeeLevels.filter((e) => e.level > 0)
  if (relevant.length === 0) return 1.0

  const weightedSum = relevant.reduce(
    (sum, e) => sum + (LEVEL_EFFICIENCY[e.level] ?? 1.0),
    0,
  )
  return weightedSum / relevant.length
}

// ─── Core demand calculation ─────────────────────────────────────────────────

/**
 * Calculate staffing demand from volume forecasts.
 *
 * @param forecasts  Volume forecasts per process per day
 * @param processes  Process definitions with norms
 * @param shiftHours Length of a shift in hours (default 8)
 * @param processEfficiencies  Optional pre-calculated efficiency per process
 */
export function calculateDemand({
  forecasts,
  processes,
  shiftHours = 8,
  processEfficiencies,
}: {
  forecasts: VolumeForecastEntry[]
  processes: ProcessNorm[]
  shiftHours?: number
  processEfficiencies?: Map<string, number>
}): DemandResult[] {
  const processMap = new Map(processes.map((p) => [p.id, p]))
  const results: DemandResult[] = []

  for (const forecast of forecasts) {
    const proc = processMap.get(forecast.processId)
    if (!proc || !proc.normPerHour || proc.normPerHour <= 0) continue

    const efficiency = processEfficiencies?.get(forecast.processId) ?? 1.0
    const effectiveNorm = proc.normPerHour * efficiency
    const requiredHours = forecast.volume / effectiveNorm
    const requiredFTE = requiredHours / shiftHours

    // Confidence bands based on forecast uncertainty
    // P10: optimistic (volume 10% lower, efficiency 10% higher)
    // P50: median (as calculated)
    // P90: pessimistic (volume 15% higher, efficiency 10% lower)
    const volumeVariance = forecast.confidence === 'firm' ? 0.08 : 0.20
    const efficiencyVariance = 0.10

    const p10Volume = forecast.volume * (1 - volumeVariance)
    const p10Efficiency = Math.min(1.15, efficiency * (1 + efficiencyVariance))
    const p10Hours = p10Volume / (proc.normPerHour * p10Efficiency)
    const requiredFTE_P10 = p10Hours / shiftHours

    const requiredFTE_P50 = requiredFTE

    const p90Volume = forecast.volume * (1 + volumeVariance * 1.5)
    const p90Efficiency = Math.max(0.5, efficiency * (1 - efficiencyVariance))
    const p90Hours = p90Volume / (proc.normPerHour * p90Efficiency)
    const requiredFTE_P90 = p90Hours / shiftHours

    results.push({
      processId: forecast.processId,
      processName: proc.name,
      date: forecast.date,
      volume: forecast.volume,
      normPerHour: proc.normPerHour,
      requiredHours,
      requiredFTE,
      efficiency,
      confidence: forecast.confidence,
      requiredFTE_P10,
      requiredFTE_P50,
      requiredFTE_P90,
    })
  }

  return results
}

/**
 * Aggregate demand results into daily summaries.
 */
export function aggregateDailyDemand(
  results: DemandResult[],
  processes: ProcessNorm[],
): DailyDemandSummary[] {
  const processMap = new Map(processes.map((p) => [p.id, p]))
  const byDate = new Map<string, DemandResult[]>()

  for (const r of results) {
    const list = byDate.get(r.date) ?? []
    list.push(r)
    byDate.set(r.date, list)
  }

  const summaries: DailyDemandSummary[] = []

  for (const [date, dayResults] of byDate) {
    const totalRequiredHours = dayResults.reduce((s, r) => s + r.requiredHours, 0)
    const totalRequiredFTE = dayResults.reduce((s, r) => s + r.requiredFTE, 0)

    // Aggregate by department
    const deptMap = new Map<string, { requiredFTE: number; requiredHours: number }>()
    for (const r of dayResults) {
      const proc = processMap.get(r.processId)
      const deptId = proc?.departmentId ?? '__unassigned__'
      const entry = deptMap.get(deptId) ?? { requiredFTE: 0, requiredHours: 0 }
      entry.requiredFTE += r.requiredFTE
      entry.requiredHours += r.requiredHours
      deptMap.set(deptId, entry)
    }

    summaries.push({
      date,
      totalRequiredHours,
      totalRequiredFTE,
      byProcess: dayResults,
      byDepartment: Array.from(deptMap.entries()).map(([departmentId, data]) => ({
        departmentId,
        ...data,
      })),
    })
  }

  return summaries.sort((a, b) => a.date.localeCompare(b.date))
}

// ─── Forecast accuracy ──────────────────────────────────────────────────────

export interface ForecastAccuracy {
  processId: string
  processName: string
  mape: number       // Mean Absolute Percentage Error
  bias: number       // positive = overforecast, negative = underforecast
  dataPoints: number
}

/**
 * Calculate forecast accuracy (MAPE and bias) by comparing
 * forecast volumes against actual volumes.
 */
export function calculateForecastAccuracy(
  forecasts: { processId: string; date: string; volume: number }[],
  actuals: { processId: string; date: string; volume: number }[],
  processes: ProcessNorm[],
): ForecastAccuracy[] {
  const actualMap = new Map(
    actuals.map((a) => [`${a.processId}:${a.date}`, a.volume]),
  )
  const processMap = new Map(processes.map((p) => [p.id, p]))

  // Group by process
  const byProcess = new Map<string, { errors: number[]; biases: number[] }>()

  for (const f of forecasts) {
    const actual = actualMap.get(`${f.processId}:${f.date}`)
    if (actual === undefined || actual === 0) continue

    const entry = byProcess.get(f.processId) ?? { errors: [], biases: [] }
    entry.errors.push(Math.abs(f.volume - actual) / actual)
    entry.biases.push((f.volume - actual) / actual)
    byProcess.set(f.processId, entry)
  }

  return Array.from(byProcess.entries()).map(([processId, data]) => {
    const proc = processMap.get(processId)
    return {
      processId,
      processName: proc?.name ?? 'Unknown',
      mape: data.errors.reduce((s, e) => s + e, 0) / data.errors.length,
      bias: data.biases.reduce((s, b) => s + b, 0) / data.biases.length,
      dataPoints: data.errors.length,
    }
  })
}

// ─── Seasonal pattern detection ──────────────────────────────────────────────

export interface SeasonalPattern {
  processId: string
  processName: string
  weekdayIndices: Record<string, number> // Monday=1.0 means average, 1.3 means 30% above average
  hasPattern: boolean
}

/**
 * Detect weekday seasonality from historical volume data.
 * Requires at least 4 weeks of data to produce reliable indices.
 */
export function detectSeasonalPatterns(
  historicalVolumes: { processId: string; date: string; volume: number }[],
  processes: ProcessNorm[],
): SeasonalPattern[] {
  const processMap = new Map(processes.map((p) => [p.id, p]))
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  // Group by process
  const byProcess = new Map<string, Map<string, number[]>>() // processId → weekday → volumes

  for (const v of historicalVolumes) {
    const d = new Date(v.date + 'T00:00:00')
    const weekday = WEEKDAYS[d.getDay()]
    if (weekday === 'Sunday' || weekday === 'Saturday') continue

    const processEntry = byProcess.get(v.processId) ?? new Map<string, number[]>()
    const dayEntry = processEntry.get(weekday) ?? []
    dayEntry.push(v.volume)
    processEntry.set(weekday, dayEntry)
    byProcess.set(v.processId, processEntry)
  }

  return Array.from(byProcess.entries()).map(([processId, weekdayVolumes]) => {
    const proc = processMap.get(processId)
    const allVolumes: number[] = []
    weekdayVolumes.forEach((vols) => allVolumes.push(...vols))

    const overallAvg = allVolumes.length > 0
      ? allVolumes.reduce((s, v) => s + v, 0) / allVolumes.length
      : 1

    const weekdayIndices: Record<string, number> = {}
    let hasSignificantVariation = false

    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      const vols = weekdayVolumes.get(day) ?? []
      if (vols.length < 4) {
        weekdayIndices[day] = 1.0
        continue
      }
      const dayAvg = vols.reduce((s, v) => s + v, 0) / vols.length
      const index = overallAvg > 0 ? dayAvg / overallAvg : 1.0
      weekdayIndices[day] = Math.round(index * 100) / 100

      if (Math.abs(index - 1.0) > 0.1) hasSignificantVariation = true
    }

    return {
      processId,
      processName: proc?.name ?? 'Unknown',
      weekdayIndices,
      hasPattern: hasSignificantVariation,
    }
  })
}
