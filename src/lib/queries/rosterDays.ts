import { prisma } from '@/lib/db/client'
import type { RosterDay } from '@prisma/client'

export type { RosterDay }

export async function getRosterDays(organizationId: string): Promise<RosterDay[]> {
  return prisma.rosterDay.findMany({
    where: { organizationId },
    orderBy: { date: 'asc' },
  })
}
