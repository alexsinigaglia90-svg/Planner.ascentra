/**
 * Demand computation — department-level staffing aggregation.
 * Pure functions, no DB calls.
 *
 * Aggregates staffing data at multiple zoom levels:
 * 1. Bird's Eye: department × date → coverage %
 * 2. Department Focus: process × shift × date → required/assigned
 * 3. Shift Detail: employee list with skill context
 */

import type { ShiftTemplate } from '@prisma/client'
import type { AssignmentWithRelations } from '@/lib/queries/assignments'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DepartmentDayStats {
  departmentId: string
  departmentName: string
  date: string
  required: number
  assigned: number
  directAssigned: number
  coverage: number // 0-1
  status: 'critical' | 'warning' | 'good' | 'over'
  shiftBreakdown: ShiftSlotStats[]
}

export interface ShiftSlotStats {
  shiftTemplateId: string
  shiftName: string
  startTime: string
  endTime: string
  required: number
  assigned: number
  directAssigned: number
  status: 'understaffed' | 'staffed' | 'overstaffed'
  assignedEmployees: AssignedEmployee[]
}

export interface AssignedEmployee {
  id: string
  name: string
  employeeType: string
  departmentId: string | null
  processLevels: Map<string, number> // processId → level
  isOverhead: boolean
}

export interface DepartmentSummary {
  id: string
  name: string
  color: string | null
  weekCoverage: number // average coverage across week
  totalRequired: number
  totalAssigned: number
  criticalDays: number
  warningDays: number
}

// ─── Bird's Eye Computation ──────────────────────────────────────────────────

type EmployeeLike = {
  id: string
  name: string
  employeeType: string
  departmentId?: string | null
  employeeFunction?: { overhead: boolean } | null
}

type RequirementsMap = Map<string, number> // shiftTemplateId → required headcount

/**
 * Compute department × date staffing stats for the Bird's Eye view.
 */
