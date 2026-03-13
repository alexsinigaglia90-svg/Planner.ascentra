import { describe, it, expect } from 'vitest'
import {
  recognizeHeader,
  isHeaderRow,
  buildColumnMap,
  splitCsvLine,
  resolveEmployeeType,
  matchByName,
  validateRow,
  hasRowErrors,
  resolveWeekday,
  resolveFixedWorkingDays,
} from '../employeeImport'

// ─── Fixture master data ──────────────────────────────────────────────────────

const DEPARTMENTS = [
  { id: 'dept-1', name: 'Productie' },
  { id: 'dept-2', name: 'Logistiek' },
  { id: 'dept-3', name: 'Administratie' },
]

const FUNCTIONS = [
  { id: 'fn-1', name: 'Picker', overhead: false },
  { id: 'fn-2', name: 'Vorkheftruckchauffeur', overhead: false },
  { id: 'fn-3', name: 'Planner', overhead: true },
]

// ─── recognizeHeader ──────────────────────────────────────────────────────────

describe('recognizeHeader', () => {
  it('recognises "name" → name', () => expect(recognizeHeader('name')).toBe('name'))
  it('recognises "Naam" case-insensitively → name', () => expect(recognizeHeader('Naam')).toBe('name'))
  it('recognises "Main Department" → department', () => expect(recognizeHeader('Main Department')).toBe('department'))
  it('recognises "Role" → function', () => expect(recognizeHeader('Role')).toBe('function'))
  it('recognises "Ploeg" → team', () => expect(recognizeHeader('Ploeg')).toBe('team'))
  it('recognises "Shift" → shift', () => expect(recognizeHeader('Shift')).toBe('shift'))
  it('returns null for unknown header', () => expect(recognizeHeader('RandomColumn')).toBeNull())
  it('trims surrounding whitespace', () => expect(recognizeHeader('  name  ')).toBe('name'))
  it('recognises "Location" → location', () => expect(recognizeHeader('Location')).toBe('location'))
  it('recognises "Locatie" → location', () => expect(recognizeHeader('Locatie')).toBe('location'))
  it('recognises "vestiging" → location', () => expect(recognizeHeader('Vestiging')).toBe('location'))
  it('recognises "Contract Hours" → contractHours', () => expect(recognizeHeader('Contract Hours')).toBe('contractHours'))
  it('recognises "Uren per week" → contractHours', () => expect(recognizeHeader('Uren per week')).toBe('contractHours'))
  it('recognises "hours" → contractHours', () => expect(recognizeHeader('Hours')).toBe('contractHours'))
})

// ─── isHeaderRow ─────────────────────────────────────────────────────────────

describe('isHeaderRow', () => {
  it('returns true when a cell is a known header', () => {
    expect(isHeaderRow(['Name', 'Type', 'Department'])).toBe(true)
  })
  it('returns true for partial header row', () => {
    expect(isHeaderRow(['Jan Jansen', 'Productie', 'Type'])).toBe(true)
  })
  it('returns false for data-only rows', () => {
    expect(isHeaderRow(['Jan Jansen', 'Ploeg A'])).toBe(false)
  })
  it('returns false for empty cells', () => {
    expect(isHeaderRow(['', '', ''])).toBe(false)
  })
})

// ─── buildColumnMap ───────────────────────────────────────────────────────────

