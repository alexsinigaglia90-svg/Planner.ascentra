/**
 * AI Column Mapper — semantic column-to-field matching.
 *
 * Uses a 3-layer strategy:
 * 1. Exact alias match (existing HEADER_ALIASES)
 * 2. Keyword scoring with weighted terms
 * 3. Multi-value detection (semicolons, pipes)
 *
 * No external API calls — runs entirely in-process.
 */

import { recognizeHeader, type ImportColumn } from './employeeImport'

// ── Extended field types (beyond core ImportColumn) ──────────────────────────

export type ExtendedField =
  | ImportColumn
  | 'skills'
  | 'process'
  | 'email'
  | 'phone'
  | 'skip'

export interface ColumnMapping {
  sourceIndex: number
  sourceHeader: string
  targetField: ExtendedField
  confidence: number           // 0-1
  method: 'exact' | 'alias' | 'semantic' | 'manual'
  isMultiValue: boolean        // detected ; or | separators in data
  alternatives: { field: ExtendedField; confidence: number }[]
}

export interface MappingResult {
  mappings: ColumnMapping[]
  unmappedColumns: number[]    // indices not mapped to any field
  warnings: string[]
}

// ── Keyword definitions per field ────────────────────────────────────────────

interface FieldKeywords {
  field: ExtendedField
  primary: string[]        // high weight (3x)
  secondary: string[]      // medium weight (2x)
  tertiary: string[]       // low weight (1x)
  negative: string[]       // penalty terms
}

const FIELD_KEYWORDS: FieldKeywords[] = [
  {
    field: 'name',
    primary: ['naam', 'name', 'medewerker', 'werknemer', 'employee', 'personeelslid', 'volledige naam', 'full name'],
    secondary: ['persoon', 'person', 'staff', 'worker', 'member', 'collega', 'voor', 'achter', 'voornaam', 'achternaam'],
    tertiary: ['wie', 'who'],
    negative: ['team', 'afdeling', 'shift', 'skill', 'email', 'telefoon'],
  },
  {
    field: 'type',
    primary: ['type', 'contract type', 'employee type', 'dienstverband', 'contract'],
    secondary: ['soort', 'categorie', 'intern', 'temp', 'vast', 'flex', 'aard'],
    tertiary: ['verband', 'status'],
    negative: ['naam', 'afdeling', 'shift'],
  },
  {
    field: 'department',
    primary: ['afdeling', 'department', 'dept', 'afd', 'business unit'],
    secondary: ['divisie', 'sector', 'unit', 'werkgebied', 'bu', 'organisatie'],
    tertiary: ['groep', 'area', 'zone', 'hal'],
    negative: ['hoofd', 'manager', 'naam', 'functie'],
  },
  {
    field: 'function',
    primary: ['functie', 'function', 'rol', 'role', 'job', 'job title'],
    secondary: ['positie', 'position', 'titel', 'title', 'beroep', 'occupation'],
    tertiary: ['taak', 'task', 'werk'],
    negative: ['afdeling', 'naam', 'team'],
  },
  {
    field: 'team',
    primary: ['team', 'ploeg', 'groep', 'group', 'crew'],
    secondary: ['rooster', 'rotation', 'shift team', 'werkgroep'],
    tertiary: ['squad', 'brigade'],
    negative: ['naam', 'afdeling', 'functie'],
  },
  {
    field: 'shift',
    primary: ['shift', 'dienst', 'rooster', 'preferred shift', 'werkshift'],
    secondary: ['tijdslot', 'slot', 'schema', 'schedule', 'werktijd'],
    tertiary: ['ochtend', 'middag', 'avond', 'nacht'],
    negative: ['naam', 'team', 'afdeling'],
  },
  {
    field: 'contractHours',
    primary: ['contract', 'uren', 'hours', 'contracturen', 'fte'],
    secondary: ['per week', 'werkuren', 'arbeidsuren', 'weekuren', 'working hours'],
    tertiary: ['omvang', 'volume', 'capaciteit'],
    negative: ['naam', 'overuren', 'overtime'],
  },
  {
    field: 'fixedWorkingDays',
    primary: ['werkdagen', 'working days', 'vaste dagen', 'fixed days'],
    secondary: ['dagen', 'days', 'beschikbaar', 'available', 'inzetbaar'],
    tertiary: ['dag', 'day'],
    negative: ['verlof', 'leave', 'ziek', 'sick'],
  },
  {
    field: 'location',
    primary: ['locatie', 'location', 'vestiging', 'site', 'werklocatie'],
    secondary: ['kantoor', 'office', 'warehouse', 'magazijn', 'filiaal', 'branch'],
    tertiary: ['plaats', 'city', 'adres'],
    negative: ['naam', 'afdeling'],
  },
  {
    field: 'skills',
    primary: ['skill', 'skills', 'vaardigheid', 'vaardigheden', 'competentie', 'competenties'],
    secondary: ['certificaat', 'certificaten', 'certificate', 'kwalificatie', 'bevoegdheid'],
    tertiary: ['kennis', 'ervaring', 'expertise', 'opleiding', 'training'],
    negative: ['naam', 'functie', 'afdeling'],
  },
  {
    field: 'process',
    primary: ['proces', 'process', 'processen', 'processes'],
    secondary: ['werkproces', 'taak', 'activiteit', 'activity'],
    tertiary: ['bewerking', 'operation'],
    negative: ['naam', 'afdeling', 'score'],
  },
  {
    field: 'email',
    primary: ['email', 'e-mail', 'mail', 'emailadres'],
    secondary: ['e-mailadres', 'mail adres', 'contact'],
    tertiary: [],
    negative: ['naam', 'telefoon'],
  },
  {
    field: 'phone',
    primary: ['telefoon', 'phone', 'tel', 'mobiel', 'mobile', 'telefoonnummer'],
    secondary: ['gsm', 'nummer', 'number', 'contact'],
    tertiary: [],
    negative: ['naam', 'email'],
  },
]

