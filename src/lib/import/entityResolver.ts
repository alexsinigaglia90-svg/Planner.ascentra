/**
 * Entity Resolver — detects references to entities that don't exist yet
 * and provides fuzzy matching + auto-creation recommendations.
 *
 * Pure functions, no DB calls. Operates on pre-fetched entity lists.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type EntityType = 'department' | 'function' | 'skill' | 'location'

export interface FuzzyMatch {
  id: string
  name: string
  similarity: number  // 0-1
}

export interface PendingEntity {
  type: EntityType
  name: string
  occurrences: number
  action: 'create' | 'skip' | 'map-to-existing'
  mapToId?: string
  fuzzyMatches: FuzzyMatch[]
}

export interface EntityResolution {
  pending: PendingEntity[]
  matched: { type: EntityType; rawName: string; matchedId: string; matchedName: string }[]
  summary: string
}

interface ExistingEntities {
  departments: { id: string; name: string }[]
  functions: { id: string; name: string }[]
  skills: { id: string; name: string }[]
  locations: { id: string; name: string }[]
}

// ── Fuzzy matching ───────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[_\-\/\\\.]/g, ' ').replace(/\s+/g, ' ')
}

/**
 * Simple similarity based on common bigrams (Dice coefficient).
 * Fast, no dependencies, good enough for entity names.
 */
function similarity(a: string, b: string): number {
  const na = normalize(a)
  const nb = normalize(b)

  if (na === nb) return 1

  // Check containment
  if (na.includes(nb) || nb.includes(na)) {
    return 0.85 + (Math.min(na.length, nb.length) / Math.max(na.length, nb.length)) * 0.1
  }

  // Bigram Dice coefficient
  const bigramsA = new Set<string>()
  const bigramsB = new Set<string>()
  for (let i = 0; i < na.length - 1; i++) bigramsA.add(na.slice(i, i + 2))
  for (let i = 0; i < nb.length - 1; i++) bigramsB.add(nb.slice(i, i + 2))

  if (bigramsA.size === 0 || bigramsB.size === 0) return 0

  let common = 0
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) common++
  }

  return (2 * common) / (bigramsA.size + bigramsB.size)
}

function findFuzzyMatches(name: string, existing: { id: string; name: string }[], threshold = 0.5): FuzzyMatch[] {
  return existing
    .map((e) => ({ id: e.id, name: e.name, similarity: Math.round(similarity(name, e.name) * 100) / 100 }))
    .filter((m) => m.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5)
}

// ── Multi-value parsing ──────────────────────────────────────────────────────

/**
 * Split a cell value into individual entity names.
 * Handles: "A; B; C", "A|B|C", "A, B, C"
 */
export function splitMultiValue(cell: string): string[] {
  if (!cell.trim()) return []

  // Detect separator
  const sep = cell.includes(';') ? ';' : cell.includes('|') ? '|' : ','
  return cell.split(sep).map((s) => s.trim()).filter(Boolean)
}

// ── Main resolution ──────────────────────────────────────────────────────────

/**
 * Analyze extracted entity references from import data and resolve them
 * against existing entities.
 *
 * @param references Map of entity type → array of raw names from the file
 * @param existing   Current entities in the organization
 */
export function resolveEntities(
  references: Map<EntityType, string[]>,
  existing: ExistingEntities,
): EntityResolution {
  const pending: PendingEntity[] = []
  const matched: EntityResolution['matched'] = []

  const entityLists: Record<EntityType, { id: string; name: string }[]> = {
    department: existing.departments,
    function: existing.functions,
    skill: existing.skills,
    location: existing.locations,
  }

  for (const [type, rawNames] of references) {
    const list = entityLists[type]

    // Count occurrences
    const counts = new Map<string, number>()
    for (const raw of rawNames) {
      const norm = normalize(raw)
      counts.set(norm, (counts.get(norm) ?? 0) + 1)
    }

    for (const [normName, count] of counts) {
      // Find original casing
      const originalName = rawNames.find((r) => normalize(r) === normName) ?? normName

      // Exact match (case-insensitive)
      const exact = list.find((e) => normalize(e.name) === normName)
      if (exact) {
        matched.push({ type, rawName: originalName, matchedId: exact.id, matchedName: exact.name })
        continue
      }

      // Fuzzy matches
      const fuzzy = findFuzzyMatches(originalName, list, 0.5)

      // Auto-decide action
      const bestFuzzy = fuzzy[0]
      const action: PendingEntity['action'] =
        bestFuzzy && bestFuzzy.similarity >= 0.85 ? 'map-to-existing' : 'create'

      pending.push({
        type,
        name: originalName,
        occurrences: count,
        action,
        mapToId: action === 'map-to-existing' ? bestFuzzy?.id : undefined,
        fuzzyMatches: fuzzy,
      })
    }
  }

  // Sort: most occurrences first, then by type
  pending.sort((a, b) => b.occurrences - a.occurrences)

  const newCount = pending.filter((p) => p.action === 'create').length
  const mapCount = pending.filter((p) => p.action === 'map-to-existing').length
  const summary = pending.length === 0
    ? 'Alle entiteiten zijn herkend — geen nieuwe aan te maken.'
    : `${pending.length} nieuwe entiteit${pending.length !== 1 ? 'en' : ''} gedetecteerd: ${newCount} aan te maken, ${mapCount} automatisch gekoppeld aan bestaande.`

  return { pending, matched, summary }
}

// ── Extract references from mapped import data ──────────────────────────────

import type { ColumnMapping } from './columnMapper'

/**
 * Extract entity references from import data based on column mappings.
 * Returns a map of entity type → all raw values found.
 */
export function extractEntityReferences(
  mappings: ColumnMapping[],
  dataRows: string[][],
): Map<EntityType, string[]> {
  const refs = new Map<EntityType, string[]>()

  const fieldToEntity: Record<string, EntityType> = {
    department: 'department',
    function: 'function',
    skills: 'skill',
    location: 'location',
  }

  for (const mapping of mappings) {
    const entityType = fieldToEntity[mapping.targetField]
    if (!entityType) continue

    const values: string[] = []
    for (const row of dataRows) {
      const cell = row[mapping.sourceIndex] ?? ''
      if (!cell.trim()) continue

      if (mapping.isMultiValue) {
        values.push(...splitMultiValue(cell))
      } else {
        values.push(cell.trim())
      }
    }

    const existing = refs.get(entityType) ?? []
    existing.push(...values)
    refs.set(entityType, existing)
  }

  return refs
}
