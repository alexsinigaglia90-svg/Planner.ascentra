/**
 * Shared pure utilities for the employee bulk-import pipeline.
 *
 * This module has NO runtime dependencies on Next.js, Prisma, or the browser.
 * It can be used safely from both server actions and client components,
 * and is fully testable without any infrastructure setup.
 */

// ─── Column types ─────────────────────────────────────────────────────────────

export type ImportColumn = 'name' | 'type' | 'department' | 'function' | 'team' | 'shift' | 'fixedWorkingDays' | 'location' | 'contractHours'

/**
 * All recognised header aliases, mapped to their canonical ImportColumn.
 * Matching is always case-insensitive (callers must lower-case before lookup).
 */
const HEADER_ALIASES: Record<string, ImportColumn> = {
  // name
  name: 'name',
  naam: 'name',
  employee: 'name',
  'employee name': 'name',
  medewerker: 'name',
  // type
  type: 'type',
  'employee type': 'type',
  'contract type': 'type',
  // department
  department: 'department',
  'main department': 'department',
  dept: 'department',
  afdeling: 'department',
  'main dept': 'department',
  // function
  function: 'function',
  role: 'function',
  rol: 'function',
  'job function': 'function',
  functie: 'function',
  // team
  team: 'team',
  ploeg: 'team',
  group: 'team',
  groep: 'team',
  // shift — recognised but not persisted (no DB column on Employee)
  shift: 'shift',
  dienst: 'shift',
  'preferred shift': 'shift',
  // fixedWorkingDays
  'fixed working days': 'fixedWorkingDays',
  'fixed days': 'fixedWorkingDays',
  'vaste werkdagen': 'fixedWorkingDays',
  'werkdagen': 'fixedWorkingDays',
  'working days': 'fixedWorkingDays',
  'days': 'fixedWorkingDays',
  // location
  location: 'location',
  locatie: 'location',
  site: 'location',
  'work location': 'location',
  werklocatie: 'location',
  vestiging: 'location',
  // contractHours
  'contract hours': 'contractHours',
  contracthours: 'contractHours',
  'uren per week': 'contractHours',
  'hours per week': 'contractHours',
  contracturen: 'contractHours',
  uren: 'contractHours',
  hours: 'contractHours',
  'fte uren': 'contractHours',
}

/** Map a header cell string to a canonical column, or null if unrecognised. */
export function recognizeHeader(cell: string): ImportColumn | null {
  return HEADER_ALIASES[cell.trim().toLowerCase()] ?? null
}

/**
 * Return true when the given row of cells looks like a CSV header row.
 * Criterion: at least one cell resolves to a recognised ImportColumn.
 */
export function isHeaderRow(cells: string[]): boolean {
  return cells.some((c) => recognizeHeader(c) !== null)
}

/** Maps each recognised ImportColumn to the index of that column in a header row. */
export type ColumnMap = Partial<Record<ImportColumn, number>>

/**
 * Build a ColumnMap from the cells of a header row.
 * If the same logical column appears twice, the first occurrence wins.
 */
export function buildColumnMap(headerCells: string[]): ColumnMap {
  const map: ColumnMap = {}
  for (let i = 0; i < headerCells.length; i++) {
    const col = recognizeHeader(headerCells[i])
    if (col !== null && map[col] === undefined) {
      map[col] = i
    }
  }
  return map
}

// ─── CSV line splitting ────────────────────────────────────────────────────────

