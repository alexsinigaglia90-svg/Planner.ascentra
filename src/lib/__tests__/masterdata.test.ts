/**
 * Masterdata safeguards — Phase 5.2 unit tests.
 *
 * Covers:
 *  - Name validation: blank, whitespace-only, too long, valid
 *  - Duplicate / case-insensitive name detection
 *  - Active-only filtering (archived items excluded from selectors)
 *  - Archived legacy reference detection (for safe selector fallback)
 *  - Archive/restore state transitions on in-memory records
 */

import { describe, it, expect } from 'vitest'

// ─── Pure helpers mimicking actions.ts validation logic ──────────────────────

function validateName(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return 'Name is required.'
  if (trimmed.length > 80) return 'Name too long (max 80 chars).'
  return null
}

function isDuplicateName(
  newName: string,
  existing: string[],
): boolean {
  const n = newName.trim().toLowerCase()
  return existing.some((e) => e.trim().toLowerCase() === n)
}

// ─── Active-only filter (mirrors query logic) ─────────────────────────────────

function filterActive<T extends { archived: boolean }>(items: T[]): T[] {
  return items.filter((i) => !i.archived)
}

function filterArchived<T extends { archived: boolean }>(items: T[]): T[] {
  return items.filter((i) => i.archived)
}

// ─── Legacy archived-reference detection ─────────────────────────────────────
// Used by selector components to decide whether to show an "(Archived)" fallback.

function isArchivedReference(currentId: string | null, activeItems: { id: string }[]): boolean {
  if (!currentId) return false
  return !activeItems.some((i) => i.id === currentId)
}

// ─── Archive / restore state helpers ─────────────────────────────────────────

function archiveItem<T extends { id: string; archived: boolean }>(items: T[], id: string): T[] {
  return items.map((i) => (i.id === id ? { ...i, archived: true } : i))
}

function restoreItem<T extends { id: string; archived: boolean }>(items: T[], id: string): T[] {
  return items.map((i) => (i.id === id ? { ...i, archived: false } : i))
}

// ─── Name validation ──────────────────────────────────────────────────────────

describe('validateName', () => {
  it('rejects empty string', () => {
    expect(validateName('')).toBe('Name is required.')
  })

  it('rejects whitespace-only string', () => {
    expect(validateName('   ')).toBe('Name is required.')
  })

  it('rejects name longer than 80 chars', () => {
    expect(validateName('a'.repeat(81))).toBe('Name too long (max 80 chars).')
  })

  it('accepts exactly 80 chars', () => {
    expect(validateName('a'.repeat(80))).toBeNull()
  })

  it('accepts a normal name', () => {
    expect(validateName('Logistics')).toBeNull()
  })

  it('accepts a name with leading/trailing spaces (trimmed)', () => {
    expect(validateName('  Logistics  ')).toBeNull()
  })
})

// ─── Duplicate name detection ─────────────────────────────────────────────────

describe('isDuplicateName', () => {
  const existing = ['Logistics', 'Picking', 'Packing']

  it('detects exact match', () => {
    expect(isDuplicateName('Logistics', existing)).toBe(true)
  })

  it('detects case-insensitive duplicate', () => {
    expect(isDuplicateName('logistics', existing)).toBe(true)
    expect(isDuplicateName('LOGISTICS', existing)).toBe(true)
    expect(isDuplicateName('lOgIstiCs', existing)).toBe(true)
  })

  it('detects trimmed duplicate', () => {
    expect(isDuplicateName('  Logistics  ', existing)).toBe(true)
  })

  it('returns false for a new unique name', () => {
    expect(isDuplicateName('Sorting', existing)).toBe(false)
  })

  it('returns false for an empty list', () => {
    expect(isDuplicateName('Logistics', [])).toBe(false)
  })
})

// ─── Active-only filtering ────────────────────────────────────────────────────

const SAMPLE_FUNCTIONS = [
  { id: 'fn-1', name: 'Operator', overhead: false, archived: false },
  { id: 'fn-2', name: 'Teamleader', overhead: false, archived: false },
  { id: 'fn-3', name: 'Logistics', overhead: true, archived: true },
  { id: 'fn-4', name: 'Admin', overhead: true, archived: true },
]

const SAMPLE_DEPARTMENTS = [
  { id: 'dept-1', name: 'Warehouse', archived: false },
  { id: 'dept-2', name: 'Office', archived: false },
  { id: 'dept-3', name: 'Old Unit', archived: true },
]

