/**
 * Overhead-awareness unit tests.
 *
 * Covers:
 *  - isOverheadEmployee helper
 *  - analyzeStaffing: overhead excluded from direct count / status
 *  - analyzeStaffing: overhead employees remain in candidates
 *  - computeMetrics: overheadCount / directCount / internalRatio among direct only
 */

import { describe, it, expect } from 'vitest'
import { isOverheadEmployee } from '@/lib/queries/employees'
import { analyzeStaffing } from '@/lib/staffing'
import { computeMetrics } from '@/lib/analytics'
import type { ShiftTemplate } from '@prisma/client'
import type { AssignmentWithRelations } from '@/lib/queries/assignments'

// ─── isOverheadEmployee ───────────────────────────────────────────────────────

describe('isOverheadEmployee', () => {
  it('returns false when employeeFunction is null', () => {
    expect(isOverheadEmployee({ employeeFunction: null })).toBe(false)
  })

  it('returns false when employeeFunction is undefined', () => {
    expect(isOverheadEmployee({})).toBe(false)
  })

  it('returns false when overhead is false', () => {
    expect(isOverheadEmployee({ employeeFunction: { overhead: false } })).toBe(false)
  })

  it('returns true when overhead is true', () => {
    expect(isOverheadEmployee({ employeeFunction: { overhead: true } })).toBe(true)
  })
})

// ─── analyzeStaffing ─────────────────────────────────────────────────────────

const TEMPLATE: ShiftTemplate = {
  id: 'tpl-1',
  name: 'Morning',
  organizationId: 'org-1',
  startTime: '06:00',
  endTime: '14:00',
  requiredEmployees: 2,
  requiredSkillId: null,
  locationId: null,
  departmentId: null,
  breakMinutes: 30,
  breakMode: 'all',
  breakWindowStart: null,
}

