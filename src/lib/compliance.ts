/**
 * Contract Hours & Daily Compliance v1
 *
 * Pure calculation module — no DB calls, no side effects.
 *
 * Responsibilities:
 *  1. Parse shift duration from HH:MM strings
 *  2. Calculate weekly planned hours per employee
 *  3. Classify weekly contract status (under / on-target / over)
 *  4. Detect daily overload signals (multiple shifts, heavy hours)
 *
 * All thresholds are explicit constants at the top — easy to adjust.
 */

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** Minutes per day that trigger a "heavy load" warning. Default = 10 h */
const HEAVY_DAY_MINUTES = 600

// ---------------------------------------------------------------------------
// Input types (structurally compatible with Prisma entities)
// ---------------------------------------------------------------------------

export interface EmployeeForCompliance {
  id: string
  name: string
  employeeType: string
  contractHours: number // hours/week
}

export interface ShiftTemplateForCompliance {
  id: string
  startTime: string // "HH:MM"
  endTime: string   // "HH:MM"
}

export interface AssignmentForCompliance {
  employeeId: string
  shiftTemplateId: string
  rosterDay: { date: string }
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type ContractStatus = 'under' | 'on-target' | 'over'

export interface WeeklyCompliance {
  employeeId: string
  contractMinutes: number
  plannedMinutes: number
  /** plannedMinutes - contractMinutes; negative = under, positive = over */
  deltaMinutes: number
  status: ContractStatus
  /** Formatted contract hours, e.g. "40 h" */
  contractLabel: string
  /** Formatted planned hours, e.g. "42 h 30 m" */
  plannedLabel: string
  /** Short delta label, e.g. "+2 h 30 m" or "−1 h" */
  deltaLabel: string
}

export type DailyLoadSignal = 'multi-shift' | 'heavy-load' | 'multi-shift+heavy'

export interface DailyLoad {
  employeeId: string
  date: string
  shiftCount: number
  totalMinutes: number
  /** Set when a notable overload condition is detected */
  signal: DailyLoadSignal | null
}

export interface ComplianceResult {
  /** Map employeeId → WeeklyCompliance for the visible date range */
  weekly: Map<string, WeeklyCompliance>
  /** Map `${employeeId}:${date}` → DailyLoad for cells with any signal */
  dailySignals: Map<string, DailyLoad>
}

// ---------------------------------------------------------------------------
// Duration helpers
// ---------------------------------------------------------------------------

/** Parse "HH:MM" → total minutes. Handles overnight shifts (end < start). */
export function shiftDurationMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const startMin = sh * 60 + sm
  const endMin = eh * 60 + em
  // Overnight: add 24 h worth of minutes
  return endMin >= startMin ? endMin - startMin : 24 * 60 - startMin + endMin
}

/** Format minutes to a short human label, e.g. "40 h", "42 h 30 m", "30 m" */
export function formatMinutes(minutes: number): string {
  const absMin = Math.abs(Math.round(minutes))
  const h = Math.floor(absMin / 60)
  const m = absMin % 60
  if (h > 0 && m > 0) return `${h} h ${m} m`
  if (h > 0) return `${h} h`
  return `${m} m`
}

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

export function computeCompliance({
  dates,
  employees,
  assignments,
  templates,
}: {
  dates: string[]
  employees: EmployeeForCompliance[]
  assignments: AssignmentForCompliance[]
  templates: ShiftTemplateForCompliance[]
}): ComplianceResult {
  const dateSet = new Set(dates)

  // Build template duration map
  const durationMap = new Map<string, number>()
  for (const tpl of templates) {
    durationMap.set(tpl.id, shiftDurationMinutes(tpl.startTime, tpl.endTime))
  }

  // Filter to the visible window
  const windowAssignments = assignments.filter((a) => dateSet.has(a.rosterDay.date))

  // Per-employee, per-date aggregation
  // empId → date → { shiftCount, totalMinutes }
  const dailyMap = new Map<string, Map<string, { shiftCount: number; totalMinutes: number }>>()
  for (const emp of employees) dailyMap.set(emp.id, new Map())

  for (const a of windowAssignments) {
    const byDate = dailyMap.get(a.employeeId)
    if (!byDate) continue
    const duration = durationMap.get(a.shiftTemplateId) ?? 0
    const date = a.rosterDay.date
    const prev = byDate.get(date) ?? { shiftCount: 0, totalMinutes: 0 }
    byDate.set(date, {
      shiftCount: prev.shiftCount + 1,
      totalMinutes: prev.totalMinutes + duration,
    })
  }

  // ------------------------------------------------------------------
  // Weekly compliance
  // ------------------------------------------------------------------
  const weekly = new Map<string, WeeklyCompliance>()

  for (const emp of employees) {
    const byDate = dailyMap.get(emp.id)!
    let plannedMinutes = 0
    for (const { totalMinutes } of byDate.values()) {
      plannedMinutes += totalMinutes
    }

    const contractMinutes = emp.contractHours * 60
    const deltaMinutes = plannedMinutes - contractMinutes

    // ±10 % tolerance band = "on-target"
    const tolerance = contractMinutes * 0.1
    let status: ContractStatus
    if (contractMinutes === 0) {
      // No contract hours set → no status
      status = plannedMinutes === 0 ? 'on-target' : 'under'
    } else if (Math.abs(deltaMinutes) <= tolerance) {
      status = 'on-target'
    } else if (deltaMinutes > 0) {
      status = 'over'
    } else {
      status = 'under'
    }

    const deltaLabel =
      deltaMinutes === 0
        ? '±0'
        : `${deltaMinutes > 0 ? '+' : '−'}${formatMinutes(Math.abs(deltaMinutes))}`

    weekly.set(emp.id, {
      employeeId: emp.id,
      contractMinutes,
      plannedMinutes,
      deltaMinutes,
      status,
      contractLabel: `${emp.contractHours} h`,
      plannedLabel: formatMinutes(plannedMinutes),
      deltaLabel,
    })
  }

  // ------------------------------------------------------------------
  // Daily signals
  // ------------------------------------------------------------------
  const dailySignals = new Map<string, DailyLoad>()

  for (const emp of employees) {
    const byDate = dailyMap.get(emp.id)!
    for (const [date, { shiftCount, totalMinutes }] of byDate.entries()) {
      const isMultiShift = shiftCount > 1
      const isHeavy = totalMinutes >= HEAVY_DAY_MINUTES

      let signal: DailyLoadSignal | null = null
      if (isMultiShift && isHeavy) signal = 'multi-shift+heavy'
      else if (isMultiShift) signal = 'multi-shift'
      else if (isHeavy) signal = 'heavy-load'

      if (signal !== null) {
        dailySignals.set(`${emp.id}:${date}`, {
          employeeId: emp.id,
          date,
          shiftCount,
          totalMinutes,
          signal,
        })
      }
    }
  }

  return { weekly, dailySignals }
}
