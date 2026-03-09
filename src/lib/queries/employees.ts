import { prisma } from '@/lib/db/client'
import type { Employee } from '@prisma/client'

export type { Employee }

export interface SkillEntry {
  id: string
  skillId: string
  skill: { id: string; name: string }
}

export type EmployeeWithSkills = Employee & { skills: SkillEntry[] }

export type EmployeeWithContext = Employee & {
  skills: SkillEntry[]
  location: { id: string; name: string } | null
  department: { id: string; name: string } | null
}

export async function getEmployees(organizationId: string): Promise<Employee[]> {
  return prisma.employee.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getEmployeesWithSkills(
  organizationId: string,
): Promise<EmployeeWithSkills[]> {
  const rows = await prisma.employee.findMany({
    where: { organizationId },
    include: { skills: { include: { skill: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return rows as EmployeeWithSkills[]
}

export async function getEmployeesWithContext(
  organizationId: string,
): Promise<EmployeeWithContext[]> {
  const rows = await prisma.employee.findMany({
    where: { organizationId },
    include: {
      skills: { include: { skill: true } },
      location: true,
      department: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  return rows as EmployeeWithContext[]
}

export async function createEmployee(data: {
  organizationId: string
  name: string
  email: string
  employeeType: string
  contractHours: number
  status: string
}): Promise<Employee> {
  return prisma.employee.create({ data })
}
