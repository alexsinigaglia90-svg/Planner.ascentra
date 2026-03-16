'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { getCurrentContext, canMutate, canApprove } from '@/lib/auth/context'
import { logAction } from '@/lib/audit'
import { notifyOrgPlanners } from '@/lib/notify'

// ── Types ───────────────────────────────────────────────────────────────────

export type TempRequestStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'sent_to_agency' | 'confirmed'
export type Urgency = 'low' | 'medium' | 'high' | 'critical'

export interface TempRequestRow {
  id: string
  title: string
  description: string | null
  quantity: number
  shiftName: string | null
  shiftTime: string | null
  departmentName: string | null
  startDate: string
  endDate: string
  urgency: string
  status: string
  requestedByName: string
  approvedByName: string | null
  approvedAt: string | null
  rejectionReason: string | null
  agencyName: string | null
  agencyEmail: string | null
  sentToAgencyAt: string | null
  confirmedAt: string | null
  notes: string | null
  createdAt: string
}

// ── Queries ─────────────────────────────────────────────────────────────────

export async function getTempRequests(): Promise<TempRequestRow[]> {
  const { orgId } = await getCurrentContext()
  const requests = await prisma.tempRequest.findMany({
    where: { organizationId: orgId },
    include: {
      shiftTemplate: { select: { name: true, startTime: true, endTime: true } },
      department: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return requests.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    quantity: r.quantity,
    shiftName: r.shiftTemplate?.name ?? null,
    shiftTime: r.shiftTemplate ? `${r.shiftTemplate.startTime}-${r.shiftTemplate.endTime}` : null,
    departmentName: r.department?.name ?? null,
    startDate: r.startDate,
    endDate: r.endDate,
    urgency: r.urgency,
    status: r.status,
    requestedByName: r.requestedByName,
    approvedByName: r.approvedByName,
    approvedAt: r.approvedAt?.toISOString() ?? null,
    rejectionReason: r.rejectionReason,
    agencyName: r.agencyName,
    agencyEmail: r.agencyEmail,
    sentToAgencyAt: r.sentToAgencyAt?.toISOString() ?? null,
    confirmedAt: r.confirmedAt?.toISOString() ?? null,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function getTempRequestCounts(): Promise<{ pending: number; approved: number; total: number }> {
  const { orgId } = await getCurrentContext()
  const [pending, approved, total] = await Promise.all([
    prisma.tempRequest.count({ where: { organizationId: orgId, status: 'pending' } }),
    prisma.tempRequest.count({ where: { organizationId: orgId, status: 'approved' } }),
    prisma.tempRequest.count({ where: { organizationId: orgId } }),
  ])
  return { pending, approved, total }
}

// ── Create ──────────────────────────────────────────────────────────────────

export async function createTempRequestAction(input: {
  title: string
  description?: string
  quantity: number
  shiftTemplateId?: string
  departmentId?: string
  startDate: string
  endDate: string
  urgency: string
  notes?: string
  submitImmediately?: boolean
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'Geen toegang.' }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    const status = input.submitImmediately ? 'pending' : 'draft'

    const request = await prisma.tempRequest.create({
      data: {
        organizationId: orgId,
        requestedBy: userId,
        requestedByName: user?.name ?? 'Onbekend',
        title: input.title.trim(),
        description: input.description?.trim() || null,
        quantity: Math.max(1, input.quantity),
        shiftTemplateId: input.shiftTemplateId || null,
        departmentId: input.departmentId || null,
        startDate: input.startDate,
        endDate: input.endDate,
        urgency: input.urgency,
        status,
        notes: input.notes?.trim() || null,
      },
    })

    await logAction({
      organizationId: orgId,
      userId,
      actionType: 'ai_action',
      entityType: 'bulk',
      entityId: request.id,
      summary: `Temp aanvraag aangemaakt: ${input.title} (${input.quantity}x)`,
      afterData: { ...input, status },
    })

    if (status === 'pending') {
      await notifyOrgPlanners({
        organizationId: orgId,
        type: 'understaffed',
        title: 'Nieuwe temp aanvraag',
        message: `${user?.name ?? 'Iemand'} heeft ${input.quantity} uitzendkracht(en) aangevraagd: ${input.title}`,
        severity: input.urgency === 'critical' ? 'critical' : 'warning',
      })
    }

    revalidatePath('/workforce/temp-requests')
    return { ok: true, id: request.id }
  } catch (err) {
    console.error('createTempRequestAction error:', err)
    return { ok: false, error: 'Kon aanvraag niet aanmaken.' }
  }
}

// ── Submit (draft → pending) ────────────────────────────────────────────────

export async function submitTempRequestAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'Geen toegang.' }

  try {
    const request = await prisma.tempRequest.findFirst({
      where: { id, organizationId: orgId, status: 'draft' },
    })
    if (!request) return { ok: false, error: 'Aanvraag niet gevonden of niet in concept.' }

    await prisma.tempRequest.update({
      where: { id },
      data: { status: 'pending' },
    })

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    await notifyOrgPlanners({
      organizationId: orgId,
      type: 'understaffed',
      title: 'Nieuwe temp aanvraag',
      message: `${user?.name ?? 'Iemand'} heeft ${request.quantity} uitzendkracht(en) aangevraagd: ${request.title}`,
      severity: request.urgency === 'critical' ? 'critical' : 'warning',
    })

    revalidatePath('/workforce/temp-requests')
    return { ok: true }
  } catch (err) {
    console.error('submitTempRequestAction error:', err)
    return { ok: false, error: 'Kon aanvraag niet indienen.' }
  }
}

// ── Approve ─────────────────────────────────────────────────────────────────

export async function approveTempRequestAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canApprove(role)) return { ok: false, error: 'Alleen managers en admins mogen aanvragen goedkeuren.' }

  try {
    const request = await prisma.tempRequest.findFirst({
      where: { id, organizationId: orgId, status: 'pending' },
    })
    if (!request) return { ok: false, error: 'Aanvraag niet gevonden of niet in afwachting.' }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })

    await prisma.tempRequest.update({
      where: { id },
      data: {
        status: 'approved',
        approvedBy: userId,
        approvedByName: user?.name ?? 'Onbekend',
        approvedAt: new Date(),
      },
    })

    await logAction({
      organizationId: orgId,
      userId,
      actionType: 'ai_action',
      entityType: 'bulk',
      entityId: id,
      summary: `Temp aanvraag goedgekeurd: ${request.title}`,
    })

    await notifyOrgPlanners({
      organizationId: orgId,
      type: 'understaffed',
      title: 'Temp aanvraag goedgekeurd',
      message: `${user?.name} heeft de aanvraag "${request.title}" goedgekeurd.`,
      severity: 'info',
    })

    revalidatePath('/workforce/temp-requests')
    return { ok: true }
  } catch (err) {
    console.error('approveTempRequestAction error:', err)
    return { ok: false, error: 'Kon aanvraag niet goedkeuren.' }
  }
}