describe('filterActive', () => {
  it('excludes archived functions from selector list', () => {
    const active = filterActive(SAMPLE_FUNCTIONS)
    expect(active).toHaveLength(2)
    expect(active.every((f) => !f.archived)).toBe(true)
    expect(active.map((f) => f.id)).toEqual(['fn-1', 'fn-2'])
  })

  it('excludes archived departments from selector list', () => {
    const active = filterActive(SAMPLE_DEPARTMENTS)
    expect(active).toHaveLength(2)
    expect(active.map((d) => d.id)).toEqual(['dept-1', 'dept-2'])
  })

  it('returns all items when none are archived', () => {
    const allActive = SAMPLE_FUNCTIONS.slice(0, 2)
    expect(filterActive(allActive)).toHaveLength(2)
  })

  it('returns empty array when all are archived', () => {
    const allArchived = SAMPLE_FUNCTIONS.slice(2)
    expect(filterActive(allArchived)).toHaveLength(0)
  })
})

describe('filterArchived', () => {
  it('returns only archived functions for admin view', () => {
    const archived = filterArchived(SAMPLE_FUNCTIONS)
    expect(archived).toHaveLength(2)
    expect(archived.map((f) => f.id)).toEqual(['fn-3', 'fn-4'])
  })

  it('returns empty when no items are archived', () => {
    expect(filterArchived(SAMPLE_DEPARTMENTS.slice(0, 2))).toHaveLength(0)
  })
})

// ─── Archived legacy reference ────────────────────────────────────────────────

describe('isArchivedReference', () => {
  const activeFns = filterActive(SAMPLE_FUNCTIONS)

  it('returns false when currentId is null (unassigned)', () => {
    expect(isArchivedReference(null, activeFns)).toBe(false)
  })

  it('returns false when current item is in active list', () => {
    expect(isArchivedReference('fn-1', activeFns)).toBe(false)
    expect(isArchivedReference('fn-2', activeFns)).toBe(false)
  })

  it('returns true when current item is archived (not in active list)', () => {
    expect(isArchivedReference('fn-3', activeFns)).toBe(true)
    expect(isArchivedReference('fn-4', activeFns)).toBe(true)
  })

  it('returns true for a completely unknown id', () => {
    expect(isArchivedReference('fn-9999', activeFns)).toBe(true)
  })
})

// ─── Archive / restore state transitions ─────────────────────────────────────

describe('archiveItem', () => {
  it('sets archived=true on the target item', () => {
    const updated = archiveItem(SAMPLE_FUNCTIONS, 'fn-1')
    expect(updated.find((f) => f.id === 'fn-1')?.archived).toBe(true)
  })

  it('does not affect other items', () => {
    const updated = archiveItem(SAMPLE_FUNCTIONS, 'fn-1')
    expect(updated.filter((f) => f.id !== 'fn-1')).toEqual(
      SAMPLE_FUNCTIONS.filter((f) => f.id !== 'fn-1'),
    )
  })

  it('is idempotent on already-archived items', () => {
    const updated = archiveItem(SAMPLE_FUNCTIONS, 'fn-3')
    expect(updated.find((f) => f.id === 'fn-3')?.archived).toBe(true)
  })
})

describe('restoreItem', () => {
  it('sets archived=false on the target archived item', () => {
    const updated = restoreItem(SAMPLE_FUNCTIONS, 'fn-3')
    expect(updated.find((f) => f.id === 'fn-3')?.archived).toBe(false)
  })

  it('restoring an active item leaves it active', () => {
    const updated = restoreItem(SAMPLE_FUNCTIONS, 'fn-1')
    expect(updated.find((f) => f.id === 'fn-1')?.archived).toBe(false)
  })

  it('archive → restore round-trip restores original state', () => {
    const original = { id: 'fn-5', name: 'Pick', overhead: false, archived: false }
    const archived = archiveItem([original], 'fn-5')
    const restored = restoreItem(archived, 'fn-5')
    expect(restored[0]).toEqual(original)
  })
})

// ─── Selector safety: archived dept/function with usage ──────────────────────

describe('archive safety: usage count blocks destructive delete', () => {
  // Mirrors the guard logic in deleteDepartmentMdAction / deleteFunctionMdAction
  function canDeleteItem(usageCount: number): { allowed: boolean; reason?: string } {
    if (usageCount > 0) {
      return {
        allowed: false,
        reason: `Cannot delete — ${usageCount} employee${usageCount !== 1 ? 's are' : ' is'} assigned. Reassign them first.`,
      }
    }
    return { allowed: true }
  }

  it('blocks delete when 1 employee assigned', () => {
    const result = canDeleteItem(1)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('1 employee is assigned')
  })

  it('blocks delete when multiple employees assigned', () => {
    const result = canDeleteItem(5)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('5 employees are assigned')
  })

  it('allows delete when no employees assigned', () => {
    expect(canDeleteItem(0).allowed).toBe(true)
  })
})
