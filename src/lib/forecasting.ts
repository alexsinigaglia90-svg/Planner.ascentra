/**
 * Forecasting v1 — weekday-pattern baseline.
 *
 * Method (transparent, no black-box):
 *   For each (weekday 0–6, shiftTemplateId) pair we compute the historical
 *   mean number of assigned, internal, and temp employees across all past days
 *   that share the same weekday.
 *
 *   Future dates inherit the mean for their corresponding weekday.
 *
 *   If no past data exists for a (weekday, template) pair, `hasHistory` is
 *   false and we conservatively forecast 0 assigned (worst-case gap).
 *
 * Not implemented yet — clear extension points for future iterations:
 *   - Weighted rolling average:   weight more recent weeks higher
 *   - Trend detection:            slope of assigned over time per (wd, template)
 *   - Seasonal adjustment:        multiply baseline by a seasonal index
 */

import type {
  AssignmentForMetrics,
  TemplateForMetrics,
  EmployeeForMetrics,
} from '@/lib/analytics'

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Historical pattern for one (weekday × shiftTemplate) pair.
 * Weekday follows JS convention: 0 = Sunday … 6 = Saturday.
 */
export interface WeekdayPattern {
  weekday: number
  templateId: string
  templateName: string
  requiredPerDay: number
  /** Calendar days in the history set that have this weekday. */
  totalHistoricalDays: number
  /**
   * Mean assigned across ALL historical days with this weekday
   * (including days where the slot had zero assignments).
   * This is the numerator for future forecasts.
   */
  averageAssigned: number
  averageInternal: number
  averageTemp: number
  /** requiredPerDay − averageAssigned; positive = historical shortfall. */
  averageGap: number
}

/** One forecast row: a single future date × shift template. */
export interface ForecastEntry {
  date: string
  weekday: number
  template: TemplateForMetrics
  required: number
  /** Integer-rounded predicted assignment count. */
  forecastedAssigned: number
  /** required − forecastedAssigned */
  forecastedGap: number
  /** max(0, forecastedGap) — open slots we expect to need filling. */
  forecastedOpen: number
  forecastedInternal: number
  forecastedTemp: number
  /**
   * True when this forecast is backed by real historical observations.
   * False = conservative fallback (0 assigned).
   */
  hasHistory: boolean
  /** Number of past days used to compute this forecast. */
  sampleSize: number
}

/** All forecast entries for a set of future dates, plus metadata. */
export interface ForecastResult {
  entries: ForecastEntry[]
  /** Earliest future date in the result set. */
  startDate: string
  /** Latest future date in the result set. */
  endDate: string
  /** Total distinct past days used for any pattern (for UI attribution). */
  totalHistoricalDaysConsidered: number
}

// ── Core: build weekday patterns from history ─────────────────────────────────

/**
 * Builds one `WeekdayPattern` per (weekday × template) from all assignments
 * whose roster date is strictly before `today`.
 *
 * Safe to call with an empty assignments array — returns zero-filled patterns.
 */
