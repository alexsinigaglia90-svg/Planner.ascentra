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

export async function getDepartments(organizationId: string): Promise<Department[]> {
  return prisma.department.findMany({
    where: { organizationId },
    orderBy: { name: 'asc' },
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