export function computeDepartmentDayStats({
  dates,
  departments,
  templates,
  assignments,
  employees,
  requirementsMap,
}: {
  dates: string[]
  departments: { id: string; name: string; color?: string | null }[]
  templates: ShiftTemplate[]
  assignments: AssignmentWithRelations[]
  employees: EmployeeLike[]
  requirementsMap?: RequirementsMap
}): DepartmentDayStats[] {
  const results: DepartmentDayStats[] = []
  const empMap = new Map(employees.map((e) => [e.id, e]))

  // Group templates by department
  const templatesByDept = new Map<string, ShiftTemplate[]>()
  const unassignedTemplates: ShiftTemplate[] = []

  for (const tpl of templates) {
    if (tpl.departmentId) {
      const list = templatesByDept.get(tpl.departmentId) ?? []
      list.push(tpl)
      templatesByDept.set(tpl.departmentId, list)
    } else {
      unassignedTemplates.push(tpl)
    }
  }

  // Index assignments by date+template
  const assignmentIndex = new Map<string, AssignmentWithRelations[]>()
  for (const a of assignments) {
    const key = `${a.rosterDay.date}:${a.shiftTemplateId}`
    const list = assignmentIndex.get(key) ?? []
    list.push(a)
    assignmentIndex.set(key, list)
  }

  // Include unassigned templates as a virtual "no department" group
  const allDeptEntries: { id: string; name: string; templates: ShiftTemplate[] }[] = []
  for (const dept of departments) {
    const deptTemplates = templatesByDept.get(dept.id) ?? []
    if (deptTemplates.length > 0) allDeptEntries.push({ id: dept.id, name: dept.name, templates: deptTemplates })
  }
  if (unassignedTemplates.length > 0) {
    allDeptEntries.push({ id: '__unassigned__', name: 'Algemeen', templates: unassignedTemplates })
  }

  for (const deptEntry of allDeptEntries) {
    const deptTemplates = deptEntry.templates

    for (const date of dates) {
      let totalRequired = 0
      let totalAssigned = 0
      let totalDirect = 0
      const shiftBreakdown: ShiftSlotStats[] = []

      for (const tpl of deptTemplates) {
        const required = requirementsMap?.get(tpl.id) ?? tpl.requiredEmployees
        const slotAssignments = assignmentIndex.get(`${date}:${tpl.id}`) ?? []
        const assigned = slotAssignments.length
        let direct = 0
        const assignedEmps: AssignedEmployee[] = []

        for (const a of slotAssignments) {
          const emp = empMap.get(a.employeeId)
          const isOverhead = emp?.employeeFunction?.overhead === true
          if (!isOverhead) direct++
          assignedEmps.push({
            id: a.employeeId,
            name: emp?.name ?? 'Unknown',
            employeeType: emp?.employeeType ?? 'internal',
            departmentId: emp?.departmentId ?? null,
            processLevels: new Map(),
            isOverhead,
          })
        }

        totalRequired += required
        totalAssigned += assigned
        totalDirect += direct

        shiftBreakdown.push({
          shiftTemplateId: tpl.id,
          shiftName: tpl.name,
          startTime: tpl.startTime,
          endTime: tpl.endTime,
          required,
          assigned,
          directAssigned: direct,
          status: direct < required ? 'understaffed' : direct > required ? 'overstaffed' : 'staffed',
          assignedEmployees: assignedEmps,
        })
      }

      const coverage = totalRequired > 0 ? totalDirect / totalRequired : 1
      const status: DepartmentDayStats['status'] =
        coverage < 0.7 ? 'critical'
        : coverage < 0.9 ? 'warning'
        : coverage > 1.05 ? 'over'
        : 'good'

      results.push({
        departmentId: deptEntry.id,
        departmentName: deptEntry.name,
        date,
        required: totalRequired,
        assigned: totalAssigned,
        directAssigned: totalDirect,
        coverage,
        status,
        shiftBreakdown,
      })
    }
  }

  return results
}

/**
 * Aggregate department stats across all dates for summary cards.
 */
export function computeDepartmentSummaries(
  stats: DepartmentDayStats[],
  departments: { id: string; name: string; color?: string | null }[],
): DepartmentSummary[] {
  const grouped = new Map<string, DepartmentDayStats[]>()
  for (const s of stats) {
    const list = grouped.get(s.departmentId) ?? []
    list.push(s)
    grouped.set(s.departmentId, list)
  }

  return departments
    .filter((d) => grouped.has(d.id))
    .map((dept) => {
      const entries = grouped.get(dept.id)!
      const totalRequired = entries.reduce((s, e) => s + e.required, 0)
      const totalAssigned = entries.reduce((s, e) => s + e.directAssigned, 0)
      const weekCoverage = totalRequired > 0 ? totalAssigned / totalRequired : 1
      const criticalDays = entries.filter((e) => e.status === 'critical').length
      const warningDays = entries.filter((e) => e.status === 'warning').length

      return {
        id: dept.id,
        name: dept.name,
        color: dept.color ?? null,
        weekCoverage,
        totalRequired,
        totalAssigned,
        criticalDays,
        warningDays,
      }
    })
}

/**
 * Get available (unassigned) employees for a specific date, optionally filtered by department.
 */
export function getAvailableEmployees({
  date,
  departmentId,
  assignments,
  employees,
}: {
  date: string
  departmentId?: string | null
  assignments: AssignmentWithRelations[]
  employees: EmployeeLike[]
}): EmployeeLike[] {
  const assignedIds = new Set(
    assignments
      .filter((a) => a.rosterDay.date === date)
      .map((a) => a.employeeId),
  )

  return employees.filter((e) => {
    if (assignedIds.has(e.id)) return false
    if (e.employeeFunction?.overhead === true) return false
    if (departmentId && e.departmentId !== departmentId) return false
    return true
  })
}
