/**
 * Team rotation domain logic
 *
 * A Team (Ploeg) cycles through a sequence of ShiftTemplates on a weekly basis.
 * The rotation is anchored to a specific ISO Monday (rotationAnchorDate) and
 * repeats every `rotationLength` weeks.
 *
 * Example — Ploeg A with rotationLength=3:
 *   Week-0 offset: Morning shift
 *   Week-1 offset: Late shift
 *   Week-2 offset: Night shift
 *   Week-3 offset: back to Morning  ← cycle repeats
 *
 * To find which shift a team works on a given date:
 *   1. Compute the number of whole weeks between anchorDate and the target date
 *   2. Take modulo rotationLength to get weekOffset (always non-negative)
 *   3. Look up the TeamRotationSlot with that weekOffset
 */

import type { Team, TeamRotationSlot } from '@prisma/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TeamWithSlots = Team & {
  rotationSlots: TeamRotationSlot[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse a "YYYY-MM-DD" date string safely as a local midnight UTC date,
 * avoiding timezone shift issues when constructing Date objects.
 */
function parseIsoDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

/**
 * Compute the Monday of the ISO week containing the given date string.
 * Returns a Date at UTC midnight on that Monday.
 */
function getMondayUtc(dateStr: string): Date {
  const d = parseIsoDate(dateStr)
  const day = d.getUTCDay() // 0 = Sunday
  const diffToMon = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diffToMon)
  return d
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Given a team and a date ("YYYY-MM-DD"), returns the ShiftTemplate ID that
 * should be active for that team on that date, or null if the rotation has no
 * slot configured for that week offset.
 *
 * Both the team's rotationAnchorDate and the given date are snapped to the
 * start of their respective ISO weeks (Monday) before computing the distance.
 * This ensures consistent results regardless of which day of the week is passed.
 */
export function getActiveShiftTemplateIdForTeam(
  team: TeamWithSlots,
  date: string,
): string | null {
  if (!team.rotationSlots.length || team.rotationLength <= 0) return null

  const anchorMonday  = getMondayUtc(team.rotationAnchorDate)
  const targetMonday  = getMondayUtc(date)

  const msPerWeek     = 7 * 24 * 60 * 60 * 1000
  const weekDiff      = Math.round((targetMonday.getTime() - anchorMonday.getTime()) / msPerWeek)

  // Always non-negative modulo
  const weekOffset    = ((weekDiff % team.rotationLength) + team.rotationLength) % team.rotationLength

  const slot = team.rotationSlots.find((s) => s.weekOffset === weekOffset)
  return slot?.shiftTemplateId ?? null
}

/**
 * Checks whether an employee being assigned to a given shiftTemplateId on a
 * given date is consistent with their team's rotation schedule.
 *
 * Returns:
 *   - `{ ok: true }` if the employee has no team, or the team has no rotation
 *     configured, or the assignment matches the scheduled rotation.
 *   - `{ ok: false; activeShiftTemplateId: string }` if the rotation dictates
 *     a different shift for that week.
 *
 * The caller decides whether to block or warn on a violation.
 */
export function checkTeamRotationViolation(
  team: TeamWithSlots | null | undefined,
  shiftTemplateId: string,
  date: string,
): { ok: true } | { ok: false; activeShiftTemplateId: string } {
  if (!team) return { ok: true }

  const activeId = getActiveShiftTemplateIdForTeam(team, date)
  if (activeId === null) return { ok: true }        // rotation not configured
  if (activeId === shiftTemplateId) return { ok: true }
  return { ok: false, activeShiftTemplateId: activeId }
}
