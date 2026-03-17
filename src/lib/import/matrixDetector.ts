/**
 * Matrix Detector — determines file format and parses multi-row headers.
 *
 * Detects:
 * - Flat employee list vs skill matrix pivot table
 * - Merged/grouped headers (category row + process row)
 * - Leading junk rows (titles, logos, empty rows)
 * - Metadata columns (name, team, function) vs data columns (levels)
 */

import { splitCsvLine } from './employeeImport'
import { looksLikeLevelData } from './levelMatcher'

// ── Types ────────────────────────────────────────────────────────────────────

export type FileFormat = 'employee-list' | 'skill-matrix' | 'unknown'

export interface FormatDetection {
  format: FileFormat
  confidence: number            // 0-1
  dataStartRow: number          // 0-indexed row where actual data begins
  headerRows: number[]          // which rows form the header (can be multi)
  metadataColumns: number[]     // column indices with non-level data (name, team, etc.)
  dataColumns: number[]         // column indices with level data
  groupHeaders?: Map<number, string> // dataColumn index → group name (from merged header row)
  reasoning: string             // natural language explanation
}

// ── Detection logic ──────────────────────────────────────────────────────────

/**
 * Analyze CSV rows to determine the file format.
 * Expects raw parsed rows (arrays of strings).
 */
export function detectFormat(rows: string[][]): FormatDetection {
  if (rows.length < 2) {
    return { format: 'unknown', confidence: 0, dataStartRow: 0, headerRows: [], metadataColumns: [], dataColumns: [], reasoning: 'Bestand bevat te weinig rijen.' }
  }

  // Skip leading empty/junk rows (title rows, logos)
  let firstContentRow = 0
  for (let r = 0; r < Math.min(5, rows.length); r++) {
    const nonEmpty = rows[r].filter((c) => c.trim()).length
    if (nonEmpty >= 3) { firstContentRow = r; break }
  }

  // Collect enough data rows for analysis (skip potential headers)
  const sampleStart = Math.min(firstContentRow + 3, rows.length - 1)
  const sampleRows = rows.slice(sampleStart, Math.min(sampleStart + 15, rows.length))

  if (sampleRows.length === 0) {
    return { format: 'unknown', confidence: 0, dataStartRow: firstContentRow, headerRows: [firstContentRow], metadataColumns: [], dataColumns: [], reasoning: 'Onvoldoende data rijen.' }
  }

  // Check each column: is it level data or metadata?
  const colCount = Math.max(...rows.slice(firstContentRow).map((r) => r.length))
  const metadataCols: number[] = []
  const dataCols: number[] = []

  for (let c = 0; c < colCount; c++) {
    const colValues = sampleRows.map((r) => r[c] ?? '').filter((v) => v.trim())
    if (colValues.length === 0) continue

    if (looksLikeLevelData(colValues)) {
      dataCols.push(c)
    } else {
      metadataCols.push(c)
    }
  }

  // Decision: if ≥5 columns contain level data → skill matrix
  const isMatrix = dataCols.length >= 5
  const isList = dataCols.length <= 2 && metadataCols.length >= 2

  if (isMatrix) {
    // Parse multi-row headers
    const { headerRows, groupHeaders, dataStartRow } = parseMatrixHeaders(rows, firstContentRow, dataCols)

    return {
      format: 'skill-matrix',
      confidence: Math.min(0.98, 0.7 + dataCols.length * 0.01),
      dataStartRow,
      headerRows,
      metadataColumns: metadataCols,
      dataColumns: dataCols,
      groupHeaders,
      reasoning: `Skill matrix gedetecteerd: ${dataCols.length} proces-kolommen met level waarden (Not Trained/Learning/etc.), ${metadataCols.length} metadata kolommen.`,
    }
  }

  if (isList) {
    return {
      format: 'employee-list',
      confidence: 0.85,
      dataStartRow: firstContentRow + 1, // assume first content row is header
      headerRows: [firstContentRow],
      metadataColumns: metadataCols,
      dataColumns: dataCols,
      reasoning: `Medewerker lijst gedetecteerd: ${metadataCols.length} kolommen met tekst data.`,
    }
  }

  return {
    format: 'unknown',
    confidence: 0.3,
    dataStartRow: firstContentRow + 1,
    headerRows: [firstContentRow],
    metadataColumns: metadataCols,
    dataColumns: dataCols,
    reasoning: `Formaat niet eenduidig: ${metadataCols.length} metadata kolommen, ${dataCols.length} data kolommen.`,
  }
}

// ── Multi-row header parsing ─────────────────────────────────────────────────

function parseMatrixHeaders(
  rows: string[][],
  firstContentRow: number,
  dataCols: number[],
): {
  headerRows: number[]
  groupHeaders: Map<number, string>
  dataStartRow: number
} {
  const groupHeaders = new Map<number, string>()
  const headerRows: number[] = []

  // Look at the rows from firstContentRow onward
  // The "group header" row has fewer filled cells than the "process header" row
  // The process header row has values in most data columns
  // Data rows have level values

  const candidates = rows.slice(firstContentRow, Math.min(firstContentRow + 5, rows.length))

  // Find which row has the most unique non-level, non-empty values in data columns
  // That's the process name header
  let processHeaderRow = firstContentRow
  let maxUniqueHeaders = 0

  for (let r = 0; r < candidates.length; r++) {
    const row = candidates[r]
    const headerValues = dataCols.map((c) => (row[c] ?? '').trim()).filter(Boolean)
    const uniqueHeaders = new Set(headerValues).size
    // Process header: many unique values that are NOT level values
    const nonLevelCount = headerValues.filter((v) => !looksLikeLevelData([v])).length
    if (nonLevelCount > maxUniqueHeaders) {
      maxUniqueHeaders = nonLevelCount
      processHeaderRow = firstContentRow + r
    }
  }

  headerRows.push(processHeaderRow)

  // Check if there's a group header row above the process header
  if (processHeaderRow > firstContentRow) {
    const groupRow = rows[processHeaderRow - 1]
    if (groupRow) {
      const filledCells: { col: number; value: string }[] = []
      for (let c = 0; c < groupRow.length; c++) {
        const val = (groupRow[c] ?? '').trim()
        if (val && dataCols.includes(c)) filledCells.push({ col: c, value: val })
      }

      // A group header typically has fewer filled cells that "span" multiple data columns
      if (filledCells.length > 0 && filledCells.length < dataCols.length * 0.6) {
        headerRows.unshift(processHeaderRow - 1)

        // Assign group names to data columns
        // Each filled cell in the group row "spans" until the next filled cell
        for (let i = 0; i < filledCells.length; i++) {
          const start = filledCells[i].col
          const end = i < filledCells.length - 1 ? filledCells[i + 1].col : Math.max(...dataCols) + 1
          for (const dc of dataCols) {
            if (dc >= start && dc < end) {
              groupHeaders.set(dc, filledCells[i].value)
            }
          }
        }
      }
    }
  }

  const dataStartRow = processHeaderRow + 1

  return { headerRows, groupHeaders, dataStartRow }
}

// ── Convenience: parse raw text into rows ────────────────────────────────────

export function textToRows(text: string): string[][] {
  return text.split('\n').map((line) => splitCsvLine(line.trimEnd()))
}
