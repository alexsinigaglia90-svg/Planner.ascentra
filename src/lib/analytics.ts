/**
 * Analytics computation layer — pure functions, no DB calls.
 *
 * Computes aggregated staffing metrics, internal/temp workforce mix,
 * and per-day breakdowns for a given date range and assignment set.
 *
 * Structured for future extension:
 *   - Rolling weekly averages: aggregate `byDay` over a sliding window
 *   - Weekday analysis: group `byDay` by `new Date(date).getDay()`
 *   - Staffing forecasts: extrapolate `averageAssigned` per template forward
 */

// ── Minimal input types (structurally compatible with Prisma entities) ────────

export interface AssignmentForMetrics {
  rosterDay: { date: string }
  shiftTemplateId: string
  employeeId: string
}

export interface TemplateForMetrics {
  id: string
  name: string
  startTime: string
  endTime: string
  requiredEmployees: number
}

export interface EmployeeForMetrics {
  id: string
  employeeType: string
}

// ── Output types ──────────────────────────────────────────────────────────────

/** Aggregated metrics for one calendar day. */
export interface DayMetrics {
  date: string
  totalRequired: number
  totalAssigned: number
  /** Positive = over capacity, negative = shortfall */
  delta: number
  understaffedShifts: number
  overstaffedShifts: number
  staffedShifts: number
  /** Sum of per-shift shortfalls (only counts deficits, not surpluses) */
  openPositions: number
  internalCount: number
  tempCount: number
}

/**
 * Per-template summary over the full period.
 * `averageAssigned` acts as the baseline denominator for rolling forecasts.
 * `coverageRate` gives a quick quality signal per shift type.
 */
export interface TemplateMetrics {
  templateId: string
  templateName: string
  startTime: string
  endTime: string
  requiredPerDay: number
  totalAssignedInPeriod: number
  totalDays: number
  /** totalAssignedInPeriod / totalDays — base numerator for future rolling averages */
  averageAssigned: number
  totalOpen: number
  /** 0–1 fraction of required slots that were filled */
  coverageRate: number
}

/** Full metrics summary for a planning window. */
export interface PeriodMetrics {
  startDate: string
  endDate: string
  totalDays: number
  totalAssignments: number
  totalRequired: number
  totalOpen: number
  understaffedInstances: number
  overstaffedInstances: number
  internalCount: number
  tempCount: number
  /** 0–1 fraction of assignments made to internal employees */
  internalRatio: number
  byDay: DayMetrics[]
  byTemplate: TemplateMetrics[]
}

// ── Core computation ──────────────────────────────────────────────────────────

export function computeMetrics({
  dates,
  assignments,
  templates,
  employees,
}: {
  dates: string[]
  assignments: AssignmentForMetrics[]
  templates: TemplateForMetrics[]
  employees: EmployeeForMetrics[]
}): PeriodMetrics {
  if (dates.length === 0) {
    return emptyMetrics()
  }

  const dateSet = new Set(dates)
  const employeeMap = new Map<string, EmployeeForMetrics>(employees.map((e) => [e.id, e]))

  // Filter to visible window only
  const windowAssignments = assignments.filter((a) => dateSet.has(a.rosterDay.date))

  // Slot map: `${date}:${templateId}` → { assigned, internal, temp }
  type Slot = { assigned: number; internal: number; temp: number }
  const slotMap = new Map<string, Slot>()

  let totalInternal = 0
  let totalTemp = 0

  for (const a of windowAssignments) {
    const key = `${a.rosterDay.date}:${a.shiftTemplateId}`
    const emp = employeeMap.get(a.employeeId)
    const isInternal = emp?.employeeType !== 'temp'

    const slot = slotMap.get(key) ?? { assigned: 0, internal: 0, temp: 0 }
    slot.assigned++
    if (isInternal) {
      slot.internal++
      totalInternal++
    } else {
      slot.temp++
      totalTemp++
    }
    slotMap.set(key, slot)
  }

  // Per-day aggregation
  const byDay: DayMetrics[] = []
  let totalRequired = 0
  let totalOpen = 0
  let totalUnderstaffed = 0
  let totalOverstaffed = 0

  for (const date of dates) {
    let dayRequired = 0
    let dayAssigned = 0
    let dayInternal = 0
    let dayTemp = 0
    let dayUnderstaffed = 0
    let dayOverstaffed = 0
    let dayStaffed = 0
    let dayOpen = 0

    for (const tpl of templates) {
      const slot = slotMap.get(`${date}:${tpl.id}`) ?? { assigned: 0, internal: 0, temp: 0 }
      const req = tpl.requiredEmployees
      dayRequired += req
      dayAssigned += slot.assigned
      dayInternal += slot.internal
      dayTemp += slot.temp

      const open = req - slot.assigned
      if (open > 0) {
        dayUnderstaffed++
        dayOpen += open
      } else if (open < 0) {
        dayOverstaffed++
      } else {
        dayStaffed++
      }
    }

    totalRequired += dayRequired
    totalOpen += dayOpen
    totalUnderstaffed += dayUnderstaffed
    totalOverstaffed += dayOverstaffed

    byDay.push({
      date,
      totalRequired: dayRequired,
      totalAssigned: dayAssigned,
      delta: dayAssigned - dayRequired,
      understaffedShifts: dayUnderstaffed,
      overstaffedShifts: dayOverstaffed,
      staffedShifts: dayStaffed,
      openPositions: dayOpen,
      internalCount: dayInternal,
      tempCount: dayTemp,
    })
  }

  // Per-template aggregation
  const byTemplate: TemplateMetrics[] = templates.map((tpl) => {
    let totalAssigned = 0
    let tplOpen = 0

    for (const date of dates) {
      const slot = slotMap.get(`${date}:${tpl.id}`) ?? { assigned: 0, internal: 0, temp: 0 }
      totalAssigned += slot.assigned
      const open = tpl.requiredEmployees - slot.assigned
      if (open > 0) tplOpen += open
    }

    const totalRequiredForTpl = tpl.requiredEmployees * dates.length
    const coverageRate =
      totalRequiredForTpl > 0 ? Math.min(1, totalAssigned / totalRequiredForTpl) : 1

    return {
      templateId: tpl.id,
      templateName: tpl.name,
      startTime: tpl.startTime,
      endTime: tpl.endTime,
      requiredPerDay: tpl.requiredEmployees,
      totalAssignedInPeriod: totalAssigned,
      totalDays: dates.length,
      averageAssigned: dates.length > 0 ? totalAssigned / dates.length : 0,
      totalOpen: tplOpen,
      coverageRate,
    }
  })

  const total = windowAssignments.length

  return {
    startDate: dates[0]!,
    endDate: dates[dates.length - 1]!,
    totalDays: dates.length,
    totalAssignments: total,
    totalRequired,
    totalOpen,
    understaffedInstances: totalUnderstaffed,
    overstaffedInstances: totalOverstaffed,
    internalCount: totalInternal,
    tempCount: totalTemp,
    internalRatio: total > 0 ? totalInternal / total : 0,
    byDay,
    byTemplate,
  }
}

function emptyMetrics(): PeriodMetrics {
  return {
    startDate: '',
    endDate: '',
    totalDays: 0,
    totalAssignments: 0,
    totalRequired: 0,
    totalOpen: 0,
    understaffedInstances: 0,
    overstaffedInstances: 0,
    internalCount: 0,
    tempCount: 0,
    internalRatio: 0,
    byDay: [],
    byTemplate: [],
  }
}
