/**
 * Auto-fill Staffing Engine v1
 *
 * Deterministic, explainable candidate selection and shift filling.
 * Ranking is delegated to the recommendation engine in src/lib/scoring.ts,
 * which scores each candidate on type, location/dept match, and contract load.
 *
 * This module owns the write path: it consumes ranked candidates and creates
 * assignments, with race-condition guards.
 */

import { prisma } from '@/lib/db/client'
import type { Employee } from '@prisma/client'
import { getRankedCandidates } from '@/lib/scoring'
import { checkTeamRotationViolation, type TeamWithSlots } from '@/lib/teams'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutofillCandidate {
  employee: Employee
  /** Why this candidate was selected — shown in the UI */
  reason: 'internal' | 'temp'
}

export interface AutofillResult {
  created: number
  remaining: number
  candidates: AutofillCandidate[]
  /**
   * When the shift has a required skill, this is set to that skill's name.
   * Allows the UI to show a specific message when no skill-matched candidates exist.
   */
  requiredSkillName?: string
}

// ---------------------------------------------------------------------------
// Candidate selection (no writes)
// ---------------------------------------------------------------------------

/**
 * Returns the ranked list of eligible candidates for an understaffed slot.
 *
 * Delegates to getRankedCandidates() in scoring.ts — same eligibility checks,
 * same ordering logic. Maps ScoredCandidate → AutofillCandidate for
 * backward compatibility with existing callers.
 */
export async function getAutofillCandidates({
  organizationId,
  shiftTemplateId,
  date,
  departmentScope,
}: {
  organizationId: string
  shiftTemplateId: string
  date: string
  /** When set, restricts candidates to employees in these department ids. */
  departmentScope?: string[] | null
}): Promise<AutofillCandidate[]> {
  const { scored } = await getRankedCandidates({ organizationId, shiftTemplateId, date, departmentScope })
  return scored.map(({ employee }) => ({
    employee,
    reason: employee.employeeType === 'internal' ? 'internal' : 'temp',
  }))
}

// ---------------------------------------------------------------------------
// Auto-fill (writes assignments)
// ---------------------------------------------------------------------------

/**
 * Attempts to fill an understaffed shift/date slot up to `requiredHeadcount`.
 *
 * - Selects candidates using the scoring engine (src/lib/scoring.ts)
 * - Creates assignments until headcount is met or candidates run out
 * - Skips duplicates (safe to call multiple times)
 * - Returns count of new assignments created and remaining open slots
 */
export async function autoFillShift({
  organizationId,
  shiftTemplateId,
  date,
  requiredHeadcount,
  departmentScope,
}: {
  organizationId: string
  shiftTemplateId: string
  date: string
  requiredHeadcount: number
  /** When set, restricts candidates to employees in these department ids. */
  departmentScope?: string[] | null
}): Promise<AutofillResult> {
  // Resolve required skill name for result metadata
  const template = await prisma.shiftTemplate.findUnique({
    where: { id: shiftTemplateId },
    select: { requiredSkillId: true, requiredSkill: { select: { name: true } } },
  })
  const requiredSkillName = template?.requiredSkill?.name ?? undefined
  // Count how many are already assigned to this shift/date
  const rosterDay = await prisma.rosterDay.findUnique({
    where: { organizationId_date: { organizationId, date } },
    select: { id: true },
  })

  const existingCount = rosterDay
    ? await prisma.assignment.count({
        where: { rosterDayId: rosterDay.id, shiftTemplateId },
      })
    : 0

  const openSlots = requiredHeadcount - existingCount
  if (openSlots <= 0) {
    return { created: 0, remaining: 0, candidates: [], requiredSkillName }
  }

  const candidates = await getAutofillCandidates({ organizationId, shiftTemplateId, date, departmentScope })
  if (candidates.length === 0) {
    return { created: 0, remaining: openSlots, candidates: [], requiredSkillName }
  }

  // Take only as many candidates as we need
  const toAssign = candidates.slice(0, openSlots)

  let created = 0
  for (const { employee } of toAssign) {
    try {
      // Upsert roster day inside loop in case it doesn't exist yet
      const day = await prisma.rosterDay.upsert({
        where: { organizationId_date: { organizationId, date } },
        update: {},
        create: { organizationId, date },
      })

      // Guard: check this slot isn't taken (race-safe)
      const conflict = await prisma.assignment.findUnique({
        where: {
          rosterDayId_shiftTemplateId_employeeId: {
            rosterDayId: day.id,
            shiftTemplateId,
            employeeId: employee.id,
          },
        },
      })
      if (conflict) continue

      // Second-line rotation guard: verify ploeg constraint at write time.
      // getRankedCandidates already hard-filters by team rotation, but this
      // ensures no cross-ploeg write can ever occur even if the eligibility
      // filter is bypassed (e.g. by future code changes or direct calls).
      const empWithTeam = await prisma.employee.findUnique({
        where: { id: employee.id },
        select: {
          team: {
            select: {
              id: true, name: true, color: true,
              rotationAnchorDate: true, rotationLength: true,
              rotationSlots: { select: { weekOffset: true, shiftTemplateId: true } },
            },
          },
        },
      })
      if (empWithTeam?.team) {
        const violation = checkTeamRotationViolation(
          empWithTeam.team as TeamWithSlots,
          shiftTemplateId,
          date,
        )
        if (!violation.ok) {
          console.warn(
            `autoFillShift: skipping ${employee.id} — team rotation violation for shift ${shiftTemplateId} on ${date}`,
          )
          continue
        }
      }

      await prisma.assignment.create({
        data: {
          organizationId,
          rosterDayId: day.id,
          shiftTemplateId,
          employeeId: employee.id,
        },
      })
      created++
    } catch (err: unknown) {
      // P2002 = unique constraint — skip silently (already assigned)
      const code = (err as { code?: string })?.code
      if (code !== 'P2002') {
        console.error('autoFillShift assignment error:', err)
      }
    }
  }

  const remaining = Math.max(0, openSlots - created)
  return { created, remaining, candidates: toAssign, requiredSkillName }
}
