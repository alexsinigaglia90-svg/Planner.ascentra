/**
 * Recommendation Engine v1 — AI-Assisted Scheduling
 *
 * Transparent, explainable candidate scoring for understaffed shifts.
 * No external AI service — every score point is traced to an explicit factor.
 *
 * ─── Score factors (max 100 pts) ────────────────────────────────────────────
 *
 *   Employee type (25 pts)
 *     Internal staff   → +25
 *     Temporary staff  → +5
 *
 *   Location match (25 pts, only counted when shift has a location set)
 *     Employee location matches shift location → +25
 *
 *   Department match (20 pts, only counted when shift has a department set)
 *     Employee department matches shift department → +20
 *
 *   Contract load (5–30 pts)
 *     ≤ 75 % of weekly capacity → +30  (well under contract hours)
 *     ≤ 90 %                   → +25  (under contract hours)
 *     ≤ 100 %                  → +15  (at contract limit)
 *     > 100 %                  → +5   (over contracted hours)
 *     No contract cap (0h)     → +20  (neutral)
 *
 * ─── Tier thresholds ─────────────────────────────────────────────────────────
 *   excellent  ≥ 80
 *   good       ≥ 55
 *   fair       ≥ 30
 *   fallback   < 30
 *
 * ─── Eligibility hard filters (all must pass) ────────────────────────────────
 *   - Employee status = 'active'
 *   - Not already assigned to any shift on this date
 *   - Not already assigned to this specific shift on this date
 *   - Has required skill (if the shift template specifies one)
 */

import { prisma } from '@/lib/db/client'
import type { Employee } from '@prisma/client'
import { shiftDurationMinutes } from '@/lib/compliance'

// ─── Public types ─────────────────────────────────────────────────────────────

export type CandidateTier = 'excellent' | 'good' | 'fair' | 'fallback'

export interface ScoredCandidate {
  employee: Employee
  /** 0–100. Higher is a stronger recommendation. */
  score: number
  tier: CandidateTier
  /** Human-readable positive match factors shown in the UI. */
  reasons: string[]
  /** Concerns or softer negatives shown in the UI. */
  warnings: string[]
  /** Planned minutes this ISO week (from existing assignments). */
  plannedMinutes: number
  /** Weekly capacity in minutes derived from contractHours. 0 = no cap. */
  contractMinutes: number
}

export interface ShiftContext {
  templateName: string
  requiredSkillId: string | null
  requiredSkillName: string | null
  locationId: string | null
  locationName: string | null
  departmentId: string | null
  departmentName: string | null
}

export interface RecommendationResult {
  /** Scored candidates, best first. Empty when no eligible staff found. */
  scored: ScoredCandidate[]
  /** Metadata about the shift being filled (for UI display). */
  context: ShiftContext
  /**
   * Open slots at the time of scoring.
   * Derived from template.requiredEmployees minus current assignments.
   * Note: the planning UI may use a ShiftRequirement override — this value
   * is informational and the StaffingEntry.open value takes precedence there.
   */
  openSlots: number
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Returns ISO week Monday–Sunday bounds for a YYYY-MM-DD date string. */
export function getWeekBounds(date: string): { start: string; end: string } {
  const d = new Date(date)
  const day = d.getDay()              // 0 = Sunday
  const diffToMon = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diffToMon)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return {
    start: mon.toISOString().slice(0, 10),
    end: sun.toISOString().slice(0, 10),
  }
}

// ─── Pure scoring ─────────────────────────────────────────────────────────────

/**
 * Score a single employee's fitness for a shift.
 * Pure function — no DB calls, no side effects.
 */
export function scoreEmployee(
  employee: Employee,
  plannedMinutes: number,
  context: ShiftContext,
): { score: number; tier: CandidateTier; reasons: string[]; warnings: string[] } {
  let score = 0
  const reasons: string[] = []
  const warnings: string[] = []

  // ── Employee type (25 pts internal / 5 pts temp) ────────────────────────
  if (employee.employeeType === 'internal') {
    score += 25
    reasons.push('Internal staff')
  } else {
    score += 5
    warnings.push('Temporary staff')
  }

  // ── Required skill — always satisfied by hard filter; show as reason ────
  if (context.requiredSkillName) {
    reasons.push(`Has skill: ${context.requiredSkillName}`)
  }

  // ── Location match (25 pts, only when shift has a location) ────────────
  if (context.locationId) {
    if (employee.locationId === context.locationId) {
      score += 25
      reasons.push(
        context.locationName
          ? `Matching location (${context.locationName})`
          : 'Matching location',
      )
    } else {
      warnings.push('Different location')
    }
  }

  // ── Department match (20 pts, only when shift has a department) ─────────
  if (context.departmentId) {
    if (employee.departmentId === context.departmentId) {
      score += 20
      reasons.push(
        context.departmentName
          ? `Matching department (${context.departmentName})`
          : 'Matching department',
      )
    } else {
      warnings.push('Different department')
    }
  }

  // ── Contract load (5–30 pts) ────────────────────────────────────────────
  const contractMinutes = employee.contractHours > 0
    ? Math.round(employee.contractHours * 60)
    : 0

  if (contractMinutes === 0) {
    // No weekly cap — treat neutrally
    score += 20
    reasons.push('No contract cap')
  } else {
    const ratio = plannedMinutes / contractMinutes
    if (ratio <= 0.75) {
      score += 30
      reasons.push('Well under contract hours')
    } else if (ratio <= 0.90) {
      score += 25
      reasons.push('Under contract hours')
    } else if (ratio <= 1.00) {
      score += 15
      warnings.push('Approaching capacity')
    } else {
      score += 5
      warnings.push('Over contracted hours')
    }
  }

  const tier: CandidateTier =
    score >= 80 ? 'excellent' :
    score >= 55 ? 'good' :
    score >= 30 ? 'fair' :
    'fallback'

  return { score, tier, reasons, warnings }
}

