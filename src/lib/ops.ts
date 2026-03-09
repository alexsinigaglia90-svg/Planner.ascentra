/**
 * Operational Intelligence Layer
 *
 * Pure computation — no DB calls, no side effects.
 *
 * Derives an OpsSnapshot from existing planning data:
 *   - Per-day operational status (today, next 2 days, rest of week)
 *   - Escalations: critical understaffing, skill mismatches, temp reliance, overcontract
 *   - Site / department breakdowns
 *   - Open position counts
 *
 * Designed to be called once per render on the server or inside useMemo on the client.
 */

import { shiftDurationMinutes } from '@/lib/compliance'

// ---------------------------------------------------------------------------
// Input types (structurally compatible with Prisma / existing query types)
// ---------------------------------------------------------------------------

export interface OpsEmployee {
  id: string
  name: string
  employeeType: string  // 'internal' | 'temp'
  contractHours: number
  status: string
  locationId: string | null
  departmentId: string | null
  skills?: { skillId: string; skill: { id: string; name: string } }[]
}

export interface OpsShiftTemplate {
  id: string
  name: string
  startTime: string
  endTime: string
  requiredEmployees: number
  requiredSkillId: string | null
  requiredSkill?: { id: string; name: string } | null
  locationId: string | null
  departmentId: string | null
}

export interface OpsAssignment {
  employeeId: string
  shiftTemplateId: string
  rosterDay: { date: string }
}