// ── Reject ──────────────────────────────────────────────────────────────────

export async function rejectTempRequestAction(
  id: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canApprove(role)) return { ok: false, error: 'Alleen managers en admins mogen aanvragen afwijzen.' }

  try {
    const request = await prisma.tempRequest.findFirst({
      where: { id, organizationId: orgId, status: 'pending' },
    })
    if (!request) return { ok: false, error: 'Aanvraag niet gevonden.' }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })

    await prisma.tempRequest.update({
      where: { id },
      data: {
        status: 'rejected',
        approvedBy: userId,
        approvedByName: user?.name ?? 'Onbekend',
        approvedAt: new Date(),
        rejectionReason: reason.trim(),
      },
    })

    await logAction({
      organizationId: orgId,
      userId,
      actionType: 'ai_action',
      entityType: 'bulk',
      entityId: id,
      summary: `Temp aanvraag afgewezen: ${request.title} — ${reason}`,
    })

    revalidatePath('/workforce/temp-requests')
    return { ok: true }
  } catch (err) {
    console.error('rejectTempRequestAction error:', err)
    return { ok: false, error: 'Kon aanvraag niet afwijzen.' }
  }
}

// ── Send to agency ──────────────────────────────────────────────────────────

export async function sendToAgencyAction(
  id: string,
  agencyName: string,
  agencyEmail: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canApprove(role)) return { ok: false, error: 'Geen toegang.' }

  try {
    const request = await prisma.tempRequest.findFirst({
      where: { id, organizationId: orgId, status: 'approved' },
      include: { shiftTemplate: { select: { name: true, startTime: true, endTime: true } }, department: { select: { name: true } } },
    })
    if (!request) return { ok: false, error: 'Aanvraag niet gevonden of niet goedgekeurd.' }

    await prisma.tempRequest.update({
      where: { id },
      data: {
        status: 'sent_to_agency',
        agencyName: agencyName.trim(),
        agencyEmail: agencyEmail.trim(),
        sentToAgencyAt: new Date(),
      },
    })

    await logAction({
      organizationId: orgId,
      userId,
      actionType: 'ai_action',
      entityType: 'bulk',
      entityId: id,
      summary: `Temp aanvraag verstuurd naar ${agencyName} (${agencyEmail})`,
    })

    // TODO: actual email sending via deliver() when SMTP is configured
    // For now just update status

    revalidatePath('/workforce/temp-requests')
    return { ok: true }
  } catch (err) {
    console.error('sendToAgencyAction error:', err)
    return { ok: false, error: 'Kon niet versturen naar uitzendbureau.' }
  }
}

// ── Confirm (agency confirmed temps) ────────────────────────────────────────

export async function confirmTempRequestAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canApprove(role)) return { ok: false, error: 'Geen toegang.' }

  try {
    await prisma.tempRequest.update({
      where: { id, organizationId: orgId },
      data: { status: 'confirmed', confirmedAt: new Date() },
    })

    await logAction({
      organizationId: orgId,
      userId,
      actionType: 'ai_action',
      entityType: 'bulk',
      entityId: id,
      summary: 'Temp aanvraag bevestigd — uitzendkrachten beschikbaar',
    })

    revalidatePath('/workforce/temp-requests')
    return { ok: true }
  } catch (err) {
    console.error('confirmTempRequestAction error:', err)
    return { ok: false, error: 'Kon bevestiging niet opslaan.' }
  }
}