// ── Scoring engine ───────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text.trim().toLowerCase()
    .replace(/[_\-\/\\]/g, ' ')
    .replace(/\s+/g, ' ')
}

function tokenize(text: string): string[] {
  return normalize(text).split(' ').filter(Boolean)
}

function scoreField(header: string, fk: FieldKeywords): number {
  const norm = normalize(header)
  const tokens = tokenize(header)
  let score = 0

  // Full string matches (highest weight)
  if (fk.primary.some((k) => norm === k || norm.includes(k))) score += 10
  if (fk.secondary.some((k) => norm === k || norm.includes(k))) score += 5

  // Token matches
  for (const token of tokens) {
    if (fk.primary.some((k) => k.includes(token) || token.includes(k))) score += 3
    if (fk.secondary.some((k) => k.includes(token) || token.includes(k))) score += 2
    if (fk.tertiary.some((k) => k.includes(token) || token.includes(k))) score += 1
  }

  // Negative penalty
  for (const token of tokens) {
    if (fk.negative.some((k) => token === k)) score -= 4
  }

  return Math.max(0, score)
}

function scoreToConfidence(score: number, maxScore: number): number {
  if (maxScore === 0) return 0
  return Math.min(0.99, Math.round((score / maxScore) * 100) / 100)
}

// ── Multi-value detection ────────────────────────────────────────────────────

/**
 * Check if a column contains multi-value data (e.g., "Heftruck; EHBO; VCA").
 * Samples up to 10 non-empty data cells.
 */
export function detectMultiValue(dataCells: string[]): boolean {
  const sample = dataCells.filter(Boolean).slice(0, 10)
  if (sample.length === 0) return false
  const multiCount = sample.filter((cell) =>
    cell.includes(';') || (cell.includes('|') && !cell.includes('||'))
  ).length
  return multiCount / sample.length >= 0.3 // ≥30% of cells have separators
}

// ── Main mapping function ────────────────────────────────────────────────────

/**
 * Analyze CSV headers and data to produce intelligent column mappings.
 *
 * @param headers  Array of header cell strings from the first row
 * @param dataRows First ~10 data rows for multi-value detection
 */