describe('buildColumnMap', () => {
  it('builds correct map from canonical headers', () => {
    const map = buildColumnMap(['Name', 'Type', 'Department', 'Function', 'Team'])
    expect(map.name).toBe(0)
    expect(map.type).toBe(1)
    expect(map.department).toBe(2)
    expect(map.function).toBe(3)
    expect(map.team).toBe(4)
  })
  it('uses first occurrence on duplicate columns', () => {
    const map = buildColumnMap(['name', 'naam'])
    expect(map.name).toBe(0)
  })
  it('ignores unrecognised columns', () => {
    const map = buildColumnMap(['Name', 'Birthdate', 'Department'])
    expect(map.name).toBe(0)
    expect(map.department).toBe(2)
    expect(Object.keys(map)).toHaveLength(2)
  })
  it('recognises "Location" → location', () => {
    const map = buildColumnMap(['Name', 'Location', 'Department'])
    expect(map.location).toBe(1)
  })
  it('recognises "Locatie" (Dutch) → location', () => {
    const map = buildColumnMap(['Name', 'Locatie'])
    expect(map.location).toBe(1)
  })
  it('recognises "Contract Hours" → contractHours', () => {
    const map = buildColumnMap(['Name', 'Contract Hours'])
    expect(map.contractHours).toBe(1)
  })
  it('recognises "Uren per week" (Dutch) → contractHours', () => {
    const map = buildColumnMap(['Naam', 'Uren per week'])
    expect(map.contractHours).toBe(1)
  })
})

// ─── splitCsvLine ─────────────────────────────────────────────────────────────

describe('splitCsvLine', () => {
  it('splits a simple comma-separated line', () => {
    expect(splitCsvLine('Jan Jansen,Internal,Productie')).toEqual(['Jan Jansen', 'Internal', 'Productie'])
  })
  it('handles quoted field with comma inside', () => {
    expect(splitCsvLine('"Jansen, Jan",Internal,Productie')).toEqual(['Jansen, Jan', 'Internal', 'Productie'])
  })
  it('handles escaped double-quote inside quoted field', () => {
    expect(splitCsvLine('"He said ""hello""",Temp,Logistiek')).toEqual(['He said "hello"', 'Temp', 'Logistiek'])
  })
  it('trims whitespace around fields', () => {
    expect(splitCsvLine(' Jan , Internal , Productie ')).toEqual(['Jan', 'Internal', 'Productie'])
  })
  it('returns single element for line with no commas', () => {
    expect(splitCsvLine('Jan Jansen')).toEqual(['Jan Jansen'])
  })
})

// ─── resolveEmployeeType ──────────────────────────────────────────────────────

describe('resolveEmployeeType', () => {
  it('resolves "Internal" → internal', () => expect(resolveEmployeeType('Internal')).toBe('internal'))
  it('resolves "internal" → internal', () => expect(resolveEmployeeType('internal')).toBe('internal'))
  it('resolves "Intern" → internal', () => expect(resolveEmployeeType('Intern')).toBe('internal'))
  it('resolves "medewerker" → internal', () => expect(resolveEmployeeType('medewerker')).toBe('internal'))
  it('resolves "Temp" → temp', () => expect(resolveEmployeeType('Temp')).toBe('temp'))
  it('resolves "temporary" → temp', () => expect(resolveEmployeeType('temporary')).toBe('temp'))
  it('resolves "uitzendkracht" → temp', () => expect(resolveEmployeeType('uitzendkracht')).toBe('temp'))
  it('resolves "flex" → temp', () => expect(resolveEmployeeType('flex')).toBe('temp'))
  it('resolves "Temporary" → temp (long-form alias)', () => expect(resolveEmployeeType('Temporary')).toBe('temp'))
  it('returns null for empty string', () => expect(resolveEmployeeType('')).toBeNull())
  it('returns null for unknown value "Contractor"', () => expect(resolveEmployeeType('Contractor')).toBeNull())
  it('trims whitespace before matching', () => expect(resolveEmployeeType('  Internal  ')).toBe('internal'))
})

// ─── matchByName ─────────────────────────────────────────────────────────────

describe('matchByName', () => {
  it('returns the matched department on exact case-insensitive match', () => {
    const result = matchByName('productie', DEPARTMENTS)
    expect(result?.id).toBe('dept-1')
  })
  it('is case-insensitive', () => {
    const result = matchByName('LOGISTIEK', DEPARTMENTS)
    expect(result?.id).toBe('dept-2')
  })
  it('returns null for unknown name', () => {
    expect(matchByName('Outbound North', DEPARTMENTS)).toBeNull()
  })
  it('returns null for empty string', () => {
    expect(matchByName('', DEPARTMENTS)).toBeNull()
  })
  it('trims whitespace before matching', () => {
    const result = matchByName('  Productie  ', DEPARTMENTS)
    expect(result?.id).toBe('dept-1')
  })
})

