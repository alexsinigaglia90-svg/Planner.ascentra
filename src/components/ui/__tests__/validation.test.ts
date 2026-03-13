import { describe, it, expect } from 'vitest'

// ── Pure validation helpers (inline — mirrors logic in AddEmployeePanel & ShiftTemplateForm) ─

function validateName(value: string): string | null {
  if (!value.trim()) return 'Naam is verplicht'
  return null
}

function validateEmail(value: string): string | null {
  if (!value.trim()) return 'E-mailadres is verplicht'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Voer een geldig e-mailadres in'
  return null
}

// ── Name validation ───────────────────────────────────────────────────────────

describe('validateName', () => {
  it('returns error for empty string', () => {
    expect(validateName('')).toBe('Naam is verplicht')
  })

  it('returns error for whitespace-only string', () => {
    expect(validateName('   ')).toBe('Naam is verplicht')
  })

  it('returns null for a valid name', () => {
    expect(validateName('Jane Doe')).toBeNull()
  })

  it('returns null for a single-word name', () => {
    expect(validateName('Jane')).toBeNull()
  })
})

// ── Email validation ──────────────────────────────────────────────────────────

describe('validateEmail', () => {
  it('returns required error for empty string', () => {
    expect(validateEmail('')).toBe('E-mailadres is verplicht')
  })

  it('returns required error for whitespace-only string', () => {
    expect(validateEmail('   ')).toBe('E-mailadres is verplicht')
  })

  it('returns format error for missing @ sign', () => {
    expect(validateEmail('notanemail')).toBe('Voer een geldig e-mailadres in')
  })

  it('returns format error for missing domain', () => {
    expect(validateEmail('user@')).toBe('Voer een geldig e-mailadres in')
  })

  it('returns format error for missing TLD', () => {
    expect(validateEmail('user@domain')).toBe('Voer een geldig e-mailadres in')
  })

  it('returns null for a valid email', () => {
    expect(validateEmail('jane@example.com')).toBeNull()
  })

  it('returns null for email with sub-domain', () => {
    expect(validateEmail('jane@mail.example.com')).toBeNull()
  })
})

// ── Error-clearing behaviour ──────────────────────────────────────────────────

describe('error clears after correction', () => {
  it('name error clears when user types a value', () => {
    let nameError: string | null = 'Naam is verplicht'
    const onChange = (newValue: string) => {
      if (nameError) nameError = validateName(newValue) === null ? null : nameError
    }
    onChange('Jane')
    expect(nameError).toBeNull()
  })

  it('email error clears when user types a valid email', () => {
    let emailError: string | null = 'E-mailadres is verplicht'
    const onChange = (newValue: string) => {
      if (emailError) emailError = validateEmail(newValue) === null ? null : emailError
    }
    onChange('jane@example.com')
    expect(emailError).toBeNull()
  })
})

// ── Bulk import — no valid rows ───────────────────────────────────────────────

describe('bulk import empty-rows guard', () => {
  it('rejects an empty array as having no valid rows', () => {
    const rows: string[] = []
    const hasValidRows = rows.some((r) => r.trim().length > 0)
    expect(hasValidRows).toBe(false)
  })

  it('accepts a non-empty array as having valid rows', () => {
    const rows = ['Jan Jansen']
    const hasValidRows = rows.some((r) => r.trim().length > 0)
    expect(hasValidRows).toBe(true)
  })

  it('rejects an array of only whitespace rows', () => {
    const rows = ['   ', '\t', '']
    const hasValidRows = rows.some((r) => r.trim().length > 0)
    expect(hasValidRows).toBe(false)
  })
})

// ── File format validation ────────────────────────────────────────────────────

describe('file format validation', () => {
  function isAllowedFileFormat(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase()
    return ext === 'csv' || ext === 'txt'
  }

  it('allows .csv files', () => {
    expect(isAllowedFileFormat('employees.csv')).toBe(true)
  })

  it('allows .txt files', () => {
    expect(isAllowedFileFormat('employees.txt')).toBe(true)
  })

  it('rejects .xlsx files', () => {
    expect(isAllowedFileFormat('employees.xlsx')).toBe(false)
  })

  it('rejects .pdf files', () => {
    expect(isAllowedFileFormat('report.pdf')).toBe(false)
  })

  it('is case-insensitive for extension', () => {
    expect(isAllowedFileFormat('employees.CSV')).toBe(true)
    expect(isAllowedFileFormat('employees.TXT')).toBe(true)
  })
})
