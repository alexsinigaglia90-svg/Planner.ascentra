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

// ---------------------------------------------------------------------------
// Shared where-clause builder
// ---------------------------------------------------------------------------

function buildWhere(organizationId: string, filters: AuditLogFilters = {}) {
  const createdAt =
    filters.from || filters.to
      ? {
          ...(filters.from ? { gte: new Date(filters.from + 'T00:00:00.000Z') } : {}),
          ...(filters.to ? { lte: new Date(filters.to + 'T23:59:59.999Z') } : {}),
        }
      : undefined

  return {
    organizationId,
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.actionType ? { actionType: filters.actionType } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(createdAt ? { createdAt } : {}),
  }
}

// ---------------------------------------------------------------------------
// Paginated audit logs
// ---------------------------------------------------------------------------

const PAGE_SIZE = 30

export interface PaginatedAuditLogs {
  logs: AuditLog[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function getAuditLogs(
  organizationId: string,
  filters: AuditLogFilters = {},
  page = 1,
): Promise<PaginatedAuditLogs> {
  const where = buildWhere(organizationId, filters)

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ])

  return {
    logs,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  }
}

// ---------------------------------------------------------------------------
// Entity-level history (unchanged)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Actors with names (join User table)
// ---------------------------------------------------------------------------

export interface AuditActor {
  id: string
  name: string
  email: string
}

export async function getAuditActors(organizationId: string): Promise<AuditActor[]> {
  const rows = await prisma.auditLog.findMany({
    where: { organizationId },
    select: { userId: true },
    distinct: ['userId'],
    orderBy: { userId: 'asc' },
  })

  const userIds = rows.map((r) => r.userId)
  if (userIds.length === 0) return []

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  })

  const userMap = new Map(users.map((u) => [u.id, u]))

  return userIds.map((id) => {
    const user = userMap.get(id)
    return {
      id,
      name: user?.name ?? 'Unknown',
      email: user?.email ?? id,
    }
  })
}

// ---------------------------------------------------------------------------
// Audit stats for the stats header
// ---------------------------------------------------------------------------

export interface AuditStats {
  totalToday: number
  totalThisWeek: number
  activeUsers: number
  topAction: { type: string; count: number } | null
  bulkOps: number
}

export async function getAuditStats(organizationId: string): Promise<AuditStats> {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Monday

  const [todayLogs, weekLogs] = await Promise.all([
    prisma.auditLog.findMany({
      where: { organizationId, createdAt: { gte: todayStart } },
      select: { actionType: true, entityType: true, userId: true },
    }),
    prisma.auditLog.findMany({
      where: { organizationId, createdAt: { gte: weekStart } },
      select: { actionType: true, entityType: true, userId: true },
    }),
  ])

  // Count action types this week
  const actionCounts = new Map<string, number>()
  for (const log of weekLogs) {
    actionCounts.set(log.actionType, (actionCounts.get(log.actionType) ?? 0) + 1)
  }
  let topAction: AuditStats['topAction'] = null
  for (const [type, count] of actionCounts) {
    if (!topAction || count > topAction.count) topAction = { type, count }
  }

  // Distinct users this week
  const activeUsers = new Set(weekLogs.map((l) => l.userId)).size

  // Bulk ops this week
  const bulkOps = weekLogs.filter((l) => l.entityType === 'bulk').length

  return {
    totalToday: todayLogs.length,
    totalThisWeek: weekLogs.length,
    activeUsers,
    topAction,
    bulkOps,
  }
}
