'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { getCurrentContext, canMutate } from '@/lib/auth/context'
import { logAction } from '@/lib/audit'
import { notifyOrgPlanners } from '@/lib/notify'

export async function createLeaveAction(input: {
  employeeId: string
  type: 'leave' | 'absence'
  category: string
  startDate: string
  endDate: string
  notes?: string
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'Geen toegang.' }

  try {
    // Check for overlapping leave/absence for the same employee
    const overlapping = await prisma.leaveRecord.findFirst({
      where: {
        organizationId: orgId,
        employeeId: input.employeeId,
        status: { not: 'rejected' },
        startDate: { lte: input.endDate },
        endDate: { gte: input.startDate },
      },
      select: { startDate: true, endDate: true, category: true },
    })
    if (overlapping) {
      return {
        ok: false,
        error: `Deze medewerker heeft al een registratie (${overlapping.category}) die overlapt met deze periode (${overlapping.startDate} t/m ${overlapping.endDate}).`,
      }
    }

    // Auto-approve absences (sick etc), leave stays pending
    const status = input.type === 'absence' ? 'approved' : 'pending'

    const record = await prisma.leaveRecord.create({
      data: {
        organizationId: orgId,
        employeeId: input.employeeId,
        type: input.type,
        category: input.category,
        startDate: input.startDate,
        endDate: input.endDate,
        status,
        notes: input.notes ?? null,
      },
    })

    await logAction({
      organizationId: orgId,
      userId,
      actionType: 'create_assignment',
      entityType: 'bulk',
      entityId: record.id,
      summary: `${input.type === 'leave' ? 'Leave' : 'Absence'} registered: ${input.category} ${input.startDate} – ${input.endDate}`,
      afterData: { ...input, status },
    })

    // Notify planners about new leave/absence
    const employee = await prisma.employee.findUnique({ where: { id: input.employeeId }, select: { name: true } })
    const empName = employee?.name ?? 'Medewerker'
    if (input.type === 'leave') {
      await notifyOrgPlanners({
        organizationId: orgId,
        type: 'understaffed',
        title: 'Nieuwe verlofaanvraag',
        message: `${empName} heeft verlof aangevraagd (${input.category}) van ${input.startDate} t/m ${input.endDate}. Wacht op goedkeuring.`,
        severity: 'warning',
      })
    } else {
      await notifyOrgPlanners({
        organizationId: orgId,
        type: 'understaffed',
        title: 'Verzuim gemeld',
        message: `${empName} is afwezig gemeld (${input.category}) van ${input.startDate} t/m ${input.endDate}.`,
        severity: 'critical',
      })
    }

    revalidatePath('/leave')
    revalidatePath('/absence')
    revalidatePath('/planning')
    return { ok: true, id: record.id }
  } catch (err) {
    console.error('createLeaveAction error:', err)
    return { ok: false, error: 'Kon registratie niet aanmaken.' }
  }
}

export async function updateLeaveStatusAction(
  id: string,
  status: 'approved' | 'rejected',
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'Geen toegang.' }

  try {
    await prisma.leaveRecord.update({
      where: { id, organizationId: orgId },
      data: { status },
    })

    await logAction({
      organizationId: orgId,
      userId,
      actionType: 'update_assignment',
      entityType: 'bulk',
      entityId: id,
      summary: `Leave request ${status}`,
    })

    revalidatePath('/leave')
    revalidatePath('/planning')
    return { ok: true }
  } catch (err) {
    console.error('updateLeaveStatusAction error:', err)
    return { ok: false, error: 'Kon status niet bijwerken.' }
  }
}

export async function deleteLeaveAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'Geen toegang.' }

  try {
    await prisma.leaveRecord.delete({
      where: { id, organizationId: orgId },
    })

    await logAction({
      organizationId: orgId,
      userId,
      actionType: 'delete_assignment',
      entityType: 'bulk',
      entityId: id,
      summary: `Leave/absence record deleted`,
    })

    revalidatePath('/leave')
    revalidatePath('/absence')
    revalidatePath('/planning')
    return { ok: true }
  } catch (err) {
    console.error('deleteLeaveAction error:', err)
    return { ok: false, error: 'Kon registratie niet verwijderen.' }
  }
}
