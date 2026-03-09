import { prisma } from '@/lib/db/client'
import type { Assignment, RosterDay, ShiftTemplate, Employee } from '@prisma/client'

// ---------------------------------------------------------------------------
// Date helpers (local-time safe, no timezone off-by-one)
// ---------------------------------------------------------------------------

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dayOffset(fromStr: string, toStr: string): number {
  const from = new Date(fromStr + 'T00:00:00')
  const to = new Date(toStr + 'T00:00:00')
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

export type AssignmentWithRelations = Assignment & {
  rosterDay: RosterDay
  shiftTemplate: ShiftTemplate
  employee: Employee
}

export async function getAssignmentById(id: string): Promise<AssignmentWithRelations | null> {
  return prisma.assignment.findUnique({
    where: { id },
    include: { rosterDay: true, shiftTemplate: true, employee: true },
  })
}

export async function getAssignments(organizationId: string): Promise<AssignmentWithRelations[]> {
  return prisma.assignment.findMany({
    where: { organizationId },
    include: {
      rosterDay: true,
      shiftTemplate: true,
      employee: true,
    },
    orderBy: [
      { rosterDay: { date: 'desc' } },
      { shiftTemplate: { startTime: 'asc' } },
    ],
  })
}

export async function createAssignment(data: {
  organizationId: string
  date: string
  employeeId: string
  shiftTemplateId: string
  notes?: string
}): Promise<{ ok: true; assignment: Assignment } | { ok: false; error: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const rosterDay = await tx.rosterDay.upsert({
        where: { organizationId_date: { organizationId: data.organizationId, date: data.date } },
        update: {},
        create: { organizationId: data.organizationId, date: data.date },
      })

      const existing = await tx.assignment.findUnique({
        where: {
          rosterDayId_shiftTemplateId_employeeId: {
            rosterDayId: rosterDay.id,
            shiftTemplateId: data.shiftTemplateId,
            employeeId: data.employeeId,
          },
        },
      })

      if (existing) {
        return { ok: false, error: 'This shift is already assigned to this employee on this day.' }
      }

      const assignment = await tx.assignment.create({
        data: {
          organizationId: data.organizationId,
          rosterDayId: rosterDay.id,
          employeeId: data.employeeId,
          shiftTemplateId: data.shiftTemplateId,
          notes: data.notes ?? null,
        },
      })

      return { ok: true, assignment }
    })
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code === 'P2002') return { ok: false, error: 'This shift is already assigned to this employee on this day.' }
    if (code === 'P2003') return { ok: false, error: 'Employee or shift template not found.' }
    console.error('createAssignment error:', err)
    return { ok: false, error: 'Could not create assignment. Please try again.' }
  }
}

export async function copyRosterDay(
  sourceDate: string,
  targetDate: string,
  organizationId: string,
): Promise<void> {
  const sourceDay = await prisma.rosterDay.findUnique({
    where: { organizationId_date: { organizationId, date: sourceDate } },
    include: { assignments: true },
  })
  if (!sourceDay || sourceDay.assignments.length === 0) return

  const targetDay = await prisma.rosterDay.upsert({
    where: { organizationId_date: { organizationId, date: targetDate } },
    update: {},
    create: { organizationId, date: targetDate },
  })

  // Fetch existing assignments on target day to avoid unique constraint violations
  // (SQLite does not support skipDuplicates in createMany)
  const existing = await prisma.assignment.findMany({
    where: { rosterDayId: targetDay.id },
    select: { employeeId: true, shiftTemplateId: true },
  })
  const existingKeys = new Set(existing.map((a) => `${a.employeeId}:${a.shiftTemplateId}`))

  for (const a of sourceDay.assignments) {
    if (existingKeys.has(`${a.employeeId}:${a.shiftTemplateId}`)) continue
    await prisma.assignment.create({
      data: {
        organizationId,
        rosterDayId: targetDay.id,
        employeeId: a.employeeId,
        shiftTemplateId: a.shiftTemplateId,
        notes: a.notes,
      },
    })
  }
}

// ---------------------------------------------------------------------------
// Delete a single assignment
// ---------------------------------------------------------------------------

export async function deleteAssignment(id: string): Promise<void> {
  await prisma.assignment.delete({ where: { id } })
}