export function computeWeekdayPatterns({
  assignments,
  templates,
  employees,
  today,
}: {
  assignments: AssignmentForMetrics[]
  templates: TemplateForMetrics[]
  employees: EmployeeForMetrics[]
  today: string
}): WeekdayPattern[] {
  const employeeMap = new Map<string, EmployeeForMetrics>(
    employees.map((e) => [e.id, e]),
  )

  // Collect all unique past dates (< today)
  const pastDateSet = new Set<string>()
  for (const a of assignments) {
    if (a.rosterDay.date < today) pastDateSet.add(a.rosterDay.date)
  }
  const pastDates = Array.from(pastDateSet)

  // Map: weekday → set of past dates
  const datesByWeekday = new Map<number, string[]>()
  for (const date of pastDates) {
    const wd = new Date(date + 'T00:00:00').getDay()
    if (!datesByWeekday.has(wd)) datesByWeekday.set(wd, [])
    datesByWeekday.get(wd)!.push(date)
  }

  // Slot map: `${date}:${templateId}` → { assigned, internal, temp }
  type Slot = { assigned: number; internal: number; temp: number }
  const slotMap = new Map<string, Slot>()
  for (const a of assignments) {
    if (a.rosterDay.date >= today) continue
    const key = `${a.rosterDay.date}:${a.shiftTemplateId}`
    const isInternal = employeeMap.get(a.employeeId)?.employeeType !== 'temp'
    const slot = slotMap.get(key) ?? { assigned: 0, internal: 0, temp: 0 }
    slot.assigned++
    if (isInternal) slot.internal++; else slot.temp++
    slotMap.set(key, slot)
  }

  const patterns: WeekdayPattern[] = []

  for (let wd = 0; wd <= 6; wd++) {
    const daysForWd = datesByWeekday.get(wd) ?? []
    const n = daysForWd.length

    for (const tpl of templates) {
      let totalAssigned = 0
      let totalInternal = 0
      let totalTemp = 0

      for (const date of daysForWd) {
        const slot = slotMap.get(`${date}:${tpl.id}`) ?? { assigned: 0, internal: 0, temp: 0 }
        totalAssigned += slot.assigned
        totalInternal += slot.internal
        totalTemp += slot.temp
      }

      const avg = n > 0 ? totalAssigned / n : 0
      const avgInt = n > 0 ? totalInternal / n : 0
      const avgTemp = n > 0 ? totalTemp / n : 0

      patterns.push({
        weekday: wd,
        templateId: tpl.id,
        templateName: tpl.name,
        requiredPerDay: tpl.requiredEmployees,
        totalHistoricalDays: n,
        averageAssigned: avg,
        averageInternal: avgInt,
        averageTemp: avgTemp,
        averageGap: tpl.requiredEmployees - avg,
      })
    }
  }

  return patterns
}

// ── Core: generate forecast entries for future dates ─────────────────────────

/**
 * For each date in `futureDates`, look up the weekday pattern for every
 * template and emit one `ForecastEntry`.
 *
 * Caller is responsible for passing only dates that are genuinely in the
 * future (> today).
 */
export function generateForecast({
  futureDates,
  patterns,
  templates,
}: {
  futureDates: string[]
  patterns: WeekdayPattern[]
  templates: TemplateForMetrics[]
}): ForecastResult {
  if (futureDates.length === 0 || templates.length === 0) {
    return { entries: [], startDate: '', endDate: '', totalHistoricalDaysConsidered: 0 }
  }

  // O(1) lookup index
  const patternIndex = new Map<string, WeekdayPattern>()
  for (const p of patterns) {
    patternIndex.set(`${p.weekday}:${p.templateId}`, p)
  }

  let maxHistoricalDays = 0
  const entries: ForecastEntry[] = []

  for (const date of futureDates) {
    const weekday = new Date(date + 'T00:00:00').getDay()
    for (const tpl of templates) {
      const pattern = patternIndex.get(`${weekday}:${tpl.id}`)
      const sampleSize = pattern?.totalHistoricalDays ?? 0
      const hasHistory = sampleSize > 0

      const forecastedAssigned = Math.max(0, Math.round(pattern?.averageAssigned ?? 0))
      const forecastedInternal = Math.max(0, Math.round(pattern?.averageInternal ?? 0))
      const forecastedTemp = Math.max(0, Math.round(pattern?.averageTemp ?? 0))
      const forecastedGap = tpl.requiredEmployees - forecastedAssigned
      const forecastedOpen = Math.max(0, forecastedGap)

      if (sampleSize > maxHistoricalDays) maxHistoricalDays = sampleSize

      entries.push({
        date,
        weekday,
        template: tpl,
        required: tpl.requiredEmployees,
        forecastedAssigned,
        forecastedGap,
        forecastedOpen,
        forecastedInternal,
        forecastedTemp,
        hasHistory,
        sampleSize,
      })
    }
  }

  return {
    entries,
    startDate: futureDates[0]!,
    endDate: futureDates[futureDates.length - 1]!,
    totalHistoricalDaysConsidered: maxHistoricalDays,
  }
}
