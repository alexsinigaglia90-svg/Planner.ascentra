/**
 * Staffing analysis — pure client-side utility, no DB calls.
 * Compares required employees (from ShiftTemplate) against actual Assignments
 * to determine per-date, per-template staffing status.
 */

import type { ShiftTemplate, Employee } from '@prisma/client'
import type { AssignmentWithRelations } from '@/lib/queries/assignments'

export type StaffingStatus = 'understaffed' | 'staffed' | 'overstaffed'

export interface StaffingEntry {
  date: string
  template: ShiftTemplate
  required: number
  assigned: number
  status: StaffingStatus
  /** Positive = open slots; 0 = full; negative = over capacity */
  open: number
  /** Employees with no assignment on this date — basic candidate pool */
  candidates: Employee[]
}

export function analyzeStaffing({
  dates,
  assignments,
  templates,
  employees,
  requirementsMap,
}: {
  dates: string[]
  assignments: AssignmentWithRelations[]
  templates: ShiftTemplate[]
  employees: Employee[]
  /** Optional map of shiftTemplateId → requiredHeadcount from ShiftRequirement table. */
  requirementsMap?: Map<string, number>
}): StaffingEntry[] {
  if (templates.length === 0) return []

  const dateSet = new Set(dates)

  // date → Set<employeeId>  (all employees assigned on that date, any shift)
  const assignedOnDate = new Map<string, Set<string>>()
  for (const a of assignments) {
    const date = a.rosterDay.date
    if (!dateSet.has(date)) continue
    if (!assignedOnDate.has(date)) assignedOnDate.set(date, new Set())
    assignedOnDate.get(date)!.add(a.employeeId)
  }

  // `${date}:${templateId}` → count of assignments
  const countMap = new Map<string, number>()
  for (const a of assignments) {
    const date = a.rosterDay.date
    if (!dateSet.has(date)) continue
    const key = `${date}:${a.shiftTemplateId}`
    countMap.set(key, (countMap.get(key) ?? 0) + 1)
  }

  const results: StaffingEntry[] = []

  for (const date of dates) {
    const assignedIds = assignedOnDate.get(date) ?? new Set<string>()
    const candidates = employees.filter((e) => !assignedIds.has(e.id))

    for (const tpl of templates) {
      const assigned = countMap.get(`${date}:${tpl.id}`) ?? 0
      const required = requirementsMap?.get(tpl.id) ?? tpl.requiredEmployees
      const open = required - assigned
      const status: StaffingStatus =
        assigned < required ? 'understaffed'
        : assigned > required ? 'overstaffed'
        : 'staffed'

      results.push({ date, template: tpl, required, assigned, status, open, candidates })
    }
  }

  return results
}
