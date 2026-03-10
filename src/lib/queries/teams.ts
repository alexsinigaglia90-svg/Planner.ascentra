import { prisma } from '@/lib/db/client'
import type { Team, TeamRotationSlot } from '@prisma/client'
import type { TeamWithSlots as DomainTeamWithSlots } from '@/lib/teams'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TeamWithSlots = Team & {
  rotationSlots: (TeamRotationSlot & {
    shiftTemplate: { id: string; name: string }
  })[]
}

export type TeamSummary = {
  id: string
  name: string
  color: string | null
  rotationAnchorDate: string
  rotationLength: number
  _count: { employees: number }
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getTeams(organizationId: string): Promise<TeamWithSlots[]> {
  return prisma.team.findMany({
    where: { organizationId },
    orderBy: { name: 'asc' },
    include: {
      rotationSlots: {
        orderBy: { weekOffset: 'asc' },
        include: { shiftTemplate: { select: { id: true, name: true } } },
      },
    },
  })
}

export async function getTeamSummaries(organizationId: string): Promise<TeamSummary[]> {
  return prisma.team.findMany({
    where: { organizationId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      color: true,
      rotationAnchorDate: true,
      rotationLength: true,
      _count: { select: { employees: true } },
    },
  })
}

export async function getTeamById(
  id: string,
  organizationId: string,
): Promise<TeamWithSlots | null> {
  return prisma.team.findFirst({
    where: { id, organizationId },
    include: {
      rotationSlots: {
        orderBy: { weekOffset: 'asc' },
        include: { shiftTemplate: { select: { id: true, name: true } } },
      },
    },
  })
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export async function createTeam(data: {
  organizationId: string
  name: string
  color?: string | null
  rotationAnchorDate: string
  rotationLength: number
}): Promise<Team> {
  return prisma.team.create({ data })
}

export async function updateTeam(
  id: string,
  organizationId: string,
  data: {
    name?: string
    color?: string | null
    rotationAnchorDate?: string
    rotationLength?: number
  },
): Promise<Team> {
  // Verify ownership before mutating
  const existing = await prisma.team.findFirst({ where: { id, organizationId } })
  if (!existing) throw new Error('Team not found')
  return prisma.team.update({ where: { id }, data })
}

export async function deleteTeam(id: string, organizationId: string): Promise<void> {
  const existing = await prisma.team.findFirst({ where: { id, organizationId } })
  if (!existing) throw new Error('Team not found')
  await prisma.team.delete({ where: { id } })
}

/**
 * Replace all rotation slots for a team in a single transaction.
 * slots is an array of { weekOffset, shiftTemplateId } in any order.
 */
export async function setTeamRotationSlots(
  teamId: string,
  organizationId: string,
  slots: { weekOffset: number; shiftTemplateId: string }[],
): Promise<void> {
  const existing = await prisma.team.findFirst({ where: { id: teamId, organizationId } })
  if (!existing) throw new Error('Team not found')

  await prisma.$transaction([
    prisma.teamRotationSlot.deleteMany({ where: { teamId } }),
    prisma.teamRotationSlot.createMany({
      data: slots.map((s) => ({ teamId, weekOffset: s.weekOffset, shiftTemplateId: s.shiftTemplateId })),
    }),
  ])
}

export async function setEmployeeTeam(
  employeeId: string,
  teamId: string | null,
): Promise<void> {
  await prisma.employee.update({
    where: { id: employeeId },
    data: { teamId },
  })
}

/**
 * Returns a Map<employeeId, TeamWithSlots> for efficient violation checking
 * during planning. Only fetches rotation slot data (no shiftTemplate join).
 */
export async function getEmployeeTeamMap(
  organizationId: string,
): Promise<Map<string, DomainTeamWithSlots>> {
  const teams = await prisma.team.findMany({
    where: { organizationId },
    include: {
      rotationSlots: {
        select: {
          id: true,
          teamId: true,
          weekOffset: true,
          shiftTemplateId: true,
        },
      },
      employees: { select: { id: true } },
    },
  })

  const map = new Map<string, DomainTeamWithSlots>()
  for (const team of teams) {
    const domainTeam: DomainTeamWithSlots = {
      id: team.id,
      organizationId: team.organizationId,
      name: team.name,
      color: team.color,
      rotationAnchorDate: team.rotationAnchorDate,
      rotationLength: team.rotationLength,
      createdAt: team.createdAt,
      rotationSlots: team.rotationSlots as TeamRotationSlot[],
    }
    for (const emp of (team as typeof team & { employees: { id: string }[] }).employees) {
      map.set(emp.id, domainTeam)
    }
  }
  return map
}
