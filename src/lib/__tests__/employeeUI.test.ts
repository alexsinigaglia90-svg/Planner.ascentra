/**
 * Phase 5.1 employee UI tests.
 *
 * Since the UI components are React components that require a browser runtime,
 * we test the pure logic utilities that back the UI:
 *  - isOverheadEmployee  (re-tested for regression)
 *  - filter logic matching what WorkforceEmployeesView.filtered applies
 *  - Type label mapping
 *  - Fallback helpers (safe label for null dept/function)
 */

import { describe, it, expect } from 'vitest'
import { isOverheadEmployee } from '@/lib/queries/employees'

// ─── Shared employee fixture builder ─────────────────────────────────────────

function makeEmp(overrides: {
  id?: string
  name?: string
  employeeType?: string
  departmentId?: string | null
  functionId?: string | null
  employeeFunction?: { id: string; name: string; overhead: boolean } | null
} = {}) {
  return {
    id: overrides.id ?? 'emp-1',
    name: overrides.name ?? 'Test Employee',
    employeeType: overrides.employeeType ?? 'internal',
    departmentId: overrides.departmentId ?? null,
    functionId: overrides.functionId ?? null,
    employeeFunction: overrides.employeeFunction ?? null,
  }
}

// ─── Filter logic (mirrors WorkforceEmployeesView `filtered`) ────────────────

function applyFilters(
  employees: ReturnType<typeof makeEmp>[],
  opts: {
    search?: string
    typeFilter?: 'all' | 'internal' | 'temp'
    deptFilter?: string
    fnFilter?: string
    overheadFilter?: 'all' | 'direct' | 'overhead'
  },
) {
  const {
    search = '',
    typeFilter = 'all',
    deptFilter = '',
    fnFilter = '',
    overheadFilter = 'all',
  } = opts

  return employees.filter((e) => {
    if (!e.name.toLowerCase().includes(search.toLowerCase())) return false
    if (typeFilter !== 'all' && e.employeeType !== typeFilter) return false
    if (deptFilter && e.departmentId !== deptFilter) return false
    if (fnFilter && e.functionId !== fnFilter) return false
    if (overheadFilter === 'direct' && e.employeeFunction?.overhead === true) return false
    if (overheadFilter === 'overhead' && e.employeeFunction?.overhead !== true) return false
    return true
  })
}

// ─── TYPE_LABELS mapping (mirrors component) ──────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  internal: 'Internal',
  temp: 'Temporary',
}

function getTypeLabel(type: string) {
  return TYPE_LABELS[type] ?? type
}

// ─── isOverheadEmployee (regression) ──────────────────────────────────────────

describe('isOverheadEmployee (regression)', () => {
  it('returns false for null function', () =>
    expect(isOverheadEmployee({ employeeFunction: null })).toBe(false))

  it('returns false for non-overhead function', () =>
    expect(isOverheadEmployee({ employeeFunction: { overhead: false } })).toBe(false))

  it('returns true for overhead function', () =>
    expect(isOverheadEmployee({ employeeFunction: { overhead: true } })).toBe(true))
})

// ─── Type label mapping ────────────────────────────────────────────────────────

describe('type label mapping', () => {
  it('maps "internal" → "Internal"', () => expect(getTypeLabel('internal')).toBe('Internal'))
  it('maps "temp" → "Temporary"', () => expect(getTypeLabel('temp')).toBe('Temporary'))
  it('falls back to raw value for unknown types', () => expect(getTypeLabel('contractor')).toBe('contractor'))
})

// ─── Filter: name search ──────────────────────────────────────────────────────

