import { prisma } from '@/lib/db/client'
import type { ShiftRequirement } from '@prisma/client'

export type { ShiftRequirement }

/**
 * Returns all ShiftRequirement rows for the given org, keyed by shiftTemplateId.
 */
export async function getShiftRequirements(
  organizationId: string,
): Promise<ShiftRequirement[]> {
  return prisma.shiftRequirement.findMany({
    where: { organizationId },
  })
}

/**
 * Upsert the required headcount for a specific shift template within an org.
 * Creates the row on first call; updates it on subsequent calls.
 */
export async function setShiftRequirement(data: {
  organizationId: string
  shiftTemplateId: string
  requiredHeadcount: number
}): Promise<ShiftRequirement> {
  const { organizationId, shiftTemplateId, requiredHeadcount } = data
  return prisma.shiftRequirement.upsert({
    where: { organizationId_shiftTemplateId: { organizationId, shiftTemplateId } },
    create: { organizationId, shiftTemplateId, requiredHeadcount },
    update: { requiredHeadcount },
  })
}
