import { prisma } from '@/lib/db/client'

export interface LeaveRecordRow {
  id: string
  employeeId: string
  employeeName: string
  employeeType: string
  type: 'leave' | 'absence'
  category: string
  startDate: string
  endDate: string
  status: string
  notes: string | null
  createdAt: Date
}

/** Get all leave/absence records for an organization, optionally filtered by type. */
export async function getLeaveRecords(
  organizationId: string,
  type?: 'leave' | 'absence',
): Promise<LeaveRecordRow[]> {
  const records = await prisma.leaveRecord.findMany({
    where: {
      organizationId,
      ...(type ? { type } : {}),
    },
    include: {
      employee: { select: { name: true, employeeType: true } },
    },
    orderBy: { startDate: 'desc' },
  })

  return records.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    employeeName: r.employee.name,
    employeeType: r.employee.employeeType,
    type: r.type as 'leave' | 'absence',
    category: r.category,
    startDate: r.startDate,
    endDate: r.endDate,
    status: r.status,
    notes: r.notes,
    createdAt: r.createdAt,
  }))
}

/** Get employee IDs that are on leave or absent on a specific date. */
export async function getUnavailableEmployeeIds(
  organizationId: string,
  date: string,
): Promise<Set<string>> {
  const records = await prisma.leaveRecord.findMany({
    where: {
      organizationId,
      status: { in: ['approved', 'pending'] },
      startDate: { lte: date },
      endDate: { gte: date },
    },
    select: { employeeId: true },
  })
  return new Set(records.map((r) => r.employeeId))
}

/** Get all dates an employee is unavailable within a date range. */
export async function getEmployeeUnavailableDates(
  organizationId: string,
  employeeId: string,
  startDate: string,
  endDate: string,
): Promise<Set<string>> {
  const records = await prisma.leaveRecord.findMany({
    where: {
      organizationId,
      employeeId,
      status: { in: ['approved', 'pending'] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { startDate: true, endDate: true },
  })

  const unavailable = new Set<string>()
  for (const r of records) {
    const start = new Date(r.startDate + 'T00:00:00')
    const end = new Date(r.endDate + 'T00:00:00')
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (iso >= startDate && iso <= endDate) {
        unavailable.add(iso)
      }
    }
  }
  return unavailable
}
