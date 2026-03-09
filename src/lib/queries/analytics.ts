/**
 * Analytics DB queries — fetches only what's needed for reporting.
 * Keeps round-trips minimal via Promise.all batching.
 *
 * Returns lightweight shapes designed to work directly with `computeMetrics`
 * from `@/lib/analytics`, without requiring full Prisma relation objects.
 */

import { prisma } from '@/lib/db/client'
import type { ShiftTemplate } from '@prisma/client'

export interface AnalyticsEmployee {
  id: string
  name: string
  employeeType: string
  status: string
}

export interface AnalyticsAssignment {
  rosterDay: { date: string }
  shiftTemplateId: string
  employeeId: string
}

export interface AnalyticsSnapshot {
  activeEmployees: number
  internalEmployees: number
  tempEmployees: number
  totalTemplates: number
  templates: ShiftTemplate[]
  employees: AnalyticsEmployee[]
  assignments: AnalyticsAssignment[]
  startDate: string
  endDate: string
}

/**
 * Fetch all data needed for analytics within a given date range.
 * Employee counts are global (not date-filtered); assignments are date-filtered.
 */
export async function getAnalyticsSnapshot(
  organizationId: string,
  startDate: string,
  endDate: string,
): Promise<AnalyticsSnapshot> {
  const [
    activeEmployees,
    internalEmployees,
    tempEmployees,
    totalTemplates,
    templates,
    employees,
    rawAssignments,
  ] = await Promise.all([
    prisma.employee.count({ where: { organizationId, status: 'active' } }),
    prisma.employee.count({ where: { organizationId, status: 'active', employeeType: 'internal' } }),
    prisma.employee.count({ where: { organizationId, status: 'active', employeeType: 'temp' } }),
    prisma.shiftTemplate.count({ where: { organizationId } }),
    prisma.shiftTemplate.findMany({ where: { organizationId }, orderBy: { name: 'asc' } }),
    prisma.employee.findMany({
      where: { organizationId, status: 'active' },
      select: { id: true, name: true, employeeType: true, status: true },
      orderBy: { name: 'asc' },
    }),
    prisma.assignment.findMany({
      where: { organizationId, rosterDay: { date: { gte: startDate, lte: endDate } } },
      select: {
        employeeId: true,
        shiftTemplateId: true,
        rosterDay: { select: { date: true } },
      },
    }),
  ])

  return {
    activeEmployees,
    internalEmployees,
    tempEmployees,
    totalTemplates,
    templates,
    employees,
    assignments: rawAssignments,
    startDate,
    endDate,
  }
}
