import { prisma } from '@/lib/db/client'
import type { EmployeeFunction } from '@prisma/client'

export type { EmployeeFunction }

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Returns only active (non-archived) functions. Use in selectors and employee views. */
export async function getEmployeeFunctions(
  organizationId: string,
): Promise<EmployeeFunction[]> {
  return prisma.employeeFunction.findMany({
    where: { organizationId, archived: false },
    orderBy: { name: 'asc' },
  })
}

/** Returns all functions including archived. Use in master-data admin views. */
export async function getAllEmployeeFunctions(
  organizationId: string,
): Promise<EmployeeFunction[]> {
  return prisma.employeeFunction.findMany({
    where: { organizationId },
    orderBy: [{ archived: 'asc' }, { name: 'asc' }],
  })
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createEmployeeFunction({
  organizationId,
  name,
  overhead = false,
}: {
  organizationId: string
  name: string
  overhead?: boolean
}): Promise<EmployeeFunction> {
  return prisma.employeeFunction.upsert({
    where: { organizationId_name: { organizationId, name } },
    update: {},
    create: { organizationId, name, overhead },
  })
}

export async function updateEmployeeFunction(
  id: string,
  data: { name?: string; overhead?: boolean },
): Promise<EmployeeFunction> {
  return prisma.employeeFunction.update({ where: { id }, data })
}

// ---------------------------------------------------------------------------
// Employee assignment helper
// ---------------------------------------------------------------------------

export async function setEmployeeFunction(
  employeeId: string,
  functionId: string | null,
): Promise<void> {
  await prisma.employee.update({
    where: { id: employeeId },
    data: { functionId },
  })
}
