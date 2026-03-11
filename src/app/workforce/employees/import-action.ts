'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { createEmployee } from '@/lib/queries/employees'
import { getCurrentContext, canMutate } from '@/lib/auth/context'
import { resolveEmployeeType } from '@/lib/import/employeeImport'

export type BulkImportRow = {
  name: string
  /** Canonical employee type resolved by the client before submission. */
  employeeType: 'internal' | 'temp'
  /** ID of an existing Department in the org. */
  mainDepartmentId: string
  /** ID of an existing EmployeeFunction in the org. */
  functionId: string
  teamId: string | null
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
  const [orgDepts, orgFns] = await Promise.all([
    prisma.department.findMany({ where: { organizationId: orgId }, select: { id: true } }),
    prisma.employeeFunction.findMany({ where: { organizationId: orgId }, select: { id: true } }),
  ])
  const validDeptIds = new Set(orgDepts.map((d) => d.id))
  const validFnIds = new Set(orgFns.map((f) => f.id))

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
      contractHours: 0,
      status: 'active',
      functionId: row.functionId,
      mainDepartmentId: row.mainDepartmentId,
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