// ---------------------------------------------------------------------------
// Update shift template and/or notes on an existing assignment
// ---------------------------------------------------------------------------

export async function updateAssignment(data: {
  assignmentId: string
  shiftTemplateId: string
  notes?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { assignmentId, shiftTemplateId, notes } = data

  try {
    return await prisma.$transaction(async (tx) => {
      const original = await tx.assignment.findUnique({ where: { id: assignmentId } })
      if (!original) return { ok: false, error: 'Assignment not found.' }

      // Guard against duplicate only when the template is actually changing
      if (original.shiftTemplateId !== shiftTemplateId) {
        const conflict = await tx.assignment.findFirst({
          where: {
            rosterDayId: original.rosterDayId,
            shiftTemplateId,
            employeeId: original.employeeId,
          },
        })
        if (conflict) {
          return { ok: false, error: 'This employee already has that shift on this day.' }
        }
      }

      await tx.assignment.update({
        where: { id: assignmentId },
        data: { shiftTemplateId, notes: notes ?? null },
      })

      return { ok: true }
    })
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code === 'P2002') return { ok: false, error: 'This shift-slot is already taken.' }
    console.error('updateAssignment error:', err)
    return { ok: false, error: 'Update failed. Please try again.' }
  }
}

/**
 * Copy an assignment to a different employee and/or date, preserving shiftTemplate + notes.
 * The original assignment stays in place.
 * Returns `{ ok: false, error }` for any known failure - never throws.
 */
export async function copyAssignmentToSlot(data: {
  assignmentId: string
  targetDate: string
  targetEmployeeId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { assignmentId, targetDate, targetEmployeeId } = data

  try {
    return await prisma.$transaction(async (tx) => {
      const original = await tx.assignment.findUnique({ where: { id: assignmentId } })
      if (!original) return { ok: false, error: 'Assignment not found.' }

      const targetRosterDay = await tx.rosterDay.upsert({
        where: { organizationId_date: { organizationId: original.organizationId, date: targetDate } },
        update: {},
        create: { organizationId: original.organizationId, date: targetDate },
      })

      const conflict = await tx.assignment.findFirst({
        where: {
          rosterDayId: targetRosterDay.id,
          shiftTemplateId: original.shiftTemplateId,
          employeeId: targetEmployeeId,
        },
      })
      if (conflict) {
        return {
          ok: false,
          error: `${targetDate} already has this shift assigned to that employee.`,
        }
      }

      await tx.assignment.create({
        data: {
          organizationId: original.organizationId,
          rosterDayId: targetRosterDay.id,
          employeeId: targetEmployeeId,
          shiftTemplateId: original.shiftTemplateId,
          notes: original.notes,
        },
      })

      return { ok: true }
    })
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code === 'P2002') return { ok: false, error: 'This shift-slot is already taken.' }
    console.error('copyAssignmentToSlot error:', err)
    return { ok: false, error: 'Copy failed. Please try again.' }
  }
}

/**
 * Move an assignment to a different employee and/or date.
 * Runs inside a transaction so RosterDay upsert and Assignment update are atomic.
 * Returns `{ ok: false, error }` for any known failure - never throws.
 */
export async function moveAssignment(data: {
  assignmentId: string
  targetDate: string
  targetEmployeeId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { assignmentId, targetDate, targetEmployeeId } = data

  try {
    return await prisma.$transaction(async (tx) => {
      const original = await tx.assignment.findUnique({ where: { id: assignmentId } })
      if (!original) return { ok: false, error: 'Assignment not found.' }

      // Dropping onto the same cell is a no-op
      const isSameEmployee = original.employeeId === targetEmployeeId
      const originalDate = await tx.rosterDay.findUnique({ where: { id: original.rosterDayId } })
      const isSameDate = originalDate?.date === targetDate
      if (isSameEmployee && isSameDate) return { ok: true }

      const targetRosterDay = await tx.rosterDay.upsert({
        where: { organizationId_date: { organizationId: original.organizationId, date: targetDate } },
        update: {},
        create: { organizationId: original.organizationId, date: targetDate },
      })

      const conflict = await tx.assignment.findFirst({
        where: {
          rosterDayId: targetRosterDay.id,
          shiftTemplateId: original.shiftTemplateId,
          employeeId: targetEmployeeId,
        },
      })
      if (conflict) {
        return {
          ok: false,
          error: `${targetDate} already has this shift assigned to that employee.`,
        }
      }

      await tx.assignment.update({
        where: { id: assignmentId },
        data: {
          rosterDayId: targetRosterDay.id,
          employeeId: targetEmployeeId,
        },
      })

      return { ok: true }
    })
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code === 'P2002') return { ok: false, error: 'This shift-slot is already taken.' }
    if (code === 'P2003') return { ok: false, error: 'Reference error - please reload and try again.' }
    console.error('moveAssignment error:', err)
    return { ok: false, error: 'Move failed. Please try again.' }
  }
}

