'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { getCurrentContext, canMutate } from '@/lib/auth/context'

export async function markAdviceSeenAction(id: string): Promise<void> {
  const { orgId } = await getCurrentContext()
  await prisma.copilotAdvice.updateMany({
    where: { id, organizationId: orgId, status: 'active' },
    data: { status: 'seen', seenAt: new Date() },
  })
}

export async function acceptAdviceAction(id: string): Promise<{ ok: boolean }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false }
  await prisma.copilotAdvice.updateMany({
    where: { id, organizationId: orgId },
    data: { status: 'accepted', respondedAt: new Date() },
  })
  revalidatePath('/copilot')
  return { ok: true }
}

export async function declineAdviceAction(id: string): Promise<{ ok: boolean }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false }
  await prisma.copilotAdvice.updateMany({
    where: { id, organizationId: orgId },
    data: { status: 'declined', respondedAt: new Date() },
  })
  revalidatePath('/copilot')
  return { ok: true }
}

export async function completeAdviceAction(id: string, actualSavings?: number): Promise<{ ok: boolean }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false }
  await prisma.copilotAdvice.updateMany({
    where: { id, organizationId: orgId },
    data: { status: 'completed', completedAt: new Date(), actualSavings: actualSavings ?? null },
  })
  revalidatePath('/copilot')
  return { ok: true }
}
