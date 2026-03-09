import { prisma } from '@/lib/db/client'
import type { ShiftTemplate } from '@prisma/client'

export type { ShiftTemplate }

export type ShiftTemplateWithSkill = ShiftTemplate & {
  requiredSkill: { id: string; name: string } | null
}

export type ShiftTemplateWithContext = ShiftTemplate & {
  requiredSkill: { id: string; name: string } | null
  location: { id: string; name: string } | null
  department: { id: string; name: string } | null
}

export async function getShiftTemplates(organizationId: string): Promise<ShiftTemplate[]> {
  return prisma.shiftTemplate.findMany({
    where: { organizationId },
    orderBy: { name: 'asc' },
  })
}

export async function getShiftTemplatesWithSkill(
  organizationId: string,
): Promise<ShiftTemplateWithSkill[]> {
  const rows = await prisma.shiftTemplate.findMany({
    where: { organizationId },
    include: { requiredSkill: true },
    orderBy: { name: 'asc' },
  })
  return rows as ShiftTemplateWithSkill[]
}

export async function getShiftTemplatesWithContext(
  organizationId: string,
): Promise<ShiftTemplateWithContext[]> {
  const rows = await prisma.shiftTemplate.findMany({
    where: { organizationId },
    include: { requiredSkill: true, location: true, department: true },
    orderBy: { name: 'asc' },
  })
  return rows as ShiftTemplateWithContext[]
}

export async function createShiftTemplate(data: {
  organizationId: string
  name: string
  startTime: string
  endTime: string
  requiredEmployees: number
}): Promise<ShiftTemplate> {
  return prisma.shiftTemplate.create({ data })
}