// ---------------------------------------------------------------------------
// Bulk: copy one employee's schedule for a specific week to another week
// ---------------------------------------------------------------------------

export async function copyEmployeeWeek(data: {
  organizationId: string
  employeeId: string
  sourceWeekStart: string
  targetWeekStart: string
}): Promise<{ count: number }> {
  const sourceEnd = addDays(data.sourceWeekStart, 6)
  const offset = dayOffset(data.sourceWeekStart, data.targetWeekStart)

  const sourceAssignments = await prisma.assignment.findMany({
    where: {
      organizationId: data.organizationId,
      employeeId: data.employeeId,
      rosterDay: { date: { gte: data.sourceWeekStart, lte: sourceEnd } },
    },
    include: { rosterDay: true },
  })
  if (sourceAssignments.length === 0) return { count: 0 }

  const targetStart = addDays(data.sourceWeekStart, offset)
  const targetEnd = addDays(sourceEnd, offset)
  const existingTarget = await prisma.assignment.findMany({
    where: {
      organizationId: data.organizationId,
      employeeId: data.employeeId,
      rosterDay: { date: { gte: targetStart, lte: targetEnd } },
    },
    include: { rosterDay: true },
  })
  const existingKeys = new Set(
    existingTarget.map((a) => `${a.rosterDay.date}:${a.shiftTemplateId}`)
  )

  let count = 0
  for (const a of sourceAssignments) {
    const targetDate = addDays(a.rosterDay.date, offset)
    const key = `${targetDate}:${a.shiftTemplateId}`
    if (existingKeys.has(key)) continue

    const rosterDay = await prisma.rosterDay.upsert({
      where: { organizationId_date: { organizationId: data.organizationId, date: targetDate } },
      update: {},
      create: { organizationId: data.organizationId, date: targetDate },
    })
    await prisma.assignment.create({
      data: {
        organizationId: data.organizationId,
        rosterDayId: rosterDay.id,
        employeeId: data.employeeId,
        shiftTemplateId: a.shiftTemplateId,
        notes: a.notes,
      },
    })
    existingKeys.add(key)
    count++
  }
  return { count }
}

// ---------------------------------------------------------------------------
// Bulk: copy one employee's schedule to another within a date range
// ---------------------------------------------------------------------------

export async function copyEmployeeSchedule(data: {
  organizationId: string
  sourceEmployeeId: string
  targetEmployeeId: string
  startDate: string
  endDate: string
}): Promise<{ count: number }> {
  const sourceAssignments = await prisma.assignment.findMany({
    where: {
      organizationId: data.organizationId,
      employeeId: data.sourceEmployeeId,
      rosterDay: { date: { gte: data.startDate, lte: data.endDate } },
    },
    include: { rosterDay: true },
  })

  // Batch-fetch existing target assignments to minimise round-trips
  const targetDates = [...new Set(sourceAssignments.map((a) => a.rosterDay.date))]
  const existingTarget = await prisma.assignment.findMany({
    where: {
      organizationId: data.organizationId,
      employeeId: data.targetEmployeeId,
      rosterDay: { date: { in: targetDates } },
    },
    include: { rosterDay: true },
  })
  const existingKeys = new Set(
    existingTarget.map((a) => `${a.rosterDay.date}:${a.shiftTemplateId}`)
  )

  let count = 0
  for (const a of sourceAssignments) {
    const key = `${a.rosterDay.date}:${a.shiftTemplateId}`
    if (existingKeys.has(key)) continue

    const targetDay = await prisma.rosterDay.upsert({
      where: { organizationId_date: { organizationId: data.organizationId, date: a.rosterDay.date } },
      update: {},
      create: { organizationId: data.organizationId, date: a.rosterDay.date },
    })

    await prisma.assignment.create({
      data: {
        organizationId: data.organizationId,
        rosterDayId: targetDay.id,
        employeeId: data.targetEmployeeId,
        shiftTemplateId: a.shiftTemplateId,
        notes: a.notes,
      },
    })
    existingKeys.add(key)
    count++
  }

  return { count }
}