/**
 * Split a single CSV line into trimmed fields.
 * Handles RFC-4180 double-quoted fields (embedded commas + escaped quotes "").
 */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuote = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (ch === '"') {
        inQuote = false
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuote = true
    } else if (ch === ',') {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

// ─── Employee type resolution ─────────────────────────────────────────────────

const TYPE_ALIASES_INTERNAL = new Set([
  'internal',
  'intern',
  'interne',
  'medewerker',
  'vast',
  'vaste',
])

const TYPE_ALIASES_TEMP = new Set([
  'temp',
  'temporary',
  'uitzendkracht',
  'tijdelijk',
  'uitzend',
  'flex',
])

/**
 * Resolve a raw type string to the canonical DB value ('internal' | 'temp'),
 * or null if the value is not recognised.
 */
export function resolveEmployeeType(raw: string): 'internal' | 'temp' | null {
  const lc = raw.trim().toLowerCase()
  if (TYPE_ALIASES_INTERNAL.has(lc)) return 'internal'
  if (TYPE_ALIASES_TEMP.has(lc)) return 'temp'
  return null
}

// ─── Name-based master-data matching ─────────────────────────────────────────

/**
 * Case-insensitive exact-name match against a list of items.
 * Returns the matched item or null.
 */
export function matchByName<T extends { id: string; name: string }>(
  raw: string,
  items: T[],
): T | null {
  const lc = raw.trim().toLowerCase()
  return items.find((item) => item.name.trim().toLowerCase() === lc) ?? null
}

// ─── Fixed working days resolution ──────────────────────────────────────────

/** Canonical weekday names stored in Employee.fixedWorkingDays */
export const CANONICAL_WEEKDAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const
export type CanonicalWeekday = (typeof CANONICAL_WEEKDAYS)[number]

/**
 * Maps every recognised weekday alias (lowercased) to its canonical form.
 * Accepts full names (English + Dutch), standard abbreviations (2–3 letters),
 * and numeric ISO weekday values 1–7 (1 = Monday).
 */
const WEEKDAY_ALIAS_MAP: Record<string, CanonicalWeekday> = {
  // English full
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
  // Dutch full
  maandag: 'Monday',
  dinsdag: 'Tuesday',
  woensdag: 'Wednesday',
  donderdag: 'Thursday',
  vrijdag: 'Friday',
  zaterdag: 'Saturday',
  zondag: 'Sunday',
  // 3-letter English abbrev
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
  // 2-letter English abbrev
  mo: 'Monday',
  tu: 'Tuesday',
  we: 'Wednesday',
  th: 'Thursday',
  fr: 'Friday',
  sa: 'Saturday',
  su: 'Sunday',
  // ISO numeric (1 = Monday … 7 = Sunday)
  '1': 'Monday',
  '2': 'Tuesday',
  '3': 'Wednesday',
  '4': 'Thursday',
  '5': 'Friday',
  '6': 'Saturday',
  '7': 'Sunday',
}

/**
 * Resolve a single raw weekday token to its canonical form, or null if
 * the token is not recognised.
 */
export function resolveWeekday(raw: string): CanonicalWeekday | null {
  return WEEKDAY_ALIAS_MAP[raw.trim().toLowerCase()] ?? null
}

/**
 * Parse a raw fixed-working-days cell value into a deduplicated, ordered
 * array of canonical weekday names.
 *
 * Accepts any of:
 *   - Semicolon-separated:  "Monday;Wednesday;Friday"
 *   - Pipe-separated:       "Mon|Wed|Fri"
 *   - Space-separated:      "Mo We Fr"
 *   - Single value:         "Monday"
 *   - Empty / blank string  → returns []
 *
 * Returns `null` when one or more tokens are not recognised weekday values.
 * Callers should treat null as a validation failure.
 */
export function resolveFixedWorkingDays(raw: string): CanonicalWeekday[] | null {
  const trimmed = raw.trim()
  if (!trimmed) return []

  // Detect separator: prefer `;` then `|` then fall back to space
  const separator = trimmed.includes(';') ? ';' : trimmed.includes('|') ? '|' : ' '
  const tokens = trimmed.split(separator).map((t) => t.trim()).filter(Boolean)

  const result: CanonicalWeekday[] = []
  const seen = new Set<string>()
  for (const token of tokens) {
    const canonical = resolveWeekday(token)
    if (canonical === null) return null
    if (!seen.has(canonical)) {
      seen.add(canonical)
      result.push(canonical)
    }
  }

  // Return in ISO week order
  return CANONICAL_WEEKDAYS.filter((d) => seen.has(d))
}

// ─── Row validation ───────────────────────────────────────────────────────────

export type RowValidationErrors = {
  name: string | null
  type: string | null
  department: string | null
  function: string | null
  fixedWorkingDays: string | null
}

/**
 * Validate the raw string values from one import row against the provided
 * master-data lists. Returns a RowValidationErrors object — all null = valid.
 *
 * @param raw        Raw field strings as parsed from the CSV.
 * @param departments Active departments available for resolution.
 * @param functions   Active functions available for resolution.
 */
export function validateRow(
  raw: { name: string; rawType: string; rawDepartment: string; rawFunction: string; rawFixedWorkingDays?: string },
  departments: Array<{ id: string; name: string }>,
  functions: Array<{ id: string; name: string }>,
): RowValidationErrors {
  const errors: RowValidationErrors = {
    name: null,
    type: null,
    department: null,
    function: null,
    fixedWorkingDays: null,
  }

  if (!raw.name.trim()) {
    errors.name = 'Name is required.'
  }

  if (!raw.rawType.trim()) {
    errors.type = 'Type is required. Use "Internal" or "Temp".'
  } else if (resolveEmployeeType(raw.rawType) === null) {
    errors.type = `Unknown type "${raw.rawType}". Use "Internal" or "Temp".`
  }

  if (!raw.rawDepartment.trim()) {
    errors.department = 'Department is required.'
  } else if (matchByName(raw.rawDepartment, departments) === null) {
    errors.department = `Unknown department "${raw.rawDepartment}".`
  }

  if (!raw.rawFunction.trim()) {
    errors.function = 'Function is required.'
  } else if (matchByName(raw.rawFunction, functions) === null) {
    errors.function = `Unknown function "${raw.rawFunction}".`
  }

  if (raw.rawFixedWorkingDays !== undefined && raw.rawFixedWorkingDays.trim() !== '') {
    if (resolveFixedWorkingDays(raw.rawFixedWorkingDays) === null) {
      errors.fixedWorkingDays = `Invalid working days "${raw.rawFixedWorkingDays}". Use day names or abbreviations separated by ; or |.`
    }
  }

  return errors
}

/** Returns true when any field in RowValidationErrors has a non-null message. */
export function hasRowErrors(errors: RowValidationErrors): boolean {
  return Object.values(errors).some((v) => v !== null)
}
