/**
 * Temp-Demand Export Foundation — Phase 6
 *
 * Derives structured open-staffing-demand rows from existing planning data.
 * This is the canonical data layer for all future temp-request export formats
 * (CSV, PDF, external staffing-agency integrations, etc.).
 *
 * Pure functions — no DB calls, no side effects.
 *
 * ─── Build chain ─────────────────────────────────────────────────────────────
 *
 *   StaffingEntry[]  (staffing.analyzeStaffing — already computed in planner)
 *   + ShiftTemplateWithContext[]  (carries location / department relations)
 *   + Optional DepartmentWithChildren[]  (for subdepartment resolution)
 *   ───────────────────────────────────────────────────────────────────────────
 *   → TempDemandRow[]         one row per understaffed (date × shift) slot
 *
 * ─── Filtering ───────────────────────────────────────────────────────────────
 *   Only under-staffed slots with open > 0 are included.
 *   Overstaffed and fully-staffed slots are excluded.
 *   Slots with 0 required headcount are excluded.
 *
 * ─── Extension points ────────────────────────────────────────────────────────
 *   TempDemandRow is intentionally flat and serialisable (no Date objects,
 *   no circular refs) so it can be:
 *     - Serialised to JSON for an API response
 *     - Mapped to CSV rows
 *     - Sent to an external agency integration
 *     - Filtered/grouped by any field in a future reporting UI
 */

import type { StaffingEntry } from '@/lib/staffing'
import type { ShiftTemplateWithContext } from '@/lib/queries/shiftTemplates'
import type { DepartmentWithChildren } from '@/lib/queries/locations'
import { getWeekday, type WeekdayName } from '@/lib/manpower'

// ─── Core export type ─────────────────────────────────────────────────────────

/**
 * A single open-demand record for one (date × shift) slot.
 *
 * All fields are nullable where the underlying data may be absent, so the
 * structure remains stable as more data becomes available in later phases.
 */
export interface TempDemandRow {
  // ── Date / time ─────────────────────────────────────────────────────────
  date: string            // ISO YYYY-MM-DD
  weekday: WeekdayName    // human-readable day name

  // ── Shift identity ───────────────────────────────────────────────────────
  shiftTemplateId: string
  shiftName: string
  shiftStart: string      // "HH:MM"
  shiftEnd: string        // "HH:MM"

  // ── Skill requirement ────────────────────────────────────────────────────
  requiredSkillId: string | null
  requiredSkillName: string | null

  // ── Staffing numbers ─────────────────────────────────────────────────────
  requiredHeadcount: number
  assignedHeadcount: number   // direct labour only (overhead excluded)
  openHeadcount: number       // = requiredHeadcount − assignedHeadcount

  // ── Location / department ─────────────────────────────────────────────────
  locationId: string | null
  locationName: string | null
  departmentId: string | null
  departmentName: string | null
  /** Populated when the shift's department is itself a subdepartment. */
  parentDepartmentId: string | null
  parentDepartmentName: string | null

  // ── Demand source ─────────────────────────────────────────────────────────
  /**
   * Which layer of the manpower priority chain produced requiredHeadcount.
   * Useful for audit/transparency in later export UI phases.
   * Mirrors DemandSource from manpower.ts.
   */
  demandSource: 'weekday_target' | 'shift_requirement' | 'template_default' | null
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Build a flat list of open-demand rows from staffing analysis results.
 *
 * @param staffingEntries   Output of analyzeStaffing() — contains per-slot numbers.
 * @param templateContextMap  Map<shiftTemplateId, ShiftTemplateWithContext> for
 *                             location / dept / skill relations.
 * @param parentMap          Optional Map<deptId, DepartmentWithChildren> for
 *                             resolving subdepartment → parent name.
 *
 * Returns only rows where openHeadcount > 0 (understaffed slots), sorted by
 * date ASC then shiftStart ASC.
 */
export function buildTempDemand({
  staffingEntries,
  templateContextMap,
  parentMap,
}: {
  staffingEntries: StaffingEntry[]
  templateContextMap: Map<string, ShiftTemplateWithContext>
  parentMap?: Map<string, DepartmentWithChildren>
}): TempDemandRow[] {
  const rows: TempDemandRow[] = []

  for (const entry of staffingEntries) {
    // Only include under-staffed, non-zero-required slots
    if (entry.open <= 0 || entry.required <= 0) continue

    const ctx = templateContextMap.get(entry.template.id)

    // Resolve parent department when the shift department is a subdepartment
    let parentDepartmentId: string | null = null
    let parentDepartmentName: string | null = null
    if (ctx?.department?.id && parentMap) {
      // Check every parent in the map to see if it contains this dept as a child
      for (const [pid, parent] of parentMap) {
        if (parent.children.some((c) => c.id === ctx.department!.id)) {
          parentDepartmentId = pid
          parentDepartmentName = parent.name
          break
        }
      }
    }

    rows.push({
      date: entry.date,
      weekday: getWeekday(entry.date),

      shiftTemplateId: entry.template.id,
      shiftName:       ctx?.name              ?? entry.template.name,
      shiftStart:      entry.template.startTime,
      shiftEnd:        entry.template.endTime,

      requiredSkillId:   ctx?.requiredSkill?.id   ?? null,
      requiredSkillName: ctx?.requiredSkill?.name ?? null,

      requiredHeadcount: entry.required,
      assignedHeadcount: entry.directAssigned,
      openHeadcount:     entry.open,

      locationId:   ctx?.location?.id   ?? null,
      locationName: ctx?.location?.name ?? null,

      departmentId:   ctx?.department?.id   ?? null,
      departmentName: ctx?.department?.name ?? null,

      parentDepartmentId,
      parentDepartmentName,

      demandSource: null, // populated by the server action when available
    })
  }

  // Sort by date ASC, then shiftStart ASC for stable export ordering
  rows.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date)
    return dateCmp !== 0 ? dateCmp : a.shiftStart.localeCompare(b.shiftStart)
  })

  return rows
}

/**
 * Build the templateContextMap lookup from a flat array.
 * Convenience helper for action/server callers.
 */
export function buildTemplateContextMap(
  templates: ShiftTemplateWithContext[],
): Map<string, ShiftTemplateWithContext> {
  return new Map(templates.map((t) => [t.id, t]))
}

/**
 * Build the parentMap lookup from DepartmentWithChildren[].
 * Convenience helper; only needed when subdepartment resolution is wanted.
 */
export function buildParentMap(
  departments: DepartmentWithChildren[],
): Map<string, DepartmentWithChildren> {
  return new Map(departments.map((d) => [d.id, d]))
}

// ─── Summary helpers ──────────────────────────────────────────────────────────

/** Total open FTE across all rows. */
export function totalOpenDemand(rows: TempDemandRow[]): number {
  return rows.reduce((sum, r) => sum + r.openHeadcount, 0)
}

/** Group rows by ISO date — useful for weekly-view output. */
export function groupByDate(rows: TempDemandRow[]): Map<string, TempDemandRow[]> {
  const m = new Map<string, TempDemandRow[]>()
  for (const row of rows) {
    const bucket = m.get(row.date)
    if (bucket) bucket.push(row)
    else m.set(row.date, [row])
  }
  return m
}

/** Group rows by department — useful for per-dept print export. */
export function groupByDepartment(
  rows: TempDemandRow[],
): Map<string | null, TempDemandRow[]> {
  const m = new Map<string | null, TempDemandRow[]>()
  for (const row of rows) {
    const key = row.departmentId
    const bucket = m.get(key)
    if (bucket) bucket.push(row)
    else m.set(key, [row])
  }
  return m
}
