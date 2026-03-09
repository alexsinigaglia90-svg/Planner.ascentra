'use server'

import { getCurrentContext } from '@/lib/auth/context'
import { prisma } from '@/lib/db/client'
import { deliver } from '@/lib/email/service'
import type { DeliverOptions, TemplateData } from '@/lib/email/types'

export async function resendDeliveryAction(
  logId: string,
): Promise<{ error?: string; ok?: boolean }> {
  const ctx = await getCurrentContext()
  if (ctx.role !== 'admin') return { error: 'Unauthorized.' }

  if (typeof logId !== 'string' || logId.trim().length < 5) {
    return { error: 'Invalid record ID.' }
  }

  let log: {
    organizationId: string
    userId: string | null
    type: string
    recipient: string
    templateData: string
    status: string
  } | null = null

  try {
    log = await prisma.deliveryLog.findUnique({
      where: { id: logId },
      select: {
        organizationId: true,
        userId: true,
        type: true,
        recipient: true,
        templateData: true,
        status: true,
      },
    })
  } catch {
    return { error: 'Failed to load delivery record.' }
  }

  if (!log || log.organizationId !== ctx.orgId) {
    return { error: 'Record not found.' }
  }

  // Guard: only resend failed or simulated deliveries
  if (log.status !== 'failed' && log.status !== 'simulated') {
    return { error: 'Resend is only available for failed or simulated deliveries.' }
  }

  let data: TemplateData
  try {
    data = JSON.parse(log.templateData) as TemplateData
  } catch {
    return { error: 'Could not reconstruct email payload from stored data.' }
  }

  const opts: DeliverOptions = {
    organizationId: ctx.orgId,
    userId: log.userId ?? undefined,
    type: log.type as DeliverOptions['type'],
    recipient: log.recipient,
    data,
  }

  try {
    await deliver(opts)
  } catch {
    return { error: 'Resend failed. Check server logs for details.' }
  }

  return { ok: true }
}