// ─── validateRow ─────────────────────────────────────────────────────────────

describe('validateRow — valid row', () => {
  it('returns all-null errors for a fully valid row', () => {
    const errors = validateRow(
      { name: 'Jan Jansen', rawType: 'Internal', rawDepartment: 'Productie', rawFunction: 'Picker' },
      DEPARTMENTS,
      FUNCTIONS,
    )
    expect(errors.name).toBeNull()
    expect(errors.type).toBeNull()
    expect(errors.department).toBeNull()
    expect(errors.function).toBeNull()
  })

  it('accepts temp employees', () => {
    const errors = validateRow(
      { name: 'P Pieters', rawType: 'Temp', rawDepartment: 'Logistiek', rawFunction: 'Vorkheftruckchauffeur' },
      DEPARTMENTS,
      FUNCTIONS,
    )
    expect(hasRowErrors(errors)).toBe(false)
  })
})

describe('validateRow — missing name', () => {
  it('returns a name error for blank name', () => {
    const errors = validateRow(
      { name: '', rawType: 'Internal', rawDepartment: 'Productie', rawFunction: 'Picker' },
      DEPARTMENTS,
      FUNCTIONS,
    )
    expect(errors.name).not.toBeNull()
    expect(errors.name).toContain('required')
  })

  it('returns a name error for whitespace-only name', () => {
    const errors = validateRow(
      { name: '   ', rawType: 'Internal', rawDepartment: 'Productie', rawFunction: 'Picker' },
      DEPARTMENTS,
      FUNCTIONS,
    )
    expect(errors.name).not.toBeNull()
  })
})

describe('validateRow — invalid type', () => {
  it('returns a type error for missing type', () => {
    const errors = validateRow(
      { name: 'Jan Jansen', rawType: '', rawDepartment: 'Productie', rawFunction: 'Picker' },
      DEPARTMENTS,
      FUNCTIONS,
    )
    expect(errors.type).not.toBeNull()
    expect(errors.type).toContain('required')
  })

  it('accepts "Temporary" as valid alias for temp', () => {
    const errors = validateRow(
      { name: 'Jan Jansen', rawType: 'Temporary', rawDepartment: 'Productie', rawFunction: 'Picker' },
      DEPARTMENTS,
      FUNCTIONS,
    )
    expect(errors.type).toBeNull()
  })

  it('returns a type error for "Contractor"', () => {
    const errors = validateRow(
      { name: 'Jan Jansen', rawType: 'Contractor', rawDepartment: 'Productie', rawFunction: 'Picker' },
      DEPARTMENTS,
      FUNCTIONS,
    )
    expect(errors.type).not.toBeNull()
  })
})

describe('validateRow — unknown department', () => {
  it('returns a department error for missing department', () => {
    const errors = validateRow(
      { name: 'Jan Jansen', rawType: 'Internal', rawDepartment: '', rawFunction: 'Picker' },
      DEPARTMENTS,
      FUNCTIONS,
    )
    expect(errors.department).not.toBeNull()
    expect(errors.department).toContain('required')
  })

  it('returns a department error for unknown department value', () => {
    const errors = validateRow(
      { name: 'Jan Jansen', rawType: 'Internal', rawDepartment: 'Outbound North', rawFunction: 'Picker' },
      DEPARTMENTS,
      FUNCTIONS,
    )
    expect(errors.department).not.toBeNull()
    expect(errors.department).toContain('Outbound North')
  })

  it('does NOT create the department — just fails validation', () => {
    validateRow(
      { name: 'Jan Jansen', rawType: 'Internal', rawDepartment: 'New Dept', rawFunction: 'Picker' },
      DEPARTMENTS,
      FUNCTIONS,
    )
    // Verify the departments list is still the same (pure function, no mutation)
    expect(DEPARTMENTS).toHaveLength(3)
  })
})

