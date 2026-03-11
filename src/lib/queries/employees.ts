import { prisma } from '@/lib/db/client'
import type { Employee } from '@prisma/client'

export type { Employee }

// ---------------------------------------------------------------------------
// EmployeeType — canonical string union for the employeeType field
// Stored in DB as lowercase ('internal' | 'temp') for backward compatibility
// ---------------------------------------------------------------------------
export type EmployeeType = 'internal' | 'temp'

export interface SkillEntry {
  id: string
  skillId: string
  skill: { id: string; name: string }
}

export type EmployeeWithSkills = Employee & { skills: SkillEntry[] }

export type TeamEntry = {
  id: string
  name: string
  color: string | null
  rotationAnchorDate: string
  rotationLength: number
  rotationSlots: { weekOffset: number; shiftTemplateId: string }[]
}

export type EmployeeWithContext = Employee & {
  skills: SkillEntry[]
  location: { id: string; name: string } | null
  department: { id: string; name: string } | null
  employeeFunction: { id: string; name: string; overhead: boolean } | null
  team: TeamEntry | null
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
      employeeFunction: { select: { id: true, name: true, overhead: true } },
      team: {
        select: {
          id: true,
          name: true,
          color: true,
          rotationAnchorDate: true,
          rotationLength: true,
          rotationSlots: {
            select: { weekOffset: true, shiftTemplateId: true },
          },
        },
      },
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
  /** nullable — backward compatible; callers may omit */
  functionId?: string | null
  /** nullable — backward compatible; callers may omit */
  mainDepartmentId?: string | null
}): Promise<Employee> {
  const { mainDepartmentId, ...rest } = data
  return prisma.employee.create({
    data: {
      ...rest,
      // mainDepartmentId maps to the existing departmentId column
      ...(mainDepartmentId !== undefined ? { departmentId: mainDepartmentId } : {}),
    },
  })
}