// ---------------------------------------------------------------------------
// Bulk: copy a week's assignments to another week (shift by date offset)
// ---------------------------------------------------------------------------

export async function copyWeekSchedule(data: {
  organizationId: string
  sourceWeekStart: string
  targetWeekStart: string
}): Promise<{ count: number }> {
  const offset = dayOffset(data.sourceWeekStart, data.targetWeekStart)
  const sourceWeekEnd = addDays(data.sourceWeekStart, 6)

  const sourceAssignments = await prisma.assignment.findMany({
    where: {
      organizationId: data.organizationId,
      rosterDay: { date: { gte: data.sourceWeekStart, lte: sourceWeekEnd } },
    },
    include: { rosterDay: true },
  })

  const targetWeekStart = data.targetWeekStart
  const targetWeekEnd = addDays(targetWeekStart, 6)
  const existingTarget = await prisma.assignment.findMany({
    where: {
      organizationId: data.organizationId,
      rosterDay: { date: { gte: targetWeekStart, lte: targetWeekEnd } },
    },
    include: { rosterDay: true },
  })
  const existingKeys = new Set(
    existingTarget.map((a) => `${a.rosterDay.date}:${a.employeeId}:${a.shiftTemplateId}`)
  )

  let count = 0
  for (const a of sourceAssignments) {
    const targetDate = addDays(a.rosterDay.date, offset)
    const key = `${targetDate}:${a.employeeId}:${a.shiftTemplateId}`
    if (existingKeys.has(key)) continue

    const targetDay = await prisma.rosterDay.upsert({
      where: { organizationId_date: { organizationId: data.organizationId, date: targetDate } },
      update: {},
      create: { organizationId: data.organizationId, date: targetDate },
    })

    await prisma.assignment.create({
      data: {
        organizationId: data.organizationId,
        rosterDayId: targetDay.id,
        employeeId: a.employeeId,
        shiftTemplateId: a.shiftTemplateId,
        notes: a.notes,
      },
    })
    existingKeys.add(key)
    count++
  }

  return { count }
}

// ---------------------------------------------------------------------------
// Bulk: repeat a date range's schedule forward N weeks
// ---------------------------------------------------------------------------

export async function repeatPattern(data: {
  organizationId: string
  startDate: string
  endDate: string
  weeks: number
}): Promise<{ count: number }> {
  const sourceAssignments = await prisma.assignment.findMany({
    where: {
      organizationId: data.organizationId,
      rosterDay: { date: { gte: data.startDate, lte: data.endDate } },
    },
    include: { rosterDay: true },
  })

  let count = 0
  for (let w = 1; w <= data.weeks; w++) {
    const offset = w * 7
    const weekStart = addDays(data.startDate, offset)
    const weekEnd = addDays(data.endDate, offset)

    const existingTarget = await prisma.assignment.findMany({
      where: {
        organizationId: data.organizationId,
        rosterDay: { date: { gte: weekStart, lte: weekEnd } },
      },
      include: { rosterDay: true },
    })
    const existingKeys = new Set(
      existingTarget.map((a) => `${a.rosterDay.date}:${a.employeeId}:${a.shiftTemplateId}`)
    )

    for (const a of sourceAssignments) {
      const targetDate = addDays(a.rosterDay.date, offset)
      const key = `${targetDate}:${a.employeeId}:${a.shiftTemplateId}`
      if (existingKeys.has(key)) continue

      const targetDay = await prisma.rosterDay.upsert({
        where: { organizationId_date: { organizationId: data.organizationId, date: targetDate } },
        update: {},
        create: { organizationId: data.organizationId, date: targetDate },
      })

      await prisma.assignment.create({
        data: {
          organizationId: data.organizationId,
          rosterDayId: targetDay.id,
          employeeId: a.employeeId,
          shiftTemplateId: a.shiftTemplateId,
          notes: a.notes,
        },
      })
      existingKeys.add(key)
      count++
    }
  }

  return { count }
}