describe('validateRow — unknown function', () => {
  it('returns a function error for missing function', () => {
    const errors = validateRow(
      { name: 'Jan Jansen', rawType: 'Internal', rawDepartment: 'Productie', rawFunction: '' },
      DEPARTMENTS,
      FUNCTIONS,
    )
    expect(errors.function).not.toBeNull()
    expect(errors.function).toContain('required')
  })

  it('returns a function error for unknown function', () => {
    const errors = validateRow(
      { name: 'Jan Jansen', rawType: 'Internal', rawDepartment: 'Productie', rawFunction: 'Senior Picker' },
      DEPARTMENTS,
      FUNCTIONS,
    )
    expect(errors.function).not.toBeNull()
    expect(errors.function).toContain('Senior Picker')
  })

  it('does NOT create the function — just fails validation', () => {
    validateRow(
      { name: 'Jan Jansen', rawType: 'Internal', rawDepartment: 'Productie', rawFunction: 'New Role' },
      DEPARTMENTS,
      FUNCTIONS,
    )
    expect(FUNCTIONS).toHaveLength(3)
  })
})

describe('validateRow — multiple errors', () => {
  it('reports all errors on a completely empty row', () => {
    const errors = validateRow(
      { name: '', rawType: '', rawDepartment: '', rawFunction: '' },
      DEPARTMENTS,
      FUNCTIONS,
    )
    expect(errors.name).not.toBeNull()
    expect(errors.type).not.toBeNull()
    expect(errors.department).not.toBeNull()
    expect(errors.function).not.toBeNull()
    expect(hasRowErrors(errors)).toBe(true)
  })
})

// ─── hasRowErrors ─────────────────────────────────────────────────────────────

describe('hasRowErrors', () => {
  it('returns false when all errors are null', () => {
    expect(hasRowErrors({ name: null, type: null, department: null, function: null, fixedWorkingDays: null })).toBe(false)
  })
  it('returns true when any error is non-null', () => {
    expect(hasRowErrors({ name: 'required', type: null, department: null, function: null, fixedWorkingDays: null })).toBe(true)
  })
  it('returns true when fixedWorkingDays has an error', () => {
    expect(hasRowErrors({ name: null, type: null, department: null, function: null, fixedWorkingDays: 'Invalid' })).toBe(true)
  })
})

// ─── resolveWeekday ─────────────────────────────────────────────────────

describe('resolveWeekday', () => {
  it('resolves full English name', () => expect(resolveWeekday('Monday')).toBe('Monday'))
  it('resolves lowercase full name', () => expect(resolveWeekday('monday')).toBe('Monday'))
  it('resolves Dutch full name', () => expect(resolveWeekday('maandag')).toBe('Monday'))
  it('resolves 3-letter abbreviation', () => expect(resolveWeekday('Mon')).toBe('Monday'))
  it('resolves 2-letter abbreviation', () => expect(resolveWeekday('Mo')).toBe('Monday'))
  it('resolves ISO numeric 1 → Monday', () => expect(resolveWeekday('1')).toBe('Monday'))
  it('resolves ISO numeric 5 → Friday', () => expect(resolveWeekday('5')).toBe('Friday'))
  it('resolves ISO numeric 7 → Sunday', () => expect(resolveWeekday('7')).toBe('Sunday'))
  it('resolves Saturday', () => expect(resolveWeekday('Saturday')).toBe('Saturday'))
  it('resolves Dutch vrijdag → Friday', () => expect(resolveWeekday('vrijdag')).toBe('Friday'))
  it('returns null for unknown token', () => expect(resolveWeekday('weekday')).toBeNull())
  it('returns null for empty string', () => expect(resolveWeekday('')).toBeNull())
  it('trims whitespace before matching', () => expect(resolveWeekday('  Friday  ')).toBe('Friday'))
})

// ─── resolveFixedWorkingDays ───────────────────────────────────────────────

