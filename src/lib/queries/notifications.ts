/**
 * Notification query helpers — read and mark-read operations.
 *
 * All functions are scoped to (organizationId, userId) so data is never
 * cross-contaminated between users or organisations.
 */

import { prisma } from '@/lib/db/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationSeverity = 'info' | 'warning' | 'critical'
export type NotificationStatus   = 'unread' | 'read'

export type NotificationType =
  | 'understaffed'
  | 'no_skill_match'
  | 'over_hours'
  | 'user_invited'
  | 'password_reset'
  | 'account_activated'

export interface NotificationRow {
  id: string
  type: NotificationType
  title: string
  message: string
  status: NotificationStatus
  severity: NotificationSeverity
  createdAt: Date
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Returns recent notifications for a user, newest first. */
export async function getUserNotifications(
  organizationId: string,
  userId: string,
  limit = 40,
): Promise<NotificationRow[]> {
  const rows = await prisma.notification.findMany({
    where: { organizationId, userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      status: true,
      severity: true,
      createdAt: true,
    },
  })
  return rows as NotificationRow[]
}

/** Returns the count of unread notifications for a user. */
export async function getUnreadCount(
  organizationId: string,
  userId: string,
): Promise<number> {
  return prisma.notification.count({
    where: { organizationId, userId, status: 'unread' },
  })
}

/** Marks a single notification as read (no-op if already read or wrong user). */
export async function markNotificationRead(
  id: string,
  organizationId: string,
  userId: string,
): Promise<void> {
  await prisma.notification.updateMany({
    where: { id, organizationId, userId },
    data: { status: 'read' },
  })
}

/** Marks all unread notifications for a user as read. */
export async function markAllRead(
  organizationId: string,
  userId: string,
): Promise<void> {
  await prisma.notification.updateMany({
    where: { organizationId, userId, status: 'unread' },
    data: { status: 'read' },
  })
}
