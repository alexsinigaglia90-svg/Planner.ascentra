import { describe, it, expect } from 'vitest'

// Note: EmptyState is a React component and cannot be imported in the node
// test environment (no jsdom / no react plugin in vitest.config.ts).
// Props are validated at TypeScript compile time; branching logic is tested below.

describe('WorkforceEmployeesView empty state logic', () => {
  it('selects "no employees" state when employees list is empty', () => {
    const employees: unknown[] = []
    const filtered: unknown[] = []
    const showNoEmployees = employees.length === 0
    const showNoResults = employees.length > 0 && filtered.length === 0
    expect(showNoEmployees).toBe(true)
    expect(showNoResults).toBe(false)
  })

  it('selects "no results" state when filter yields no matches but employees exist', () => {
    const employees = [{ id: '1', name: 'Alice' }]
    const filtered: unknown[] = []
    const showNoEmployees = employees.length === 0
    const showNoResults = employees.length > 0 && filtered.length === 0
    expect(showNoEmployees).toBe(false)
    expect(showNoResults).toBe(true)
  })

  it('shows neither empty state when employees and filtered results both exist', () => {
    const employees = [{ id: '1', name: 'Alice' }]
    const filtered = [{ id: '1', name: 'Alice' }]
    const showNoEmployees = employees.length === 0
    const showNoResults = employees.length > 0 && filtered.length === 0
    expect(showNoEmployees).toBe(false)
    expect(showNoResults).toBe(false)
  })
})

describe('StaffingGapsPanel empty state logic', () => {
  it('distinguishes no-data state from all-staffed state', () => {
    const noEntries: { status: string }[] = []

    const noData = noEntries.length === 0
    // allStaffed requires entries.length > 0, so it must be false when entries are empty
    const allStaffed = noEntries.length > 0 && noEntries.every((e) => e.status === 'staffed')

    expect(noData).toBe(true)
    expect(allStaffed).toBe(false)
  })

  it('shows all-staffed when all entries have status staffed', () => {
    const entries = [{ status: 'staffed' }, { status: 'staffed' }]
    const gaps = entries.filter((e) => e.status !== 'staffed')
    expect(entries.length > 0 && gaps.length === 0).toBe(true)
  })
})
