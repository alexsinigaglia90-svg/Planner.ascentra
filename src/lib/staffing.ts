/**
 * Staffing analysis — pure client-side utility, no DB calls.
 * Compares required employees (from ShiftTemplate) against actual Assignments
 * to determine per-date, per-template staffing status.
 *
 * Overhead employees (employeeFunction.overhead === true) are tracked but
 * excluded from the DIRECT capacity count so that staffing gaps are always
 * measured in direct-labour headcount.  Overhead individuals still appear in
 * the grid and the candidates list.
 */

import type { ShiftTemplate } from '@prisma/client'
import type { AssignmentWithRelations } from '@/lib/queries/assignments'

export type StaffingStatus = 'understaffed' | 'staffed' | 'overstaffed'

export interface StaffingEntry {
  date: string
  template: ShiftTemplate
  required: number
  /** Total employees assigned (direct + overhead). */
  assigned: number
  /** Direct-labour employees only — used for status/open calculations. */
  directAssigned: number
  status: StaffingStatus
  /** Positive = open direct slots; 0 = full; negative = over capacity. */
  open: number
  /** Employees with no assignment on this date — basic candidate pool */
  candidates: AnalysisEmployee[]
}

// Structural duck type — accepts Employee, EmployeeForPlanning, etc.
type AnalysisEmployee = {
  id: string
  name?: string
  employeeFunction?: { overhead: boolean } | null
  [key: string]: unknown
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
  employees: AnalysisEmployee[]
  /** Optional map of shiftTemplateId → requiredHeadcount from ShiftRequirement table. */
  requirementsMap?: Map<string, number>
}): StaffingEntry[] {
  if (templates.length === 0) return []

  const dateSet = new Set(dates)

  // Build employee lookup for overhead checks
  const empMap = new Map<string, AnalysisEmployee>(employees.map((e) => [e.id, e]))

  // date → Set<employeeId>  (all employees assigned on that date, any shift)
  const assignedOnDate = new Map<string, Set<string>>()
  for (const a of assignments) {
    const date = a.rosterDay.date
    if (!dateSet.has(date)) continue
    if (!assignedOnDate.has(date)) assignedOnDate.set(date, new Set())
    assignedOnDate.get(date)!.add(a.employeeId)
  }

  // `${date}:${templateId}` → { total, direct }
  type SlotCount = { total: number; direct: number }
  const countMap = new Map<string, SlotCount>()
  for (const a of assignments) {
    const date = a.rosterDay.date
    if (!dateSet.has(date)) continue
    const key = `${date}:${a.shiftTemplateId}`
    const entry = countMap.get(key) ?? { total: 0, direct: 0 }
    entry.total++
    const emp = empMap.get(a.employeeId)
    if (emp?.employeeFunction?.overhead !== true) entry.direct++
    countMap.set(key, entry)
  }

  const results: StaffingEntry[] = []

  for (const date of dates) {
    const assignedIds = assignedOnDate.get(date) ?? new Set<string>()
    const candidates = employees.filter((e) => !assignedIds.has(e.id))

    for (const tpl of templates) {
      const counts = countMap.get(`${date}:${tpl.id}`) ?? { total: 0, direct: 0 }
      const assigned = counts.total
      const directAssigned = counts.direct
      const required = requirementsMap?.get(tpl.id) ?? tpl.requiredEmployees
      const open = required - directAssigned
      const status: StaffingStatus =
        directAssigned < required ? 'understaffed'
        : directAssigned > required ? 'overstaffed'
        : 'staffed'

      results.push({ date, template: tpl, required, assigned, directAssigned, status, open, candidates })
    }
  }

  return results
}