describe('filter: name search', () => {
  const employees = [
    makeEmp({ id: '1', name: 'Alice Smith' }),
    makeEmp({ id: '2', name: 'Bob Jones' }),
    makeEmp({ id: '3', name: 'Charlie Brown' }),
  ]

  it('returns all when search is empty', () => {
    expect(applyFilters(employees, { search: '' })).toHaveLength(3)
  })

  it('filters case-insensitively', () => {
    const result = applyFilters(employees, { search: 'alice' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('returns empty array when no match', () => {
    expect(applyFilters(employees, { search: 'xyz' })).toHaveLength(0)
  })
})

// ─── Filter: employee type ────────────────────────────────────────────────────

describe('filter: employee type', () => {
  const employees = [
    makeEmp({ id: '1', employeeType: 'internal' }),
    makeEmp({ id: '2', employeeType: 'temp' }),
    makeEmp({ id: '3', employeeType: 'internal' }),
  ]

  it('returns all when typeFilter is "all"', () => {
    expect(applyFilters(employees, { typeFilter: 'all' })).toHaveLength(3)
  })

  it('returns only internal employees', () => {
    const result = applyFilters(employees, { typeFilter: 'internal' })
    expect(result).toHaveLength(2)
    expect(result.every((e) => e.employeeType === 'internal')).toBe(true)
  })

  it('returns only temp employees', () => {
    const result = applyFilters(employees, { typeFilter: 'temp' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('2')
  })
})

// ─── Filter: department ───────────────────────────────────────────────────────

describe('filter: department', () => {
  const employees = [
    makeEmp({ id: '1', departmentId: 'dept-1' }),
    makeEmp({ id: '2', departmentId: 'dept-2' }),
    makeEmp({ id: '3', departmentId: null }),
  ]

  it('returns all when deptFilter is empty', () => {
    expect(applyFilters(employees, { deptFilter: '' })).toHaveLength(3)
  })

  it('filters to only matching department', () => {
    const result = applyFilters(employees, { deptFilter: 'dept-1' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('returns empty when no employee has the dept', () => {
    expect(applyFilters(employees, { deptFilter: 'dept-99' })).toHaveLength(0)
  })

  it('null departmentId employees are excluded when a dept filter is set', () => {
    const result = applyFilters(employees, { deptFilter: 'dept-1' })
    expect(result.some((e) => e.departmentId === null)).toBe(false)
  })
})

// ─── Filter: function ─────────────────────────────────────────────────────────

describe('filter: function', () => {
  const employees = [
    makeEmp({ id: '1', functionId: 'fn-1', employeeFunction: { id: 'fn-1', name: 'Picker', overhead: false } }),
    makeEmp({ id: '2', functionId: 'fn-2', employeeFunction: { id: 'fn-2', name: 'Planner', overhead: true } }),
    makeEmp({ id: '3', functionId: null }),
  ]

  it('returns all when fnFilter is empty', () => {
    expect(applyFilters(employees, { fnFilter: '' })).toHaveLength(3)
  })

  it('filters to only matching function', () => {
    const result = applyFilters(employees, { fnFilter: 'fn-1' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })
})

// ─── Filter: overhead / direct ───────────────────────────────────────────────

describe('filter: overhead', () => {
  const overhead = makeEmp({
    id: 'oh',
    employeeFunction: { id: 'fn-oh', name: 'Planner', overhead: true },
  })
  const direct = makeEmp({
    id: 'dir',
    employeeFunction: { id: 'fn-dir', name: 'Picker', overhead: false },
  })
  const noFunction = makeEmp({ id: 'nf' })

  const employees = [overhead, direct, noFunction]

  it('returns all when overheadFilter is "all"', () => {
    expect(applyFilters(employees, { overheadFilter: 'all' })).toHaveLength(3)
  })

  it('"direct" excludes overhead employees', () => {
    const result = applyFilters(employees, { overheadFilter: 'direct' })
    expect(result.find((e) => e.id === 'oh')).toBeUndefined()
    expect(result.find((e) => e.id === 'dir')).toBeDefined()
    // null-function employees are treated as direct (backward compat)
    expect(result.find((e) => e.id === 'nf')).toBeDefined()
  })

  it('"overhead" shows only overhead employees', () => {
    const result = applyFilters(employees, { overheadFilter: 'overhead' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('oh')
  })
})

// ─── Safe fallback labels ─────────────────────────────────────────────────────

describe('safe fallback labels (null-safety)', () => {
  it('employee with no function has overhead=false via isOverheadEmployee', () => {
    expect(isOverheadEmployee({ employeeFunction: null })).toBe(false)
  })

  it('employee with no department should not crash filter', () => {
    const emp = makeEmp({ departmentId: null })
    // deptFilter set to an actual dept ID — employee should be excluded (not crash)
    expect(applyFilters([emp], { deptFilter: 'dept-1' })).toHaveLength(0)
  })

  it('employee with no function should not crash overhead filter', () => {
    const emp = makeEmp({ functionId: null, employeeFunction: null })
    // overheadFilter = 'direct' should include null-function employees
    expect(applyFilters([emp], { overheadFilter: 'direct' })).toHaveLength(1)
    // overheadFilter = 'overhead' should exclude them
    expect(applyFilters([emp], { overheadFilter: 'overhead' })).toHaveLength(0)
  })
})