export function mapColumns(
  headers: string[],
  dataRows: string[][] = [],
): MappingResult {
  const mappings: ColumnMapping[] = []
  const usedFields = new Set<ExtendedField>()
  const warnings: string[] = []

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]
    if (!header.trim()) {
      mappings.push({
        sourceIndex: i,
        sourceHeader: header,
        targetField: 'skip',
        confidence: 1,
        method: 'exact',
        isMultiValue: false,
        alternatives: [],
      })
      continue
    }

    // Layer 1: Exact alias match (existing system)
    const exactMatch = recognizeHeader(header)
    if (exactMatch && !usedFields.has(exactMatch)) {
      const dataCells = dataRows.map((row) => row[i] ?? '')
      mappings.push({
        sourceIndex: i,
        sourceHeader: header,
        targetField: exactMatch,
        confidence: 1,
        method: 'exact',
        isMultiValue: detectMultiValue(dataCells),
        alternatives: [],
      })
      usedFields.add(exactMatch)
      continue
    }

    // Layer 2+3: Keyword semantic scoring
    const scores: { field: ExtendedField; score: number }[] = []
    for (const fk of FIELD_KEYWORDS) {
      if (usedFields.has(fk.field)) continue
      const s = scoreField(header, fk)
      if (s > 0) scores.push({ field: fk.field, score: s })
    }
    scores.sort((a, b) => b.score - a.score)

    const maxPossible = 16 // max realistic score
    const dataCells = dataRows.map((row) => row[i] ?? '')
    const isMulti = detectMultiValue(dataCells)

    if (scores.length > 0 && scores[0].score >= 3) {
      const best = scores[0]
      const confidence = scoreToConfidence(best.score, maxPossible)

      // If confidence is low and data looks like multi-value, prefer 'skills'
      let targetField = best.field
      if (isMulti && confidence < 0.6 && !usedFields.has('skills')) {
        targetField = 'skills'
      }

      mappings.push({
        sourceIndex: i,
        sourceHeader: header,
        targetField,
        confidence: Math.max(0.4, confidence),
        method: exactMatch ? 'alias' : 'semantic',
        isMultiValue: isMulti,
        alternatives: scores.slice(1, 4).map((s) => ({
          field: s.field,
          confidence: scoreToConfidence(s.score, maxPossible),
        })),
      })
      usedFields.add(targetField)
    } else {
      // No match — mark as skip
      mappings.push({
        sourceIndex: i,
        sourceHeader: header,
        targetField: 'skip',
        confidence: 0,
        method: 'semantic',
        isMultiValue: isMulti,
        alternatives: scores.slice(0, 3).map((s) => ({
          field: s.field,
          confidence: scoreToConfidence(s.score, maxPossible),
        })),
      })
    }
  }

  // Warnings
  const hasMandatory = (field: ExtendedField) => mappings.some((m) => m.targetField === field)
  if (!hasMandatory('name')) warnings.push('Geen kolom herkend als "Naam" — dit is verplicht.')
  if (!hasMandatory('type')) warnings.push('Geen kolom herkend als "Type" (intern/temp).')

  const lowConfidence = mappings.filter((m) => m.targetField !== 'skip' && m.confidence < 0.7)
  if (lowConfidence.length > 0) {
    warnings.push(`${lowConfidence.length} kolom${lowConfidence.length > 1 ? 'men' : ''} met lage zekerheid — controleer de mapping.`)
  }

  return {
    mappings,
    unmappedColumns: mappings.filter((m) => m.targetField === 'skip').map((m) => m.sourceIndex),
    warnings,
  }
}

// ── All available target fields for dropdown ─────────────────────────────────

export const TARGET_FIELD_OPTIONS: { value: ExtendedField; label: string }[] = [
  { value: 'name', label: 'Naam' },
  { value: 'type', label: 'Type (intern/temp)' },
  { value: 'department', label: 'Afdeling' },
  { value: 'function', label: 'Functie' },
  { value: 'team', label: 'Team / Ploeg' },
  { value: 'shift', label: 'Shift / Dienst' },
  { value: 'contractHours', label: 'Contracturen' },
  { value: 'fixedWorkingDays', label: 'Vaste werkdagen' },
  { value: 'location', label: 'Locatie' },
  { value: 'skills', label: 'Skills / Competenties' },
  { value: 'process', label: 'Proces' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefoon' },
  { value: 'skip', label: '— Overslaan' },
]