describe('resolveFixedWorkingDays', () => {
  it('returns empty array for empty string', () => {
    expect(resolveFixedWorkingDays('')).toEqual([])
  })
  it('returns empty array for whitespace-only string', () => {
    expect(resolveFixedWorkingDays('   ')).toEqual([])
  })
  it('resolves a single day', () => {
    expect(resolveFixedWorkingDays('Monday')).toEqual(['Monday'])
  })
  it('resolves semicolon-separated days', () => {
    expect(resolveFixedWorkingDays('Monday;Wednesday;Friday')).toEqual(['Monday', 'Wednesday', 'Friday'])
  })
  it('resolves pipe-separated days', () => {
    expect(resolveFixedWorkingDays('Mon|Wed|Fri')).toEqual(['Monday', 'Wednesday', 'Friday'])
  })
  it('resolves space-separated days', () => {
    expect(resolveFixedWorkingDays('Mo We Fr')).toEqual(['Monday', 'Wednesday', 'Friday'])
  })
  it('resolves mixed-case input', () => {
    expect(resolveFixedWorkingDays('MONDAY;friday')).toEqual(['Monday', 'Friday'])
  })
  it('resolves Dutch names', () => {
    expect(resolveFixedWorkingDays('maandag;vrijdag')).toEqual(['Monday', 'Friday'])
  })
  it('resolves ISO numeric values', () => {
    expect(resolveFixedWorkingDays('1;3;5')).toEqual(['Monday', 'Wednesday', 'Friday'])
  })
  it('deduplicates repeated days', () => {
    expect(resolveFixedWorkingDays('Monday;Monday;Friday')).toEqual(['Monday', 'Friday'])
  })
  it('returns days in ISO week order regardless of input order', () => {
    expect(resolveFixedWorkingDays('Friday;Monday;Wednesday')).toEqual(['Monday', 'Wednesday', 'Friday'])
  })
  it('returns null for an unrecognised token', () => {
    expect(resolveFixedWorkingDays('Monday;Blorp')).toBeNull()
  })
  it('returns null when a single token is invalid', () => {
    expect(resolveFixedWorkingDays('NotADay')).toBeNull()
  })
})

// ─── validateRow — fixedWorkingDays field ─────────────────────────────────────

describe('validateRow — fixedWorkingDays field', () => {
  it('passes when rawFixedWorkingDays is omitted', () => {
    const errors = validateRow(
      { name: 'Jan Jansen', rawType: 'Internal', rawDepartment: 'Productie', rawFunction: 'Picker' },
      DEPARTMENTS,
      FUNCTIONS,
    )
    expect(errors.fixedWorkingDays).toBeNull()
  })

  it('passes when rawFixedWorkingDays is empty string', () => {
    const errors = validateRow(
      { name: 'Jan Jansen', rawType: 'Internal', rawDepartment: 'Productie', rawFunction: 'Picker', rawFixedWorkingDays: '' },
      DEPARTMENTS,
      FUNCTIONS,
    )
    expect(errors.fixedWorkingDays).toBeNull()
  })

  it('passes for valid semicolon-separated days', () => {
    const errors = validateRow(
      { name: 'Jan Jansen', rawType: 'Internal', rawDepartment: 'Productie', rawFunction: 'Picker', rawFixedWorkingDays: 'Monday;Wednesday;Friday' },
      DEPARTMENTS,
      FUNCTIONS,
    )
    expect(errors.fixedWorkingDays).toBeNull()
  })

  it('passes for Dutch day names', () => {
    const errors = validateRow(
      { name: 'Jan Jansen', rawType: 'Internal', rawDepartment: 'Productie', rawFunction: 'Picker', rawFixedWorkingDays: 'maandag;vrijdag' },
      DEPARTMENTS,
      FUNCTIONS,
    )
    expect(errors.fixedWorkingDays).toBeNull()
  })

  it('returns an error for an invalid day token', () => {
    const errors = validateRow(
      { name: 'Jan Jansen', rawType: 'Internal', rawDepartment: 'Productie', rawFunction: 'Picker', rawFixedWorkingDays: 'Monday;Blorp' },
      DEPARTMENTS,
      FUNCTIONS,
    )
    expect(errors.fixedWorkingDays).not.toBeNull()
    expect(errors.fixedWorkingDays).toContain('Blorp')
  })
})