/** Minimal shape used in analyzeStaffing — only rosterDay.date, employeeId, shiftTemplateId are read */
function makeAssignment(employeeId: string, date: string): AssignmentWithRelations {
  return {
    id: `asgn-${employeeId}-${date}`,
    employeeId,
    organizationId: 'org-1',
    shiftTemplateId: 'tpl-1',
    rosterDayId: `rd-${date}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    rosterDay: {
      id: `rd-${date}`,
      date,
      organizationId: 'org-1',
      createdAt: new Date(),
    },
    employee: null as never,
    shiftTemplate: TEMPLATE,
  } as unknown as AssignmentWithRelations
}

const DIRECT_EMP = { id: 'emp-direct', employeeFunction: null }
const OVERHEAD_EMP = { id: 'emp-overhead', employeeFunction: { overhead: true } }
const DATE = '2025-01-06'

describe('analyzeStaffing — overhead exclusion', () => {
  it('overhead assignment does NOT count toward direct slot, leaving slot understaffed', () => {
    const entries = analyzeStaffing({
      dates: [DATE],
      assignments: [makeAssignment(OVERHEAD_EMP.id, DATE)],
      templates: [TEMPLATE],
      employees: [DIRECT_EMP, OVERHEAD_EMP],
    })

    const entry = entries[0]
    expect(entry.assigned).toBe(1)        // total includes overhead
    expect(entry.directAssigned).toBe(0)  // no direct assigned
    expect(entry.open).toBe(2)            // required=2, direct=0 → 2 open
    expect(entry.status).toBe('understaffed')
  })

  it('direct assignment counts toward direct slot', () => {
    const entries = analyzeStaffing({
      dates: [DATE],
      assignments: [
        makeAssignment(DIRECT_EMP.id, DATE),
        makeAssignment(OVERHEAD_EMP.id, DATE),
      ],
      templates: [TEMPLATE],
      employees: [DIRECT_EMP, OVERHEAD_EMP],
    })

    const entry = entries[0]
    expect(entry.assigned).toBe(2)
    expect(entry.directAssigned).toBe(1)
    expect(entry.open).toBe(1)
    expect(entry.status).toBe('understaffed')
  })

  it('overhead employee appears in candidates for unassigned dates', () => {
    const entries = analyzeStaffing({
      dates: [DATE],
      assignments: [],
      templates: [TEMPLATE],
      employees: [DIRECT_EMP, OVERHEAD_EMP],
    })

    const candidateIds = entries[0].candidates.map((c) => c.id)
    expect(candidateIds).toContain(OVERHEAD_EMP.id)
  })

  it('overhead employee is removed from candidates when assigned', () => {
    const entries = analyzeStaffing({
      dates: [DATE],
      assignments: [makeAssignment(OVERHEAD_EMP.id, DATE)],
      templates: [TEMPLATE],
      employees: [DIRECT_EMP, OVERHEAD_EMP],
    })

    const candidateIds = entries[0].candidates.map((c) => c.id)
    expect(candidateIds).not.toContain(OVERHEAD_EMP.id)
    expect(candidateIds).toContain(DIRECT_EMP.id)
  })

  it('two direct assignments meeting requirement → status staffed', () => {
    const emp2 = { id: 'emp-direct-2', employeeFunction: null }
    const entries = analyzeStaffing({
      dates: [DATE],
      assignments: [makeAssignment(DIRECT_EMP.id, DATE), makeAssignment(emp2.id, DATE)],
      templates: [TEMPLATE],
      employees: [DIRECT_EMP, emp2, OVERHEAD_EMP],
    })

    expect(entries[0].status).toBe('staffed')
    expect(entries[0].open).toBe(0)
  })
})

// ─── computeMetrics ───────────────────────────────────────────────────────────

describe('computeMetrics — overhead tracking', () => {
  const METRIC_TEMPLATE = {
    id: 'tpl-1',
    name: 'Morning',
    startTime: '06:00',
    endTime: '14:00',
    requiredEmployees: 2,
  }

  function makeMetricsAssignment(employeeId: string, date: string) {
    return {
      rosterDay: { date },
      shiftTemplateId: 'tpl-1',
      employeeId,
    }
  }

  const INTERNAL_DIRECT = { id: 'emp-int', employeeType: 'permanent', employeeFunction: null }
  const TEMP_DIRECT = { id: 'emp-tmp', employeeType: 'temp', employeeFunction: null }
  const OVERHEAD_METRIC = {
    id: 'emp-oh',
    employeeType: 'permanent',
    employeeFunction: { overhead: true },
  }

  it('counts overhead assignments in overheadCount, not directCount', () => {
    const result = computeMetrics({
      dates: [DATE],
      assignments: [
        makeMetricsAssignment(INTERNAL_DIRECT.id, DATE),
        makeMetricsAssignment(OVERHEAD_METRIC.id, DATE),
      ],
      templates: [METRIC_TEMPLATE],
      employees: [INTERNAL_DIRECT, TEMP_DIRECT, OVERHEAD_METRIC],
    })

    expect(result.overheadCount).toBe(1)
    expect(result.directCount).toBe(1)
  })

  it('internalRatio is calculated among direct employees only', () => {
    const result = computeMetrics({
      dates: [DATE],
      assignments: [
        makeMetricsAssignment(INTERNAL_DIRECT.id, DATE),
        makeMetricsAssignment(TEMP_DIRECT.id, DATE),
        makeMetricsAssignment(OVERHEAD_METRIC.id, DATE),
      ],
      templates: [METRIC_TEMPLATE],
      employees: [INTERNAL_DIRECT, TEMP_DIRECT, OVERHEAD_METRIC],
    })

    // 1 internal + 1 temp = 2 direct; overhead not in denominator
    expect(result.directCount).toBe(2)
    expect(result.overheadCount).toBe(1)
    expect(result.internalRatio).toBeCloseTo(0.5)
  })

  it('internalRatio is 0 when only overhead employees are assigned', () => {
    const result = computeMetrics({
      dates: [DATE],
      assignments: [makeMetricsAssignment(OVERHEAD_METRIC.id, DATE)],
      templates: [METRIC_TEMPLATE],
      employees: [OVERHEAD_METRIC],
    })

    expect(result.directCount).toBe(0)
    expect(result.internalRatio).toBe(0)
  })
})
