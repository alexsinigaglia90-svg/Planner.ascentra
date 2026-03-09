import { prisma } from '@/lib/db/client'
import type { AuditLog } from '@prisma/client'

export type { AuditLog }

export interface AuditLogFilters {
  from?: string         // YYYY-MM-DD inclusive
  to?: string           // YYYY-MM-DD inclusive
  userId?: string
  actionType?: string
  entityType?: string
}

export async function getAuditLogs(
  organizationId: string,
  filters: AuditLogFilters = {},
  limit = 150,
): Promise<AuditLog[]> {
  const createdAt =
    filters.from || filters.to
      ? {
          ...(filters.from ? { gte: new Date(filters.from + 'T00:00:00.000Z') } : {}),
          ...(filters.to ? { lte: new Date(filters.to + 'T23:59:59.999Z') } : {}),
        }
      : undefined

  return prisma.auditLog.findMany({
    where: {
      organizationId,
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.actionType ? { actionType: filters.actionType } : {}),
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(createdAt ? { createdAt } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

export async function getAuditLogsByEntity(
  organizationId: string,
  entityType: string,
  entityId: string,
  limit = 20,
): Promise<AuditLog[]> {
  return prisma.auditLog.findMany({
    where: { organizationId, entityType, entityId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

/** Distinct user IDs that have performed actions — for the filter dropdown. */
export async function getAuditActors(organizationId: string): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    where: { organizationId },
    select: { userId: true },
    distinct: ['userId'],
    orderBy: { userId: 'asc' },
  })
  return rows.map((r) => r.userId)
}
