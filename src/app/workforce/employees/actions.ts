'use server'

import { revalidatePath } from 'next/cache'
import { createEmployee } from '@/lib/queries/employees'
import type { Employee } from '@/lib/queries/employees'
import { setEmployeeTeam } from '@/lib/queries/teams'
import { getCurrentContext, canMutate } from '@/lib/auth/context'
import { prisma } from '@/lib/db/client'

export async function createWorkforceEmployeeAction(
  formData: FormData,
): Promise<{ ok: true; employee: Employee } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }

  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()
  const employeeType = formData.get('employeeType') as string
  const contractHours = parseFloat(formData.get('contractHours') as string)
  const status = formData.get('status') as string
  const teamId = (formData.get('teamId') as string) || null

  if (!name || !email || !employeeType || isNaN(contractHours) || !status) {
    return { ok: false, error: 'Please fill in all required fields.' }
  }

  try {
    const created = await createEmployee({ organizationId: orgId, name, email, employeeType, contractHours, status })
    if (teamId) {
      await setEmployeeTeam(created.id, teamId)
    }
    revalidatePath('/workforce/employees')
    revalidatePath('/employees')
    // Return the employee with the resolved teamId so the client can update immediately
    return { ok: true, employee: { ...created, teamId } }
  } catch (err) {
    console.error('createWorkforceEmployeeAction error:', err)
    return { ok: false, error: 'Could not create employee. Please try again.' }
  }
}

export async function setWorkforceEmployeeTeamAction(
  employeeId: string,
  teamId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  if (!employeeId) return { ok: false, error: 'Invalid data.' }
  try {
    await setEmployeeTeam(employeeId, teamId)
    revalidatePath('/workforce/employees')
    revalidatePath('/employees')
    return { ok: true }
  } catch (err) {
    console.error('setWorkforceEmployeeTeamAction error:', err)
    return { ok: false, error: 'Could not update team. Please try again.' }
  }
}

// ── Delete single employee (guarded: blocked if employee has assignments) ──────────

export async function deleteEmployeeAction(
  employeeId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  if (!employeeId?.trim()) return { ok: false, error: 'Invalid employee ID.' }

  try {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, organizationId: orgId },
      select: { id: true, name: true },
    })
    if (!employee) return { ok: false, error: 'Employee not found.' }

    // Guard: block hard delete when the employee has planning assignment history.
    // Callers should deactivate instead of deleting in that case.
    const assignmentCount = await prisma.assignment.count({ where: { employeeId } })
    if (assignmentCount > 0) {
      return {
        ok: false,
        error:
          `Cannot delete — ${employee.name} has ${assignmentCount}` +
          ` assignment${assignmentCount !== 1 ? 's' : ''} in the planning history.` +
          ` Deactivate them instead.`,
      }
    }

    await prisma.employee.delete({ where: { id: employeeId } })
    revalidatePath('/workforce/employees')
    return { ok: true }
  } catch (err) {
    console.error('deleteEmployeeAction error:', err)
    return { ok: false, error: 'Could not delete employee. Please try again.' }
  }
}

// ── Bulk delete (guarded: skips employees with assignments) ──────────────────────

export async function bulkDeleteEmployeesAction(
  employeeIds: string[],
): Promise<
  | { ok: true; deletedIds: string[]; blockedCount: number; blockedNames: string[] }
  | { ok: false; error: string }
> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  if (!employeeIds.length) return { ok: false, error: 'No employees selected.' }

  try {
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds }, organizationId: orgId },
      select: { id: true, name: true },
    })

    const assignedIds = new Set(
      (
        await prisma.assignment.findMany({
          where: { employeeId: { in: employees.map((e) => e.id) } },
          select: { employeeId: true },
        })
      ).map((a) => a.employeeId),
    )

    const toDelete = employees.filter((e) => !assignedIds.has(e.id))
    const blocked  = employees.filter((e) => assignedIds.has(e.id))

    if (toDelete.length > 0) {
      await prisma.employee.deleteMany({ where: { id: { in: toDelete.map((e) => e.id) } } })
    }

    revalidatePath('/workforce/employees')
    return {
      ok: true,
      deletedIds:   toDelete.map((e) => e.id),
      blockedCount: blocked.length,
      blockedNames: blocked.map((e) => e.name),
    }
  } catch (err) {
    console.error('bulkDeleteEmployeesAction error:', err)
    return { ok: false, error: 'Could not complete bulk delete. Please try again.' }
  }
}

// ── Bulk team assignment ─────────────────────────────────────────────────────────

export async function bulkSetTeamAction(
  employeeIds: string[],
  teamId: string | null,
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  if (!employeeIds.length) return { ok: false, error: 'No employees selected.' }

  try {
    const result = await prisma.employee.updateMany({
      where: { id: { in: employeeIds }, organizationId: orgId },
      data: { teamId },
    })
    revalidatePath('/workforce/employees')
    return { ok: true, updated: result.count }
  } catch (err) {
    console.error('bulkSetTeamAction error:', err)
    return { ok: false, error: 'Could not update teams. Please try again.' }
  }
}

// ── Bulk status update ────────────────────────────────────────────────────────────

export async function bulkSetStatusAction(
  employeeIds: string[],
  status: string,
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  if (!employeeIds.length) return { ok: false, error: 'No employees selected.' }
  if (!['active', 'inactive'].includes(status)) return { ok: false, error: 'Invalid status value.' }

  try {
    const result = await prisma.employee.updateMany({
      where: { id: { in: employeeIds }, organizationId: orgId },
      data: { status },
    })
    revalidatePath('/workforce/employees')
    return { ok: true, updated: result.count }
  } catch (err) {
    console.error('bulkSetStatusAction error:', err)
    return { ok: false, error: 'Could not update status. Please try again.' }
  }
}
