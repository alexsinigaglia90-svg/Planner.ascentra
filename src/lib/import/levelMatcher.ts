/**
 * Fuzzy Skill Level Matcher — maps any text to a 0-4 capability level.
 *
 * Handles: NL/EN, abbreviations, typos, numeric values, empty cells.
 * Returns null only when truly unrecognizable.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface LevelMatch {
  level: number           // 0-4
  label: string           // canonical label
  confidence: number      // 0-1
  original: string        // input value
  corrected?: string      // if typo was corrected
}

// ── Canonical levels ─────────────────────────────────────────────────────────

export const LEVEL_LABELS = ['Not Trained', 'Learning', 'Operational', 'Strong', 'Elite'] as const

// ── Alias maps (all lowercase) ───────────────────────────────────────────────

const EXACT_ALIASES: Record<string, number> = {
  // English
  'not trained': 0, 'untrained': 0, 'none': 0, 'no': 0, 'n/a': 0, 'na': 0,
  'learning': 1, 'beginner': 1, 'basic': 1, 'trainee': 1, 'in training': 1,
  'operational': 2, 'competent': 2, 'intermediate': 2, 'capable': 2, 'independent': 2,
  'strong': 3, 'advanced': 3, 'senior': 3, 'proficient': 3, 'experienced': 3,
  'elite': 4, 'expert': 4, 'master': 4, 'specialist': 4,

  // Dutch
  'niet getraind': 0, 'ongetraind': 0, 'geen': 0, 'nee': 0,
  'lerend': 1, 'basis': 1, 'in opleiding': 1, 'leerling': 1,
  'operationeel': 2, 'voldoende': 2, 'zelfstandig': 2, 'bekwaam': 2,
  'sterk': 3, 'gevorderd': 3, 'ervaren': 3,
  'meester': 4,

  // Numeric
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,

  // Symbols
  '-': 0, '—': 0, '–': 0, 'x': 0,
}

// ── Fuzzy matching helpers ───────────────────────────────────────────────────

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Simple Levenshtein distance for short strings */
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

// ── Main matching function ───────────────────────────────────────────────────

export function matchLevel(raw: string): LevelMatch | null {
  const trimmed = raw.trim()

  // Empty / blank = Not Trained (level 0)
  if (!trimmed) {
    return { level: 0, label: LEVEL_LABELS[0], confidence: 0.9, original: raw }
  }

  const norm = normalize(trimmed)

  // 1. Exact alias match
  if (norm in EXACT_ALIASES) {
    const level = EXACT_ALIASES[norm]
    return { level, label: LEVEL_LABELS[level], confidence: 1, original: raw }
  }

  // 2. Starts-with match (handles "Not Trained (nieuw)" etc.)
  for (const [alias, level] of Object.entries(EXACT_ALIASES)) {
    if (alias.length >= 4 && norm.startsWith(alias)) {
      return { level, label: LEVEL_LABELS[level], confidence: 0.95, original: raw }
    }
  }

  // 3. Contains match (handles "Level: Operational" etc.)
  for (const [alias, level] of Object.entries(EXACT_ALIASES)) {
    if (alias.length >= 5 && norm.includes(alias)) {
      return { level, label: LEVEL_LABELS[level], confidence: 0.85, original: raw }
    }
  }

  // 4. Fuzzy match via Levenshtein (handles typos)
  const candidates = Object.entries(EXACT_ALIASES).filter(([a]) => a.length >= 4)
  let bestMatch: { alias: string; level: number; distance: number } | null = null

  for (const [alias, level] of candidates) {
    const dist = levenshtein(norm, alias)
    const maxAllowed = Math.floor(alias.length * 0.3) // allow 30% error
    if (dist <= maxAllowed && (!bestMatch || dist < bestMatch.distance)) {
      bestMatch = { alias, level, distance: dist }
    }
  }

  if (bestMatch) {
    const confidence = Math.max(0.5, 1 - (bestMatch.distance / bestMatch.alias.length))
    return {
      level: bestMatch.level,
      label: LEVEL_LABELS[bestMatch.level],
      confidence: Math.round(confidence * 100) / 100,
      original: raw,
      corrected: bestMatch.alias,
    }
  }

  // 5. No match
  return null
}

// ── Batch matching ───────────────────────────────────────────────────────────

export interface LevelMatchSummary {
  matched: number
  unmatched: number
  corrections: { original: string; corrected: string; level: number }[]
  uniqueValues: Map<string, LevelMatch | null>
}

/**
 * Analyze all unique level values in a dataset and return match results.
 * Use this to show the user what will be mapped before importing.
 */
export function analyzeLevelValues(values: string[]): LevelMatchSummary {
  const uniqueValues = new Map<string, LevelMatch | null>()
  const corrections: LevelMatchSummary['corrections'] = []

  for (const v of values) {
    const norm = normalize(v)
    if (uniqueValues.has(norm)) continue
    const match = matchLevel(v)
    uniqueValues.set(norm, match)
    if (match?.corrected) {
      corrections.push({ original: v, corrected: match.corrected, level: match.level })
    }
  }

  const matched = Array.from(uniqueValues.values()).filter((m) => m !== null).length
  const unmatched = uniqueValues.size - matched

  return { matched, unmatched, corrections, uniqueValues }
}

/**
 * Check if a set of values looks like skill levels (for format detection).
 * Returns true if ≥60% of non-empty values match a known level.
 */
export function looksLikeLevelData(values: string[]): boolean {
  const nonEmpty = values.filter((v) => v.trim())
  if (nonEmpty.length < 3) return false
  const matchCount = nonEmpty.filter((v) => matchLevel(v) !== null).length
  return matchCount / nonEmpty.length >= 0.6
}
