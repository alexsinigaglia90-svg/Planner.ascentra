/**
 * Notification creation helpers.
 *
 * All functions are non-throwing — notification failures must never block
 * the main mutation that triggered them.
 */

import { prisma } from '@/lib/db/client'
import type { NotificationType, NotificationSeverity } from '@/lib/queries/notifications'

// ─── Primitives ───────────────────────────────────────────────────────────────

interface NotifyParams {
  organizationId: string
  userId: string
  type: NotificationType
  title: string
  message: string
  severity?: NotificationSeverity
}

/** Creates a notification for a single user. */
export async function notify(params: NotifyParams): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        severity: params.severity ?? 'info',
      },
    })
  } catch (err) {
    console.error('[notify] Failed to create notification:', err)
  }
}

interface NotifyOrgParams {
  organizationId: string
  type: NotificationType
  title: string
  message: string
  severity?: NotificationSeverity
}

/**
 * Creates a notification for every admin and planner in an organization.
 * Used for operational alerts (understaffed, no_skill_match, over_hours).
 */
export async function notifyOrgPlanners(params: NotifyOrgParams): Promise<void> {
  try {
    const members = await prisma.organizationMembership.findMany({
      where: {
        organizationId: params.organizationId,
        role: { in: ['admin', 'planner'] },
      },
      select: { userId: true },
    })
    if (members.length === 0) return
    await Promise.all(
      members.map((m) =>
        prisma.notification.create({
          data: {
            organizationId: params.organizationId,
            userId: m.userId,
            type: params.type,
            title: params.title,
            message: params.message,
            severity: params.severity ?? 'info',
          },
        }),
      ),
    )
  } catch (err) {
    console.error('[notifyOrgPlanners] Failed to create notifications:', err)
  }
}

// ─── Over-hours check ─────────────────────────────────────────────────────────

/** Returns shift duration in minutes, handling overnight shifts. */
function shiftDurationMins(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const s = sh * 60 + sm
  let e = eh * 60 + em
  if (e <= s) e += 1440 // overnight
  return e - s
}

/** Returns the ISO dates of Monday and Sunday of the week containing `date`. */
function isoWeekBounds(date: string): { weekStart: string; weekEnd: string } {
  const d = new Date(date + 'T00:00:00')
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
  }
}

/**
 * Checks whether an employee exceeds their weekly contract hours after an
 * assignment on `date` and notifies all org planners/admins if so.
 *
 * Non-throwing — safe to fire-and-forget after any assignment creation.
 */
export async function notifyOverHours(params: {
  organizationId: string
  employeeId: string
  date: string
}): Promise<void> {
  try {
    const { weekStart, weekEnd } = isoWeekBounds(params.date)

    const emp = await prisma.employee.findUnique({
      where: { id: params.employeeId },
      select: {
        name: true,
        contractHours: true,
        assignments: {
          where: {
            rosterDay: {
              organizationId: params.organizationId,
              date: { gte: weekStart, lte: weekEnd },
            },
          },
          select: {
            shiftTemplate: { select: { startTime: true, endTime: true } },
          },
        },
      },
    })

    if (!emp || emp.contractHours <= 0) return

    const totalMins = emp.assignments.reduce(
      (sum, a) => sum + shiftDurationMins(a.shiftTemplate.startTime, a.shiftTemplate.endTime),
      0,
    )

    if (totalMins <= emp.contractHours * 60) return

    const plannedH = Math.round(totalMins / 6) / 10 // 1 dp
    await notifyOrgPlanners({
      organizationId: params.organizationId,
      type: 'over_hours',
      title: 'Employee over contract hours',
      message: `${emp.name} is scheduled for ${plannedH}h this week (contract: ${emp.contractHours}h).`,
      severity: 'warning',
    })
  } catch (err) {
    console.error('[notifyOverHours] Check failed:', err)
  }
}
