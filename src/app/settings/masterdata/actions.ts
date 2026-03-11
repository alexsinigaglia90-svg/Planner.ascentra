'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/auth/context'
import { prisma } from '@/lib/db/client'
import {
  createDepartment,
  updateDepartment,
} from '@/lib/queries/locations'
import {
  createEmployeeFunction,
  updateEmployeeFunction,
} from '@/lib/queries/functions'

// ─── Guard ────────────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<
  { orgId: string } | { ok: false; error: string }
> {
  const ctx = await getCurrentContext()
  if (ctx.role !== 'admin') return { ok: false, error: 'Only administrators may manage master data.' }
  return { orgId: ctx.orgId }
}

function isValidId(s: unknown): s is string {
  return typeof s === 'string' && s.trim().length >= 10
}

// ─── Department actions ───────────────────────────────────────────────────────

export async function createDepartmentMdAction(
  name: string,
): Promise<{ ok: true; id: string; name: string } | { ok: false; error: string }> {
  const guard = await requireAdmin()
  if ('ok' in guard && !guard.ok) return guard
  const { orgId } = guard as { orgId: string }

  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'Department name is required.' }
  if (trimmed.length > 80) return { ok: false, error: 'Name too long (max 80 chars).' }

  try {
    const dept = await createDepartment({ organizationId: orgId, name: trimmed })
    revalidatePath('/settings/masterdata')
    revalidatePath('/employees')
    return { ok: true, id: dept.id, name: dept.name }
  } catch {
    return { ok: false, error: 'Could not create department. The name may already be taken.' }
  }
}

export async function updateDepartmentMdAction(
  id: string,
  name: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdmin()
  if ('ok' in guard && !guard.ok) return guard

  if (!isValidId(id)) return { ok: false, error: 'Invalid department ID.' }
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'Department name is required.' }
  if (trimmed.length > 80) return { ok: false, error: 'Name too long (max 80 chars).' }

  try {
    await updateDepartment(id, { name: trimmed })
    revalidatePath('/settings/masterdata')
    revalidatePath('/employees')
    revalidatePath('/planning')
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not update department. The name may already be taken.' }
  }
}

export async function deleteDepartmentMdAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdmin()
  if ('ok' in guard && !guard.ok) return guard
  const { orgId } = guard as { orgId: string }

  if (!isValidId(id)) return { ok: false, error: 'Invalid department ID.' }

  try {
    // Guard: block delete if any employees are linked
    const count = await prisma.employee.count({ where: { departmentId: id, organizationId: orgId } })
    if (count > 0) {
      return {
        ok: false,
        error: `Cannot delete — ${count} employee${count !== 1 ? 's are' : ' is'} assigned to this department. Reassign them first.`,
      }
    }

    const existing = await prisma.department.findFirst({ where: { id, organizationId: orgId } })
    if (!existing) return { ok: false, error: 'Department not found.' }

    await prisma.department.delete({ where: { id } })
    revalidatePath('/settings/masterdata')
    revalidatePath('/employees')
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not delete department. Please try again.' }
  }
}

export async function archiveDepartmentMdAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdmin()
  if ('ok' in guard && !guard.ok) return guard
  const { orgId } = guard as { orgId: string }

  if (!isValidId(id)) return { ok: false, error: 'Invalid department ID.' }

  const existing = await prisma.department.findFirst({ where: { id, organizationId: orgId } })
  if (!existing) return { ok: false, error: 'Department not found.' }
  if (existing.archived) return { ok: false, error: 'Already archived.' }

  await prisma.department.update({ where: { id }, data: { archived: true } })
  revalidatePath('/settings/masterdata')
  revalidatePath('/employees')
  revalidatePath('/workforce/employees')
  return { ok: true }
}

export async function restoreDepartmentMdAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdmin()
  if ('ok' in guard && !guard.ok) return guard
  const { orgId } = guard as { orgId: string }

  if (!isValidId(id)) return { ok: false, error: 'Invalid department ID.' }

  const existing = await prisma.department.findFirst({ where: { id, organizationId: orgId } })
  if (!existing) return { ok: false, error: 'Department not found.' }
  if (!existing.archived) return { ok: false, error: 'Department is not archived.' }

  await prisma.department.update({ where: { id }, data: { archived: false } })
  revalidatePath('/settings/masterdata')
  revalidatePath('/employees')
  revalidatePath('/workforce/employees')
  return { ok: true }
}

