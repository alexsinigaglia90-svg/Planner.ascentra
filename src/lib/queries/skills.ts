import { prisma } from '@/lib/db/client'
import type { Skill } from '@prisma/client'

export type { Skill }

export async function getSkills(organizationId: string): Promise<Skill[]> {
  return prisma.skill.findMany({
    where: { organizationId },
    orderBy: { name: 'asc' },
  })
}

export async function createSkill({
  organizationId,
  name,
}: {
  organizationId: string
  name: string
}): Promise<Skill> {
  return prisma.skill.upsert({
    where: { organizationId_name: { organizationId, name } },
    update: {},
    create: { organizationId, name },
  })
}

export async function addEmployeeSkill({
  employeeId,
  skillId,
}: {
  employeeId: string
  skillId: string
}): Promise<void> {
  await prisma.employeeSkill.upsert({
    where: { employeeId_skillId: { employeeId, skillId } },
    update: {},
    create: { employeeId, skillId },
  })
}

export async function removeEmployeeSkill({
  employeeId,
  skillId,
}: {
  employeeId: string
  skillId: string
}): Promise<void> {
  await prisma.employeeSkill.deleteMany({
    where: { employeeId, skillId },
  })
}

export async function setShiftRequiredSkill({
  shiftTemplateId,
  skillId,
}: {
  shiftTemplateId: string
  skillId: string | null
}): Promise<void> {
  await prisma.shiftTemplate.update({
    where: { id: shiftTemplateId },
    data: { requiredSkillId: skillId },
  })
}
