/**
 * Matrix Parser — converts a skill matrix pivot table into importable data.
 *
 * Takes the output from matrixDetector + levelMatcher and produces:
 * - Employee records (name, team, function)
 * - Process definitions (from column headers)
 * - Skill level assignments (employee × process → level)
 */

import type { FormatDetection } from './matrixDetector'
import { matchLevel, type LevelMatch, LEVEL_LABELS } from './levelMatcher'
import { mapColumns, type ColumnMapping } from './columnMapper'

// ── Types ────────────────────────────────────────────────────────────────────

export interface MatrixProcess {
  columnIndex: number
  name: string
  group: string | null          // from merged header row
  existingId: string | null     // if matched to existing process
}

export interface MatrixEmployee {
  rowIndex: number
  name: string
  team: string                  // raw value from file
  functionRaw: string           // raw value from file
  levels: Map<number, LevelMatch>  // columnIndex → level match
}

export interface MatrixParseResult {
  employees: MatrixEmployee[]
  processes: MatrixProcess[]
  totalLevels: number
  unmatchedLevels: { row: number; col: number; value: string }[]
  metadataMappings: ColumnMapping[]   // how metadata columns were mapped
  questions: ImportQuestion[]         // things the AI needs to ask
}

export interface ImportQuestion {
  id: string
  type: 'column-meaning' | 'value-meaning' | 'typo-correction' | 'entity-match'
  question: string
  context: string
  options: { label: string; value: string }[]
  defaultOption?: string
}

// ── Metadata column detection ────────────────────────────────────────────────

interface MetadataMapping {
  nameCol: number | null
  teamCol: number | null
  functionCol: number | null
}

function detectMetadataColumns(
  rows: string[][],
  detection: FormatDetection,
): { mapping: MetadataMapping; aiMappings: ColumnMapping[] } {
  const headerRow = rows[detection.headerRows[detection.headerRows.length - 1]] ?? []

  // Use the column mapper on metadata columns only
  const metaHeaders = detection.metadataColumns.map((c) => headerRow[c] ?? `Kolom ${c + 1}`)
  const dataRowsForSample = rows.slice(detection.dataStartRow, detection.dataStartRow + 10)
  const metaSample = dataRowsForSample.map((r) => detection.metadataColumns.map((c) => r[c] ?? ''))

  const aiResult = mapColumns(metaHeaders, metaSample)

  const mapping: MetadataMapping = { nameCol: null, teamCol: null, functionCol: null }

  for (const m of aiResult.mappings) {
    const actualCol = detection.metadataColumns[m.sourceIndex]
    if (m.targetField === 'name') mapping.nameCol = actualCol
    else if (m.targetField === 'team' || m.targetField === 'department') mapping.teamCol = actualCol
    else if (m.targetField === 'function') mapping.functionCol = actualCol
  }

  // Fallback: if no name column detected, use the first metadata column
  if (mapping.nameCol === null && detection.metadataColumns.length > 0) {
    mapping.nameCol = detection.metadataColumns[0]
  }

  return { mapping, aiMappings: aiResult.mappings }
}

// ── Main parse function ──────────────────────────────────────────────────────

