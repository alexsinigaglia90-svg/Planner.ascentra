import { prisma } from '@/lib/db/client'
import type { Location, Department } from '@prisma/client'

export type { Location, Department }

// ---------------------------------------------------------------------------
// DepartmentWithChildren — Department with its immediate subdepartments loaded.
// Used wherever the hierarchy needs to be rendered or traversed.
// ---------------------------------------------------------------------------
export type DepartmentWithChildren = Department & {
  children: Department[]
}

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

export async function reparentDepartment(
  id: string,
  newParentId: string | null,
): Promise<Department> {
  return prisma.department.update({ where: { id }, data: { parentDepartmentId: newParentId } })
}

/**
 * Returns all active top-level departments for the org, each with their
 * immediate active children (subdepartments) pre-loaded.
 * Use this wherever the department hierarchy needs to be displayed or navigated.
 */
export async function getDepartmentsWithHierarchy(
  organizationId: string,
): Promise<DepartmentWithChildren[]> {
  const rows = await prisma.department.findMany({
    where: { organizationId, archived: false, parentDepartmentId: null },
    include: {
      children: {
        where: { archived: false },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })
  return rows as DepartmentWithChildren[]
}

/**
 * Creates a subdepartment under a given parent department.
 * The parent must belong to the same organization.
 * Subdepartment names must be unique within the organization.
 */
export async function createSubdepartment({
  organizationId,
  name,
  parentDepartmentId,
}: {
  organizationId: string
  name: string
  parentDepartmentId: string
}): Promise<Department> {
  return prisma.department.upsert({
    where: { organizationId_name: { organizationId, name } },
    update: { parentDepartmentId },
    create: { organizationId, name, parentDepartmentId },
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