export interface OpsNamedItem {
  id: string
  name: string
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/** Severity of a single operational issue. */
export type IssueSeverity = 'critical' | 'warning' | 'info'

/** Nature of a single operational issue. */
export type IssueKind =
  | 'understaffed'
  | 'critical-understaffed'
  | 'overstaffed'
  | 'skill-mismatch'
  | 'no-skilled-candidates'
  | 'temp-reliance'
  | 'over-contract'
  | 'site-understaffed'
  | 'dept-understaffed'

export interface OpsIssue {
  kind: IssueKind
  severity: IssueSeverity
  date: string
  /** Human-readable headline */
  title: string
  /** Supporting detail */
  detail: string
  /** IDs of involved entities for future deep-linking */
  templateId?: string
  employeeId?: string
  locationId?: string
  departmentId?: string
}

/** Staffing status for a single shift-slot on a given day. */
export interface OpsShiftSlot {
  date: string
  template: OpsShiftTemplate
  required: number
  assigned: number
  open: number
  /** 0–1 fraction of required filled */
  fillRate: number
  status: 'critical' | 'understaffed' | 'staffed' | 'overstaffed'
  /** Names of employees assigned to this slot */
  assignedNames: string[]
  /** true = shift requires a skill nobody assigned has */
  skillMismatch: boolean
  requiredSkillName: string | null
  /** Fraction of assigned employees who are temp (0–1) */
  tempFraction: number
}

/** Summary for a single calendar day. */
export interface OpsDaySummary {
  date: string
  label: string  // e.g. "Today", "Tomorrow", "Wednesday"
  isToday: boolean
  isTomorrow: boolean
  slots: OpsShiftSlot[]
  totalRequired: number
  totalAssigned: number
  totalOpen: number
  criticalSlots: number
  understaffedSlots: number
  overstaffedSlots: number
  allStaffed: boolean
}

/** Aggregate summary for the current week (Mon–Sun). */
export interface OpsWeekSummary {
  weekStart: string
  weekEnd: string
  totalRequired: number
  totalAssigned: number
  totalOpen: number
  coverageRate: number  // 0–1
  understaffedInstances: number
  criticalInstances: number
  overstaffedInstances: number
  internalRatio: number  // 0–1
  tempRatio: number
  overContractEmployees: number
  weeklyPlannedMinutesMap: Map<string, number>  // employeeId → minutes
}

/** Per-location breakdown. */
export interface OpsSiteRow {
  locationId: string
  locationName: string
  assignedCount: number
  requiredCount: number
  open: number
  status: 'ok' | 'warn' | 'critical'
}

/** Per-department breakdown. */
export interface OpsDeptRow {
  departmentId: string
  departmentName: string
  assignedCount: number
  requiredCount: number
  open: number
  status: 'ok' | 'warn' | 'critical'
}

/** The full operational snapshot. */
export interface OpsSnapshot {
  asOf: string               // ISO date of "today"
  today: OpsDaySummary | null
  tomorrow: OpsDaySummary | null
  dayAfterTomorrow: OpsDaySummary | null
  weekDays: OpsDaySummary[]  // all days in current week (Mon–Sun)
  week: OpsWeekSummary
  escalations: OpsIssue[]
  siteBreakdown: OpsSiteRow[]
  deptBreakdown: OpsDeptRow[]
  /** Employees planned over contract hours this week */
  overContractEmployees: { id: string; name: string; plannedHours: number; contractHours: number }[]
  /** Employees with high temp reliance (> 50 % of workforce) for any shift today */
  highTempShifts: { date: string; templateName: string; tempFraction: number }[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isoToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDaysToIso(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function dayLabel(dateStr: string, today: string, tomorrow: string): string {
  if (dateStr === today) return 'Today'
  if (dateStr === tomorrow) return 'Tomorrow'
  const d = new Date(dateStr + 'T00:00:00')
  return WEEKDAY_LABELS[d.getDay()]
}

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

export function computeOpsSnapshot({
  employees,
  templates,
  assignments,
  requirementsMap,
  locations,
  departments,
}: {
  employees: OpsEmployee[]
  templates: OpsShiftTemplate[]
  assignments: OpsAssignment[]
  requirementsMap: Map<string, number>
  locations: OpsNamedItem[]
  departments: OpsNamedItem[]
}): OpsSnapshot {
  const today = isoToday()
  const tomorrow = addDaysToIso(today, 1)
  const dayAfter = addDaysToIso(today, 2)
  const weekStart = getMondayOfWeek(today)
  const weekEnd = addDaysToIso(weekStart, 6)

  // Generate the 7 days of the current week
  const weekDates: string[] = Array.from({ length: 7 }, (_, i) => addDaysToIso(weekStart, i))

  // ── Index assignments ──────────────────────────────────────────────────
  // date:templateId → assigned employeeIds
  const slotEmployees = new Map<string, string[]>()
  // employeeId → total planned minutes in the week window
  const weeklyMinutes = new Map<string, number>()

  for (const a of assignments) {
    const date = a.rosterDay.date

    // slot index
    const key = `${date}:${a.shiftTemplateId}`
    if (!slotEmployees.has(key)) slotEmployees.set(key, [])
    slotEmployees.get(key)!.push(a.employeeId)

    // weekly minutes (only for week window)
    if (weekDates.includes(date)) {
      const tpl = templates.find((t) => t.id === a.shiftTemplateId)
      if (tpl) {
        const mins = shiftDurationMinutes(tpl.startTime, tpl.endTime)
        weeklyMinutes.set(a.employeeId, (weeklyMinutes.get(a.employeeId) ?? 0) + mins)
      }
    }
  }

  // employee id → employee lookup
  const empMap = new Map(employees.map((e) => [e.id, e]))

  // ── Build an OpsShiftSlot for a given date + template ─────────────────
  function buildSlot(date: string, tpl: OpsShiftTemplate): OpsShiftSlot {
    const key = `${date}:${tpl.id}`
    const assignedIds = slotEmployees.get(key) ?? []
    const assigned = assignedIds.length
    const required = requirementsMap.get(tpl.id) ?? tpl.requiredEmployees
    const open = required - assigned
    const fillRate = required > 0 ? Math.min(assigned / required, 1) : 1

    let status: OpsShiftSlot['status']
    if (assigned === 0 && required > 0) status = 'critical'
    else if (assigned < required) {
      // critical if less than 50 % filled
      status = fillRate < 0.5 ? 'critical' : 'understaffed'
    } else if (assigned > required) status = 'overstaffed'
    else status = 'staffed'

    const assignedEmps = assignedIds.map((id) => empMap.get(id)).filter(Boolean) as OpsEmployee[]
    const assignedNames = assignedEmps.map((e) => e.name)

    // Skill mismatch: shift requires a skill but none of the assigned have it
    let skillMismatch = false
    if (tpl.requiredSkillId && assignedEmps.length > 0) {
      const hasSkill = assignedEmps.some((e) =>
        (e.skills ?? []).some((s) => s.skillId === tpl.requiredSkillId),
      )
      skillMismatch = !hasSkill
    }
    // No-match case: required skill but nobody assigned at all
    if (tpl.requiredSkillId && assignedEmps.length === 0 && required > 0) {
      skillMismatch = true
    }

    const tempCount = assignedEmps.filter((e) => e.employeeType === 'temp').length
    const tempFraction = assigned > 0 ? tempCount / assigned : 0

    return {
      date,
      template: tpl,
      required,
      assigned,
      open,
      fillRate,
      status,
      assignedNames,
      skillMismatch,
      requiredSkillName: tpl.requiredSkill?.name ?? null,
      tempFraction,
    }
  }

  // ── Build OpsDaySummary for a single date ──────────────────────────────
  function buildDay(date: string): OpsDaySummary {
    const slots = templates.map((tpl) => buildSlot(date, tpl))
    const totalRequired = slots.reduce((s, sl) => s + sl.required, 0)
    const totalAssigned = slots.reduce((s, sl) => s + sl.assigned, 0)
    const totalOpen = slots.reduce((s, sl) => s + Math.max(0, sl.open), 0)
    const criticalSlots = slots.filter((s) => s.status === 'critical').length
    const understaffedSlots = slots.filter((s) => s.status === 'understaffed').length
    const overstaffedSlots = slots.filter((s) => s.status === 'overstaffed').length
    const allStaffed = criticalSlots === 0 && understaffedSlots === 0 && overstaffedSlots === 0

    return {
      date,
      label: dayLabel(date, today, tomorrow),
      isToday: date === today,
      isTomorrow: date === tomorrow,
      slots,
      totalRequired,
      totalAssigned,
      totalOpen,
      criticalSlots,
      understaffedSlots,
      overstaffedSlots,
      allStaffed,
    }
  }

  // ── Build all week days ────────────────────────────────────────────────
  const weekDays = weekDates.map(buildDay)

  // ── Week summary ───────────────────────────────────────────────────────
  const allWeekSlots = weekDays.flatMap((d) => d.slots)
  const wTotalRequired = allWeekSlots.reduce((s, sl) => s + sl.required, 0)
  const wTotalAssigned = allWeekSlots.reduce((s, sl) => s + sl.assigned, 0)
  const wTotalOpen = allWeekSlots.reduce((s, sl) => s + Math.max(0, sl.open), 0)
  const wUnderstaffed = allWeekSlots.filter((s) => s.status === 'understaffed' || s.status === 'critical').length
  const wCritical = allWeekSlots.filter((s) => s.status === 'critical').length
  const wOverstaffed = allWeekSlots.filter((s) => s.status === 'overstaffed').length

  // Internal/temp ratio across all week assignments
  const weekAssignedIds: string[] = []
  for (const a of assignments) {
    if (weekDates.includes(a.rosterDay.date)) weekAssignedIds.push(a.employeeId)
  }
  const internalCount = weekAssignedIds.filter((id) => empMap.get(id)?.employeeType === 'internal').length
  const internalRatio = weekAssignedIds.length > 0 ? internalCount / weekAssignedIds.length : 0
  const tempRatio = 1 - internalRatio

  // Over-contract employees
  const overContractEmployees = employees
    .filter((e) => {
      if (e.contractHours <= 0) return false
      const planned = weeklyMinutes.get(e.id) ?? 0
      return planned > e.contractHours * 60
    })
    .map((e) => ({
      id: e.id,
      name: e.name,
      plannedHours: Math.round(((weeklyMinutes.get(e.id) ?? 0) / 60) * 10) / 10,
      contractHours: e.contractHours,
    }))

  const week: OpsWeekSummary = {
    weekStart,
    weekEnd,
    totalRequired: wTotalRequired,
    totalAssigned: wTotalAssigned,
    totalOpen: wTotalOpen,
    coverageRate: wTotalRequired > 0 ? (wTotalRequired - wTotalOpen) / wTotalRequired : 1,
    understaffedInstances: wUnderstaffed,
    criticalInstances: wCritical,
    overstaffedInstances: wOverstaffed,
    internalRatio,
    tempRatio,
    overContractEmployees: overContractEmployees.length,
    weeklyPlannedMinutesMap: weeklyMinutes,
  }

  // ── Escalations ────────────────────────────────────────────────────────

  const escalations: OpsIssue[] = []
  const focusDates = [today, tomorrow, dayAfter]

  for (const date of focusDates) {
    const day = weekDays.find((d) => d.date === date)
    if (!day) continue

    for (const slot of day.slots) {
      // Critical understaffing
      if (slot.status === 'critical') {
        escalations.push({
          kind: 'critical-understaffed',
          severity: 'critical',
          date,
          title: `${slot.template.name} — no coverage`,
          detail: `${slot.assigned}/${slot.required} filled on ${day.label.toLowerCase()} (${slot.open} open)`,
          templateId: slot.template.id,
        })
      } else if (slot.status === 'understaffed') {
        escalations.push({
          kind: 'understaffed',
          severity: 'warning',
          date,
          title: `${slot.template.name} understaffed`,
          detail: `${slot.assigned}/${slot.required} filled on ${day.label.toLowerCase()} (${slot.open} open)`,
          templateId: slot.template.id,
        })
      }

      // Skill mismatch
      if (slot.skillMismatch) {
        escalations.push({
          kind: slot.assigned === 0 ? 'no-skilled-candidates' : 'skill-mismatch',
          severity: 'critical',
          date,
          title: `${slot.template.name} — skill gap`,
          detail: slot.assigned === 0
            ? `Requires ${slot.requiredSkillName ?? 'skill'}, no one assigned`
            : `Requires ${slot.requiredSkillName ?? 'skill'}, assigned staff lack it`,
          templateId: slot.template.id,
        })
      }

      // High temp reliance (> 66 %)
      if (slot.tempFraction > 0.66 && slot.assigned > 0) {
        escalations.push({
          kind: 'temp-reliance',
          severity: 'warning',
          date,
          title: `${slot.template.name} — high temp reliance`,
          detail: `${Math.round(slot.tempFraction * 100)}% temp staff on ${day.label.toLowerCase()}`,
          templateId: slot.template.id,
        })
      }
    }
  }

  // Over-contract escalations
  for (const emp of overContractEmployees) {
    escalations.push({
      kind: 'over-contract',
      severity: 'warning',
      date: today,
      title: `${emp.name} over contract hours`,
      detail: `${emp.plannedHours} h planned vs ${emp.contractHours} h contract this week`,
      employeeId: emp.id,
    })
  }

  // Deduplicate by (kind, date, templateId)
  const seenEsc = new Set<string>()
  const dedupedEscalations = escalations.filter((e) => {
    const key = `${e.kind}:${e.date}:${e.templateId ?? ''}:${e.employeeId ?? ''}`
    if (seenEsc.has(key)) return false
    seenEsc.add(key)
    return true
  })

  // Sort: critical first, then by date
  dedupedEscalations.sort((a, b) => {
    const sev = { critical: 0, warning: 1, info: 2 }
    const s = sev[a.severity] - sev[b.severity]
    if (s !== 0) return s
    return a.date.localeCompare(b.date)
  })

  // ── High-temp shifts today ─────────────────────────────────────────────
  const highTempShifts = (weekDays.find((d) => d.date === today)?.slots ?? [])
    .filter((s) => s.tempFraction > 0.5 && s.assigned > 0)
    .map((s) => ({
      date: today,
      templateName: s.template.name,
      tempFraction: s.tempFraction,
    }))

  // ── Site breakdown (today + tomorrow) ─────────────────────────────────
  const siteBreakdown: OpsSiteRow[] = locations.map((loc) => {
    // Employees at this location, both days
    const locEmpIds = new Set(
      employees.filter((e) => e.locationId === loc.id).map((e) => e.id),
    )
    // Shifts assigned to this location's templates (today + tomorrow)
    const focusSlots = [today, tomorrow].flatMap((date) => {
      const day = weekDays.find((d) => d.date === date)
      return day ? day.slots.filter((s) => s.template.locationId === loc.id) : []
    })

    // fallback: count by employee location if no template is tagged
    const requiredCount = focusSlots.reduce((s, sl) => s + sl.required, 0)
    const assignedCount = focusSlots.reduce((s, sl) => s + sl.assigned, 0)
    const open = Math.max(0, requiredCount - assignedCount)
    const fillRate = requiredCount > 0 ? assignedCount / requiredCount : 1
    const status: OpsSiteRow['status'] =
      fillRate < 0.5 && requiredCount > 0 ? 'critical' :
      fillRate < 1 && requiredCount > 0 ? 'warn' : 'ok'

    // If no templates are tagged to a location, show employee headcount instead
    const headcount = [...locEmpIds].filter((id) => {
      const emp = empMap.get(id)
      return emp?.status === 'active'
    }).length

    return {
      locationId: loc.id,
      locationName: loc.name,
      assignedCount: requiredCount > 0 ? assignedCount : headcount,
      requiredCount,
      open,
      status,
    }
  })

  // ── Dept breakdown (today + tomorrow) ─────────────────────────────────
  const deptBreakdown: OpsDeptRow[] = departments.map((dept) => {
    const focusSlots = [today, tomorrow].flatMap((date) => {
      const day = weekDays.find((d) => d.date === date)
      return day ? day.slots.filter((s) => s.template.departmentId === dept.id) : []
    })

    const requiredCount = focusSlots.reduce((s, sl) => s + sl.required, 0)
    const assignedCount = focusSlots.reduce((s, sl) => s + sl.assigned, 0)
    const open = Math.max(0, requiredCount - assignedCount)
    const fillRate = requiredCount > 0 ? assignedCount / requiredCount : 1
    const status: OpsDeptRow['status'] =
      fillRate < 0.5 && requiredCount > 0 ? 'critical' :
      fillRate < 1 && requiredCount > 0 ? 'warn' : 'ok'

    const headcount = employees.filter(
      (e) => e.departmentId === dept.id && e.status === 'active',
    ).length

    return {
      departmentId: dept.id,
      departmentName: dept.name,
      assignedCount: requiredCount > 0 ? assignedCount : headcount,
      requiredCount,
      open,
      status,
    }
  })

  return {
    asOf: today,
    today: weekDays.find((d) => d.date === today) ?? null,
    tomorrow: weekDays.find((d) => d.date === tomorrow) ?? null,
    dayAfterTomorrow: weekDays.find((d) => d.date === dayAfter) ?? null,
    weekDays,
    week,
    escalations: dedupedEscalations,
    siteBreakdown,
    deptBreakdown,
    overContractEmployees,
    highTempShifts,
  }
}