// ─── Function actions ─────────────────────────────────────────────────────────

export async function createFunctionMdAction(
  name: string,
  overhead: boolean,
): Promise<{ ok: true; id: string; name: string; overhead: boolean } | { ok: false; error: string }> {
  const guard = await requireAdmin()
  if ('ok' in guard && !guard.ok) return guard
  const { orgId } = guard as { orgId: string }

  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'Function name is required.' }
  if (trimmed.length > 80) return { ok: false, error: 'Name too long (max 80 chars).' }

  try {
    const fn = await createEmployeeFunction({ organizationId: orgId, name: trimmed, overhead })
    revalidatePath('/settings/masterdata')
    revalidatePath('/employees')
    revalidatePath('/workforce/employees')
    return { ok: true, id: fn.id, name: fn.name, overhead: fn.overhead }
  } catch {
    return { ok: false, error: 'Could not create function. The name may already be taken.' }
  }
}

export async function updateFunctionMdAction(
  id: string,
  data: { name?: string; overhead?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdmin()
  if ('ok' in guard && !guard.ok) return guard

  if (!isValidId(id)) return { ok: false, error: 'Invalid function ID.' }
  const update: { name?: string; overhead?: boolean } = {}

  if (data.name !== undefined) {
    const trimmed = data.name.trim()
    if (!trimmed) return { ok: false, error: 'Function name is required.' }
    if (trimmed.length > 80) return { ok: false, error: 'Name too long (max 80 chars).' }
    update.name = trimmed
  }
  if (data.overhead !== undefined) update.overhead = data.overhead

  try {
    await updateEmployeeFunction(id, update)
    revalidatePath('/settings/masterdata')
    revalidatePath('/employees')
    revalidatePath('/workforce/employees')
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not update function. The name may already be taken.' }
  }
}

export async function deleteFunctionMdAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdmin()
  if ('ok' in guard && !guard.ok) return guard
  const { orgId } = guard as { orgId: string }

  if (!isValidId(id)) return { ok: false, error: 'Invalid function ID.' }

  try {
    // Guard: block delete if any employees are linked
    const count = await prisma.employee.count({ where: { functionId: id, organizationId: orgId } })
    if (count > 0) {
      return {
        ok: false,
        error: `Cannot delete — ${count} employee${count !== 1 ? 's are' : ' is'} assigned to this function. Reassign them first.`,
      }
    }

    const existing = await prisma.employeeFunction.findFirst({ where: { id, organizationId: orgId } })
    if (!existing) return { ok: false, error: 'Function not found.' }

    await prisma.employeeFunction.delete({ where: { id } })
    revalidatePath('/settings/masterdata')
    revalidatePath('/employees')
    revalidatePath('/workforce/employees')
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not delete function. Please try again.' }
  }
}

export async function archiveFunctionMdAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdmin()
  if ('ok' in guard && !guard.ok) return guard
  const { orgId } = guard as { orgId: string }

  if (!isValidId(id)) return { ok: false, error: 'Invalid function ID.' }

  const existing = await prisma.employeeFunction.findFirst({ where: { id, organizationId: orgId } })
  if (!existing) return { ok: false, error: 'Function not found.' }
  if (existing.archived) return { ok: false, error: 'Already archived.' }

  await prisma.employeeFunction.update({ where: { id }, data: { archived: true } })
  revalidatePath('/settings/masterdata')
  revalidatePath('/employees')
  revalidatePath('/workforce/employees')
  return { ok: true }
}

export async function restoreFunctionMdAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdmin()
  if ('ok' in guard && !guard.ok) return guard
  const { orgId } = guard as { orgId: string }

  if (!isValidId(id)) return { ok: false, error: 'Invalid function ID.' }

  const existing = await prisma.employeeFunction.findFirst({ where: { id, organizationId: orgId } })
  if (!existing) return { ok: false, error: 'Function not found.' }
  if (!existing.archived) return { ok: false, error: 'Function is not archived.' }

  await prisma.employeeFunction.update({ where: { id }, data: { archived: false } })
  revalidatePath('/settings/masterdata')
  revalidatePath('/employees')
  revalidatePath('/workforce/employees')
  return { ok: true }
}

// ─── Usage counts (for display) ───────────────────────────────────────────────

export async function getDepartmentUsageAction(departmentId: string): Promise<number> {
  const ctx = await getCurrentContext()
  return prisma.employee.count({ where: { departmentId, organizationId: ctx.orgId } })
}

