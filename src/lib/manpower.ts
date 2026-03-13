/**
 * Manpower / Workload Foundation — Phase 5C
 *
 * This module owns the staffing demand resolution layer.
 * It sits between raw configuration data (ShiftTemplate.requiredEmployees,
 * ShiftRequirement table) and the staffing-analysis consumers (staffing.ts,
 * ops.ts, autofill flow).
 *
 * ─── Demand resolution priority chain ────────────────────────────────────────
 *
 *   1. ManpowerTarget weekday override   — per-shift, per-day-of-week headcount
 *      (highest priority; intended for workload-driven demand inputs in later phases)
 *
 *   2. ShiftRequirement override         — org-level static override per shift
 *      (currently editable on the /shifts page via ShiftTemplateTable)
 *
 *   3. ShiftTemplate.requiredEmployees   — template default
 *      (fallback; always present)
 *
 * ─── Extension points ─────────────────────────────────────────────────────────
 *
 *   ManpowerTarget.weekdayHeadcounts is intentionally generic: later phases can
 *   populate it from:
 *     - Volume-based targets (units per hour × target productivity → headcount)
 *     - Historical demand patterns per weekday
 *     - Manual daily planning targets entered by planners
 *
 *   To wire up a future workload source, fetch/compute ManpowerTarget rows and
 *   pass them as `targetsMap` to analyzeStaffing() or buildDemandMap().
 *   No other code needs to change.
 *
 * ─── Design principles ───────────────────────────────────────────────────────
 *   - Pure functions only; no DB calls, no side effects
 *   - All params optional at call sites — safe to call with partial data
 *   - `source` field on ShiftDemand traces where the resolved value came from
 *     (useful for planner UI transparency in later phases)
 */

// ─── Weekday type ─────────────────────────────────────────────────────────────

export type WeekdayName =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday'

const WEEKDAY_NAMES: WeekdayName[] = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
]

/** Derive the calendar weekday from an ISO date string (YYYY-MM-DD). Pure. */
export function getWeekday(date: string): WeekdayName {
  return WEEKDAY_NAMES[new Date(date + 'T00:00:00').getDay()]
}

// ─── Manpower target (configuration) ─────────────────────────────────────────

/**
 * Per-shift staffing demand configuration.
 *
 * A ManpowerTarget extends the static ShiftRequirement with day-of-week-specific
 * headcount overrides.  All fields are optional — the target acts as an additive
 * layer that narrows only the fields explicitly provided, leaving everything else
 * to fall through the priority chain.
 *
 * This is the primary extension point for workload-driven demand in later phases.
 */
export interface ManpowerTarget {
  shiftTemplateId: string
  /**
   * Day-of-week headcount overrides.
   * Takes priority over ShiftRequirement when set for the relevant weekday.
   * Example: { Monday: 12, Tuesday: 10, Saturday: 6 }
   */
  weekdayHeadcounts?: Partial<Record<WeekdayName, number>>
}

// ─── Resolved demand ──────────────────────────────────────────────────────────

/** Source of the resolved headcount value — for traceability. */
export type DemandSource = 'weekday_target' | 'shift_requirement' | 'template_default'

/**
 * Resolved staffing demand for a single (shiftTemplate, date) pair.
 * Produced by resolveRequiredHeadcount / buildDemandMap.
 */
export interface ShiftDemand {
  shiftTemplateId: string
  date: string
  weekday: WeekdayName
  /** Final resolved headcount after applying the full priority chain. */
  requiredHeadcount: number
  /** Which layer of the priority chain produced this value. */
  source: DemandSource
}

// ─── Core resolver ────────────────────────────────────────────────────────────

/**
 * Resolve the required headcount for a single shift on a specific date.
 *
 * Priority chain (highest wins):
 *   1. ManpowerTarget weekday override    (workload-driven, future phases)
 *   2. ShiftRequirement override          (static org config, currently editable)
 *   3. ShiftTemplate.requiredEmployees    (template default, always present)
 *
 * Safe to call with any combination of optional params — always returns a valid
 * non-negative integer.
 */
export function resolveRequiredHeadcount({
  date,
  templateDefault,
  shiftRequirement,
  target,
}: {
  date: string
  templateDefault: number
  shiftRequirement?: number | null
  target?: ManpowerTarget | null
}): { headcount: number; source: DemandSource } {
  // Priority 1 — ManpowerTarget weekday override
  if (target?.weekdayHeadcounts) {
    const weekday = getWeekday(date)
    const override = target.weekdayHeadcounts[weekday]
    if (override !== undefined && override >= 0) {
      return { headcount: override, source: 'weekday_target' }
    }
  }

  // Priority 2 — ShiftRequirement static override
  if (shiftRequirement != null && shiftRequirement >= 0) {
    return { headcount: shiftRequirement, source: 'shift_requirement' }
  }

  // Priority 3 — Template default
  return { headcount: Math.max(0, templateDefault), source: 'template_default' }
}

// ─── Batch demand map ─────────────────────────────────────────────────────────

/**
 * Pre-compute the resolved demand for every (shift, date) combination in a
 * date range.  Returns a `Map<"${date}:${shiftTemplateId}", ShiftDemand>` for
 * O(1) lookup during staffing analysis.
 *
 * Drop-in replacement for the inline
 *   `requirementsMap?.get(tpl.id) ?? tpl.requiredEmployees`
 * scattered across staffing.ts and ops.ts.
 *
 * When `targetsMap` is absent (current default), output is identical to the
 * previous inline expression.
 */
export function buildDemandMap({
  dates,
  templates,
  requirementsMap,
  targetsMap,
}: {
  dates: string[]
  templates: { id: string; requiredEmployees: number }[]
  requirementsMap?: Map<string, number>
  targetsMap?: Map<string, ManpowerTarget>
}): Map<string, ShiftDemand> {
  const result = new Map<string, ShiftDemand>()

  for (const date of dates) {
    const weekday = getWeekday(date)
    for (const tpl of templates) {
      const { headcount, source } = resolveRequiredHeadcount({
        date,
        templateDefault: tpl.requiredEmployees,
        shiftRequirement: requirementsMap?.get(tpl.id),
        target: targetsMap?.get(tpl.id),
      })
      result.set(`${date}:${tpl.id}`, {
        shiftTemplateId: tpl.id,
        date,
        weekday,
        requiredHeadcount: headcount,
        source,
      })
    }
  }

  return result
}