export function parseMatrix(
  rows: string[][],
  detection: FormatDetection,
  existingProcesses: { id: string; name: string }[] = [],
): MatrixParseResult {
  const questions: ImportQuestion[] = []

  // 1. Detect metadata columns (name, team, function)
  const { mapping, aiMappings } = detectMetadataColumns(rows, detection)

  // 2. Parse process definitions from header row
  const processHeaderRow = rows[detection.headerRows[detection.headerRows.length - 1]] ?? []
  const processes: MatrixProcess[] = []

  // Build multiple lookup maps for fuzzy process matching
  const processExactMap = new Map(existingProcesses.map((p) => [p.name.toLowerCase().trim(), p.id]))
  const processNormMap = new Map(existingProcesses.map((p) => [
    p.name.toLowerCase().trim().replace(/[\s\-_]+/g, ''),
    p.id,
  ]))

  function findExistingProcessId(name: string): string | null {
    const lc = name.toLowerCase().trim()
    // 1. Exact match
    if (processExactMap.has(lc)) return processExactMap.get(lc)!
    // 2. Normalized (strip spaces/dashes)
    const norm = lc.replace(/[\s\-_]+/g, '')
    if (processNormMap.has(norm)) return processNormMap.get(norm)!
    // 3. Contains match (for cases like "Manual Picking" matching "Picking")
    for (const [key, id] of processExactMap) {
      if (key.includes(lc) || lc.includes(key)) return id
    }
    return null
  }

  for (const colIdx of detection.dataColumns) {
    const rawName = (processHeaderRow[colIdx] ?? '').trim()
    if (!rawName) continue

    const group = detection.groupHeaders?.get(colIdx) ?? null
    const existingId = findExistingProcessId(rawName)

    processes.push({ columnIndex: colIdx, name: rawName, group, existingId })
  }

  // 3. Parse employee rows
  const employees: MatrixEmployee[] = []
  const unmatchedLevels: MatrixParseResult['unmatchedLevels'] = []
  let totalLevels = 0

  for (let r = detection.dataStartRow; r < rows.length; r++) {
    const row = rows[r]
    const name = mapping.nameCol !== null ? (row[mapping.nameCol] ?? '').trim() : ''
    if (!name) continue // skip empty rows

    const team = mapping.teamCol !== null ? (row[mapping.teamCol] ?? '').trim() : ''
    const functionRaw = mapping.functionCol !== null ? (row[mapping.functionCol] ?? '').trim() : ''

    const levels = new Map<number, LevelMatch>()
    for (const proc of processes) {
      const cellValue = (row[proc.columnIndex] ?? '').trim()
      const match = matchLevel(cellValue)
      if (match) {
        levels.set(proc.columnIndex, match)
        totalLevels++
      } else if (cellValue) {
        unmatchedLevels.push({ row: r, col: proc.columnIndex, value: cellValue })
      }
    }

    employees.push({ rowIndex: r, name, team, functionRaw, levels })
  }

  // 4. Generate AI questions for ambiguities
  // Question about metadata columns with low confidence
  for (const m of aiMappings) {
    if (m.targetField !== 'skip' && m.confidence < 0.7) {
      const headerRow = rows[detection.headerRows[detection.headerRows.length - 1]] ?? []
      const colName = headerRow[detection.metadataColumns[m.sourceIndex]] ?? `Kolom ${m.sourceIndex + 1}`
      questions.push({
        id: `meta-${m.sourceIndex}`,
        type: 'column-meaning',
        question: `Wat bevat de kolom "${colName}"?`,
        context: `Voorbeeldwaarden: ${rows.slice(detection.dataStartRow, detection.dataStartRow + 3).map((r) => r[detection.metadataColumns[m.sourceIndex]] ?? '').filter(Boolean).join(', ')}`,
        options: [
          { label: 'Naam medewerker', value: 'name' },
          { label: 'Afdeling / Team', value: 'team' },
          { label: 'Functie / Rol', value: 'function' },
          { label: 'Overslaan', value: 'skip' },
        ],
        defaultOption: m.targetField,
      })
    }
  }

  // Question about unmatched level values
  const uniqueUnmatched = new Set(unmatchedLevels.map((u) => u.value))
  for (const value of uniqueUnmatched) {
    questions.push({
      id: `level-${value}`,
      type: 'value-meaning',
      question: `Wat betekent "${value}"?`,
      context: 'Deze waarde werd niet automatisch herkend als skill level.',
      options: LEVEL_LABELS.map((label, i) => ({ label: `${i} — ${label}`, value: String(i) })),
    })
  }

  // Question about team/function values that look ambiguous
  const uniqueTeams = new Set(employees.map((e) => e.team).filter(Boolean))
  if (uniqueTeams.size > 0 && uniqueTeams.size <= 6) {
    const sampleTeams = Array.from(uniqueTeams).slice(0, 4).join(', ')
    questions.push({
      id: 'team-type',
      type: 'column-meaning',
      question: `De kolom "${mapping.teamCol !== null ? (processHeaderRow[mapping.teamCol] ?? 'Team') : 'Team'}" bevat: ${sampleTeams}. Wat is dit?`,
      context: 'We willen dit koppelen aan het juiste veld in het systeem.',
      options: [
        { label: 'Afdeling (Department)', value: 'department' },
        { label: 'Team / Ploeg', value: 'team' },
        { label: 'Locatie', value: 'location' },
        { label: 'Overslaan', value: 'skip' },
      ],
      defaultOption: 'department',
    })
  }

  return {
    employees,
    processes,
    totalLevels,
    unmatchedLevels,
    metadataMappings: aiMappings,
    questions,
  }
}

// ── Summary generation ───────────────────────────────────────────────────────

export function generateMatrixSummary(result: MatrixParseResult): string {
  const newProcesses = result.processes.filter((p) => !p.existingId).length
  const existingProcesses = result.processes.length - newProcesses
  const groups = new Set(result.processes.map((p) => p.group).filter(Boolean))

  let summary = `${result.employees.length} medewerkers en ${result.processes.length} processen gedetecteerd`
  if (groups.size > 0) summary += ` in ${groups.size} groepen (${Array.from(groups).join(', ')})`
  summary += `. ${result.totalLevels} skill levels worden ingesteld.`

  if (newProcesses > 0) summary += ` ${newProcesses} nieuwe processen worden aangemaakt.`
  if (existingProcesses > 0) summary += ` ${existingProcesses} processen worden gekoppeld aan bestaande.`
  if (result.unmatchedLevels.length > 0) summary += ` ${result.unmatchedLevels.length} waarden konden niet automatisch worden herkend.`

  return summary
}