// ─── DB-backed ranked fetch ────────────────────────────────────────────────────

/**
 * Fetches, filters, scores, and sorts all eligible candidates for a shift/date.
 *
 * Eligibility (hard constraints — all must pass):
 *   - Employee is active
 *   - Not assigned on this date to any shift
 *   - Not assigned to this specific shift on this date
 *   - Has the required skill (if the shift template has one set)
 *
 * Results are ordered by descending score; ties broken alphabetically.
 */
export async function getRankedCandidates({
  organizationId,
  shiftTemplateId,
  date,
}: {
  organizationId: string
  shiftTemplateId: string
  date: string
}): Promise<RecommendationResult> {
  // ── Fetch template with all context relations ──────────────────────────
  const template = await prisma.shiftTemplate.findUnique({
    where: { id: shiftTemplateId },
    include: {
      requiredSkill: { select: { name: true } },
      location:      { select: { name: true } },
      department:    { select: { name: true } },
    },
  })

  const context: ShiftContext = {
    templateName:     template?.name             ?? '',
    requiredSkillId:  template?.requiredSkillId  ?? null,
    requiredSkillName: template?.requiredSkill?.name ?? null,
    locationId:       template?.locationId       ?? null,
    locationName:     template?.location?.name   ?? null,
    departmentId:     template?.departmentId     ?? null,
    departmentName:   template?.department?.name ?? null,
  }

  // ── Fetch all active employees, skill-filtered if needed ───────────────
  const employees = await prisma.employee.findMany({
    where: {
      organizationId,
      status: 'active',
      ...(context.requiredSkillId
        ? { skills: { some: { skillId: context.requiredSkillId } } }
        : {}),
    },
  })

  // ── Determine who is already assigned on this date ────────────────────
  const rosterDay = await prisma.rosterDay.findUnique({
    where: { organizationId_date: { organizationId, date } },
    select: { id: true },
  })

  const assignedAnyShift   = new Set<string>()
  const assignedThisShift  = new Set<string>()
  let currentCount = 0

  if (rosterDay) {
    const dayAssignments = await prisma.assignment.findMany({
      where: { rosterDayId: rosterDay.id },
      select: { employeeId: true, shiftTemplateId: true },
    })
    for (const a of dayAssignments) {
      assignedAnyShift.add(a.employeeId)
      if (a.shiftTemplateId === shiftTemplateId) {
        assignedThisShift.add(a.employeeId)
        currentCount++
      }
    }
  }

  const required  = template?.requiredEmployees ?? 1
  const openSlots = Math.max(0, required - currentCount)

  // ── Filter to eligible candidates ─────────────────────────────────────
  const eligible = employees.filter(
    (e) => !assignedAnyShift.has(e.id) && !assignedThisShift.has(e.id),
  )

  if (eligible.length === 0) {
    return { scored: [], context, openSlots }
  }

  // ── Compute weekly planned minutes per eligible employee ───────────────
  const { start: weekStart, end: weekEnd } = getWeekBounds(date)

  const weekRosterDays = await prisma.rosterDay.findMany({
    where: { organizationId, date: { gte: weekStart, lte: weekEnd } },
    select: { id: true },
  })

  const plannedMinutesMap = new Map<string, number>()

  if (weekRosterDays.length > 0) {
    const weekAssignments = await prisma.assignment.findMany({
      where: {
        rosterDayId: { in: weekRosterDays.map((d) => d.id) },
        employeeId:  { in: eligible.map((e) => e.id) },
      },
      include: {
        shiftTemplate: { select: { startTime: true, endTime: true } },
      },
    })
    for (const a of weekAssignments) {
      const mins = shiftDurationMinutes(
        a.shiftTemplate.startTime,
        a.shiftTemplate.endTime,
      )
      plannedMinutesMap.set(
        a.employeeId,
        (plannedMinutesMap.get(a.employeeId) ?? 0) + mins,
      )
    }
  }

  // ── Score, annotate, and sort ──────────────────────────────────────────
  const scored: ScoredCandidate[] = eligible.map((employee) => {
    const plannedMinutes  = plannedMinutesMap.get(employee.id) ?? 0
    const contractMinutes = employee.contractHours > 0
      ? Math.round(employee.contractHours * 60)
      : 0
    const { score, tier, reasons, warnings } = scoreEmployee(
      employee,
      plannedMinutes,
      context,
    )
    return { employee, score, tier, reasons, warnings, plannedMinutes, contractMinutes }
  })

  // Best score first; alphabetical on tie
  scored.sort((a, b) =>
    b.score !== a.score
      ? b.score - a.score
      : a.employee.name.localeCompare(b.employee.name),
  )

  return { scored, context, openSlots }
}
