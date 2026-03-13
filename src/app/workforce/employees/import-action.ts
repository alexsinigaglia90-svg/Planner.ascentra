'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { createEmployee } from '@/lib/queries/employees'
import { getCurrentContext, canMutate } from '@/lib/auth/context'
import { resolveEmployeeType, resolveFixedWorkingDays } from '@/lib/import/employeeImport'

export type BulkImportRow = {
  name: string
  /** Canonical employee type resolved by the client before submission. */
  employeeType: 'internal' | 'temp'
  /** ID of an existing Department in the org. */
  mainDepartmentId: string
  /** ID of an existing EmployeeFunction in the org. */
  functionId: string
  teamId: string | null
  /** Optional ID of an existing Location in the org. */
  locationId?: string | null
  /** Contract hours per week (e.g. 40). Defaults to 0 when not provided. */
  contractHours?: number
  /** Optional fixed working days, already validated + normalised client-side. */
  fixedWorkingDays?: string[]
}

export type BulkImportResult =
  | { ok: true; created: number; skipped: number }
  | { ok: false; error: string }

export async function bulkImportEmployeesAction(
  rows: BulkImportRow[],
): Promise<BulkImportResult> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }

  const validRows = rows.filter((r) => r.name.trim().length > 0)
  if (validRows.length === 0) return { ok: false, error: 'No valid rows to import.' }

  // ── Server-side validation (defense in depth) ─────────────────────────────

  // Load all department and function IDs in one query each — no N+1
  const [orgDepts, orgFns, orgLocations] = await Promise.all([
    prisma.department.findMany({ where: { organizationId: orgId }, select: { id: true } }),
    prisma.employeeFunction.findMany({ where: { organizationId: orgId }, select: { id: true } }),
    prisma.location.findMany({ where: { organizationId: orgId }, select: { id: true } }),
  ])
  const validDeptIds = new Set(orgDepts.map((d) => d.id))
  const validFnIds = new Set(orgFns.map((f) => f.id))
  const validLocationIds = new Set(orgLocations.map((l) => l.id))

  for (const row of validRows) {
    if (resolveEmployeeType(row.employeeType) === null) {
      return { ok: false, error: `Invalid employee type: "${row.employeeType}".` }
    }
    if (!validDeptIds.has(row.mainDepartmentId)) {
      return { ok: false, error: `Department not found (id: ${row.mainDepartmentId}). It may have been deleted.` }
    }
    if (!validFnIds.has(row.functionId)) {
      return { ok: false, error: `Function not found (id: ${row.functionId}). It may have been deleted.` }
    }
    if (row.locationId != null && !validLocationIds.has(row.locationId)) {
      return { ok: false, error: `Location not found (id: ${row.locationId}). It may have been deleted.` }
    }
    // Server-side guard: re-validate fixedWorkingDays if provided as a raw string array
    if (row.fixedWorkingDays !== undefined) {
      for (const day of row.fixedWorkingDays) {
        if (resolveFixedWorkingDays(day) === null) {
          return { ok: false, error: `Invalid fixed working day value: "${day}".` }
        }
      }
    }
  }

  // ── Duplicate detection ────────────────────────────────────────────────────

  const existingEmployees = await prisma.employee.findMany({
    where: { organizationId: orgId },
    select: { name: true },
  })
  const existingNames = new Set(existingEmployees.map((e) => e.name.toLowerCase().trim()))

  let created = 0
  let skipped = 0

  for (const row of validRows) {
    const name = row.name.trim()

    // Skip duplicates (case-insensitive)
    if (existingNames.has(name.toLowerCase())) {
      skipped++
      continue
    }

    // Placeholder email: unique per import row
    const email = `import-${crypto.randomUUID()}@placeholder`

    const emp = await createEmployee({
      organizationId: orgId,
      name,
      email,
      employeeType: row.employeeType,
      contractHours: row.contractHours ?? 0,
      status: 'active',
      functionId: row.functionId,
      mainDepartmentId: row.mainDepartmentId,
      ...(row.locationId != null ? { locationId: row.locationId } : {}),
      ...(row.fixedWorkingDays !== undefined ? { fixedWorkingDays: row.fixedWorkingDays } : {}),
    })

    if (row.teamId) {
      await prisma.employee.update({ where: { id: emp.id }, data: { teamId: row.teamId } })
    }

    existingNames.add(name.toLowerCase())
    created++
  }

  revalidatePath('/workforce/employees')
  revalidatePath('/employees')

  return { ok: true, created, skipped }
}

