import { prisma } from '@/lib/db/client'

export interface DeliveryRow {
  id: string
  type: string
  recipient: string
  subject: string
  status: string
  errorMessage: string | null
  retryCount: number
  nextRetryAt: Date | null
  createdAt: Date
  sentAt: Date | null
  userId: string | null
}

export async function getDeliveryLogs(
  organizationId: string,
  limit = 200,
): Promise<DeliveryRow[]> {
  return prisma.deliveryLog.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      type: true,
      recipient: true,
      subject: true,
      status: true,
      errorMessage: true,
      retryCount: true,
      nextRetryAt: true,
      createdAt: true,
      sentAt: true,
      userId: true,
    },
  })
}

export async function getDeliveryStats(organizationId: string): Promise<{
  total: number
  sent: number
  simulated: number
  failed: number
  pending: number
}> {
  const rows = await prisma.deliveryLog.groupBy({
    by: ['status'],
    where: { organizationId },
    _count: { status: true },
  })

  const counts = Object.fromEntries(rows.map((r) => [r.status, r._count.status]))
  const total = rows.reduce((s, r) => s + r._count.status, 0)

  return {
    total,
    sent: counts['sent'] ?? 0,
    simulated: counts['simulated'] ?? 0,
    failed: counts['failed'] ?? 0,
    pending: counts['pending'] ?? 0,
  }
}
