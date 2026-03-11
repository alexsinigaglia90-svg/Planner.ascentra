import { prisma } from '@/lib/db/client'
import type { Location, Department } from '@prisma/client'

export type { Location, Department }

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

export async function getLocations(organizationId: string): Promise<Location[]> {
  return prisma.location.findMany({
    where: { organizationId },
    orderBy: { name: 'asc' },
  })
}

export async function createLocation({
  organizationId,
  name,
}: {
  organizationId: string
  name: string
}): Promise<Location> {
  return prisma.location.upsert({
    where: { organizationId_name: { organizationId, name } },
    update: {},
    create: { organizationId, name },
  })
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

/** Returns only active (non-archived) departments. Use in selectors and employee views. */
export async function getDepartments(organizationId: string): Promise<Department[]> {
  return prisma.department.findMany({
    where: { organizationId, archived: false },
    orderBy: { name: 'asc' },
  })
}

/** Returns all departments including archived. Use in master-data admin views. */
export async function getAllDepartments(organizationId: string): Promise<Department[]> {
  return prisma.department.findMany({
    where: { organizationId },
    orderBy: [{ archived: 'asc' }, { name: 'asc' }],
  })
}

export async function createDepartment({
  organizationId,
  name,
}: {
  organizationId: string
  name: string
}): Promise<Department> {
  return prisma.department.upsert({
    where: { organizationId_name: { organizationId, name } },
    update: {},
    create: { organizationId, name },
  })
}

export async function updateDepartment(
  id: string,
  data: { name?: string },
): Promise<Department> {
  return prisma.department.update({ where: { id }, data })
}

// ---------------------------------------------------------------------------
// Employee assignment helpers
// ---------------------------------------------------------------------------

export async function setEmployeeLocation(
  employeeId: string,
  locationId: string | null,
): Promise<void> {
  await prisma.employee.update({
    where: { id: employeeId },
    data: { locationId },
  })
}

export async function setEmployeeDepartment(
  employeeId: string,
  departmentId: string | null,
): Promise<void> {
  await prisma.employee.update({
    where: { id: employeeId },
    data: { departmentId },
  })
}

// ---------------------------------------------------------------------------
// ShiftTemplate assignment helpers
// ---------------------------------------------------------------------------

export async function setShiftTemplateLocation(
  shiftTemplateId: string,
  locationId: string | null,
): Promise<void> {
  await prisma.shiftTemplate.update({
    where: { id: shiftTemplateId },
    data: { locationId },
  })
}

export async function setShiftTemplateDepartment(
  shiftTemplateId: string,
  departmentId: string | null,
): Promise<void> {
  await prisma.shiftTemplate.update({
    where: { id: shiftTemplateId },
    data: { departmentId },
  })
}
