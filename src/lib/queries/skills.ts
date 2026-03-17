import { prisma } from '@/lib/db/client'
import type { Skill } from '@prisma/client'

export type { Skill }

export async function getSkills(organizationId: string): Promise<Skill[]> {
  return prisma.skill.findMany({
    where: { organizationId },
    orderBy: { name: 'asc' },
  })
}

export interface SkillWithUsage {
  id: string
  name: string
  employeeCount: number
  shiftCount: number
  employeeNames: string[]
}

export async function getSkillsWithUsage(organizationId: string): Promise<SkillWithUsage[]> {
  const skills = await prisma.skill.findMany({
    where: { organizationId },
    orderBy: { name: 'asc' },
    include: {
      employeeSkills: {
        include: { employee: { select: { name: true, status: true } } },
      },
      shiftTemplates: { select: { id: true } },
    },
  })

  return skills.map((s) => {
    const activeEmployees = s.employeeSkills.filter((es) => es.employee.status === 'active')
    return {
      id: s.id,
      name: s.name,
      employeeCount: activeEmployees.length,
      shiftCount: s.shiftTemplates.length,
      employeeNames: activeEmployees.map((es) => es.employee.name).sort(),
    }
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
