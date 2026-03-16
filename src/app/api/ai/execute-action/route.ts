import { NextResponse } from 'next/server'
import { getCurrentContext, canMutate } from '@/lib/auth/context'
import { prisma } from '@/lib/db/client'
import { logAction } from '@/lib/audit'
import { notifyOrgPlanners } from '@/lib/notify'
import { revalidatePath } from 'next/cache'
import { createAssignment, deleteAssignment } from '@/lib/queries/assignments'
import type { ActionProposal } from '../chat/route'

// ── Execute a confirmed action proposal ─────────────────────────────────────

export async function POST(req: Request) {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canMutate(role)) {
    return NextResponse.json({ ok: false, error: 'Geen toegang.' }, { status: 403 })
  }

  const { proposal } = (await req.json()) as { proposal: ActionProposal }
  if (!proposal?.type) {
    return NextResponse.json({ ok: false, error: 'Invalid proposal' }, { status: 400 })
  }

  try {
    switch (proposal.type) {
      // ── Create absence ────────────────────────────────────────────────────
      case 'create_absence': {
        const { employeeId, category, startDate, notes, employeeName } = proposal.data as {
          employeeId: string; category: string; startDate: string; notes: string | null; employeeName: string
        }

        // Check for existing active absence
        const existing = await prisma.leaveRecord.findFirst({
          where: { employeeId, type: 'absence', status: 'approved', endDate: { gte: startDate } },
        })
        if (existing) return NextResponse.json({ ok: false, error: `${employeeName} is al ziek gemeld.` })

        const record = await prisma.leaveRecord.create({
          data: {
            organizationId: orgId,
            employeeId,
            type: 'absence',
            category,
            startDate,
            endDate: '2099-12-31',
            status: 'approved',
            notes,
          },
        })

        await logAction({
          organizationId: orgId,
          userId,
          actionType: 'ai_action',
          entityType: 'bulk',
          entityId: record.id,
          summary: `AscentrAI: ${employeeName} ziek gemeld (${category}) vanaf ${startDate}`,
          afterData: { employeeId, category, startDate },
        })

        await notifyOrgPlanners({
          organizationId: orgId,
          type: 'understaffed',
          title: 'Verzuim gemeld via AscentrAI',
          message: `${employeeName} is afwezig gemeld (${category}) vanaf ${startDate}.`,
          severity: 'critical',
        })

        revalidatePath('/absence')
        revalidatePath('/planning')
        revalidatePath('/leave')
        return NextResponse.json({ ok: true, message: `${employeeName} is ziek gemeld.` })
      }

      // ── Create leave ──────────────────────────────────────────────────────
      case 'create_leave': {
        const { employeeId, category, startDate, endDate, notes, employeeName } = proposal.data as {
          employeeId: string; category: string; startDate: string; endDate: string; notes: string | null; employeeName: string
        }

        // Check for overlapping records
        const overlap = await prisma.leaveRecord.findFirst({
          where: {
            employeeId,
            status: { not: 'rejected' },
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        })
        if (overlap) return NextResponse.json({ ok: false, error: 'Overlappende registratie gevonden.' })

        const record = await prisma.leaveRecord.create({
          data: {
            organizationId: orgId,
            employeeId,
            type: 'leave',
            category,
            startDate,
            endDate,
            status: 'pending',
            notes,
          },
        })

        await logAction({
          organizationId: orgId,
          userId,
          actionType: 'ai_action',
          entityType: 'bulk',
          entityId: record.id,
          summary: `AscentrAI: Verlof aangevraagd voor ${employeeName} (${category}) ${startDate} t/m ${endDate}`,
          afterData: { employeeId, category, startDate, endDate },
        })

        await notifyOrgPlanners({
          organizationId: orgId,
          type: 'understaffed',
          title: 'Verlofaanvraag via AscentrAI',
          message: `${employeeName} heeft verlof aangevraagd (${category}) van ${startDate} t/m ${endDate}.`,
          severity: 'warning',
        })

        revalidatePath('/leave')
        revalidatePath('/planning')
        return NextResponse.json({ ok: true, message: `Verlof aangevraagd voor ${employeeName}.` })
      }

      // ── Recover absence ───────────────────────────────────────────────────
      case 'recover_absence': {
        const { leaveRecordId, employeeName, recoveryDate } = proposal.data as {
          leaveRecordId: string; employeeName: string; recoveryDate: string
        }

        await prisma.leaveRecord.update({
          where: { id: leaveRecordId, organizationId: orgId },
          data: { endDate: recoveryDate, status: 'recovered' },
        })

        await logAction({
          organizationId: orgId,
          userId,
          actionType: 'ai_action',
          entityType: 'bulk',
          entityId: leaveRecordId,
          summary: `AscentrAI: ${employeeName} hersteld gemeld op ${recoveryDate}`,
        })

        revalidatePath('/absence')
        revalidatePath('/planning')
        return NextResponse.json({ ok: true, message: `${employeeName} is hersteld gemeld.` })
      }

      // ── Assign employee ───────────────────────────────────────────────────
      case 'assign_employee': {
        const { employeeId, shiftTemplateId, date, notes, employeeName, shiftName } = proposal.data as {
          employeeId: string; shiftTemplateId: string; date: string; notes: string | null; employeeName: string; shiftName: string
        }

        const result = await createAssignment({
          organizationId: orgId,
          date,
          employeeId,
          shiftTemplateId,
          notes: notes ?? undefined,
        })
        if (!result.ok) return NextResponse.json({ ok: false, error: result.error })

        await logAction({
          organizationId: orgId,
          userId,
          actionType: 'ai_action',
          entityType: 'assignment',
          entityId: result.assignment.id,
          summary: `AscentrAI: ${employeeName} ingepland op ${shiftName} (${date})`,
          afterData: { employeeId, shiftTemplateId, date },
        })

        revalidatePath('/planning')
        return NextResponse.json({ ok: true, message: `${employeeName} is ingepland op ${shiftName}.` })
      }

      // ── Remove assignment ─────────────────────────────────────────────────
      case 'remove_assignment': {
        const { assignmentIds, employeeName, date, shifts } = proposal.data as {
          assignmentIds: string[]; employeeName: string; date: string; shifts: string[]
        }

        for (const id of assignmentIds) {
          await deleteAssignment(id)
        }

        await logAction({
          organizationId: orgId,
          userId,
          actionType: 'ai_action',
          entityType: 'assignment',
          entityId: assignmentIds[0],
          summary: `AscentrAI: ${employeeName} verwijderd van ${shifts.join(', ')} (${date})`,
          beforeData: { assignmentIds, date },
        })

        revalidatePath('/planning')
        return NextResponse.json({ ok: true, message: `${employeeName} is verwijderd van de planning op ${date}.` })
      }

      // ── Swap employees ────────────────────────────────────────────────────
      case 'swap_employees': {
        const { employee1Id, employee1Name, employee2Id, employee2Name, date, assignments1, assignments2 } = proposal.data as {
          employee1Id: string; employee1Name: string
          employee2Id: string; employee2Name: string
          date: string
          assignments1: { id: string; shiftTemplateId: string }[]
          assignments2: { id: string; shiftTemplateId: string }[]
        }

        // Swap: employee1 gets employee2's shifts and vice versa
        await prisma.$transaction(async (tx) => {
          // Update employee1's assignments to employee2
          for (const a of assignments1) {
            await tx.assignment.update({ where: { id: a.id }, data: { employeeId: employee2Id } })
          }
          // Update employee2's assignments to employee1
          for (const a of assignments2) {
            await tx.assignment.update({ where: { id: a.id }, data: { employeeId: employee1Id } })
          }
        })

        await logAction({
          organizationId: orgId,
          userId,
          actionType: 'ai_action',
          entityType: 'assignment',
          entityId: assignments1[0]?.id ?? assignments2[0]?.id ?? 'swap',
          summary: `AscentrAI: ${employee1Name} en ${employee2Name} gewisseld op ${date}`,
        })

        revalidatePath('/planning')
        return NextResponse.json({ ok: true, message: `${employee1Name} en ${employee2Name} zijn gewisseld.` })
      }

      // ── Move employee ─────────────────────────────────────────────────────
      case 'move_employee': {
        const { assignmentId, employeeName, targetShiftTemplateId, targetShiftName, targetDate, employeeId } = proposal.data as {
          assignmentId: string; employeeName: string; targetShiftTemplateId: string; targetShiftName: string; targetDate: string; employeeId: string
        }

        // Delete old assignment, create new one
        await deleteAssignment(assignmentId)
        const result = await createAssignment({
          organizationId: orgId,
          date: targetDate,
          employeeId,
          shiftTemplateId: targetShiftTemplateId,
        })
        if (!result.ok) return NextResponse.json({ ok: false, error: result.error })

        await logAction({
          organizationId: orgId,
          userId,
          actionType: 'ai_action',
          entityType: 'assignment',
          entityId: result.assignment.id,
          summary: `AscentrAI: ${employeeName} verplaatst naar ${targetShiftName} (${targetDate})`,
        })

        revalidatePath('/planning')
        return NextResponse.json({ ok: true, message: `${employeeName} is verplaatst naar ${targetShiftName}.` })
      }

      // ── Create temp request ──────────────────────────────────────────────
      case 'create_temp_request': {
        const { title, quantity, startDate, endDate, shiftTemplateId, urgency, description } = proposal.data as {
          title: string; quantity: number; startDate: string; endDate: string
          shiftTemplateId?: string; urgency?: string; description?: string
        }

        const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })

        const request = await prisma.tempRequest.create({
          data: {
            organizationId: orgId,
            requestedBy: userId,
            requestedByName: user?.name ?? 'AscentrAI',
            title,
            description: description ?? null,
            quantity: Math.max(1, quantity),
            shiftTemplateId: shiftTemplateId ?? null,
            startDate,
            endDate,
            urgency: urgency ?? 'medium',
            status: 'pending',
          },
        })

        await logAction({
          organizationId: orgId,
          userId,
          actionType: 'ai_action',
          entityType: 'bulk',
          entityId: request.id,
          summary: `AscentrAI: Temp aanvraag ingediend — ${title} (${quantity}x)`,
        })

        await notifyOrgPlanners({
          organizationId: orgId,
          type: 'understaffed',
          title: 'Temp aanvraag via AscentrAI',
          message: `${user?.name ?? 'AscentrAI'} heeft ${quantity} uitzendkracht(en) aangevraagd: ${title}`,
          severity: urgency === 'critical' ? 'critical' : 'warning',
        })

        revalidatePath('/workforce/temp-requests')
        return NextResponse.json({ ok: true, message: `Temp aanvraag ingediend: ${title}` })
      }

      default:
        return NextResponse.json({ ok: false, error: 'Onbekend actietype.' }, { status: 400 })
    }
  } catch (err) {
    console.error('execute-action error:', err)
    return NextResponse.json({ ok: false, error: 'Actie kon niet worden uitgevoerd.' }, { status: 500 })
  }
}
