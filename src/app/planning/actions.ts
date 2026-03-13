'use server'

import { revalidatePath } from 'next/cache'
import {
  createAssignment,
  copyRosterDay,
  copyEmployeeSchedule,
  copyWeekSchedule,
  repeatPattern,
  deleteAssignment,
  copyEmployeeWeek,
  moveAssignment,
  copyAssignmentToSlot,
  updateAssignment,
  getAssignmentById,
  getAssignments,
} from '@/lib/queries/assignments'
import { getAutofillCandidates, autoFillShift, type AutofillCandidate, type AutofillResult } from '@/lib/autofill'
import { getRankedCandidates, type RecommendationResult } from '@/lib/scoring'
import { getCurrentContext, canMutate } from '@/lib/auth/context'
import { logAction } from '@/lib/audit'
import { notifyOrgPlanners, notifyOverHours } from '@/lib/notify'
import { prisma } from '@/lib/db/client'
import { getEmployeesWithContext } from '@/lib/queries/employees'
import { getShiftTemplatesWithContext } from '@/lib/queries/shiftTemplates'
import { getShiftRequirements } from '@/lib/queries/shiftRequirements'
import { getLocations, getDepartments } from '@/lib/queries/locations'
import { computeOpsSnapshot } from '@/lib/ops'
import { checkTeamRotationViolation, type TeamWithSlots } from '@/lib/teams'

// ---------------------------------------------------------------------------
// Shared validators
// ---------------------------------------------------------------------------

/** Returns true only if the string is a valid YYYY-MM-DD calendar date. */
function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00')
  return !isNaN(d.getTime())
}

/** Returns true if the string looks like a non-empty CUID/UUID id. */
function isValidId(s: string): boolean {
  return typeof s === 'string' && s.trim().length >= 10
}

// ---------------------------------------------------------------------------
// Assignment actions
// ---------------------------------------------------------------------------

export async function createAssignmentAction(formData: FormData): Promise<{ error?: string; warning?: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canMutate(role)) return { error: 'You do not have permission to perform this action.' }
  const date = (formData.get('date') as string | null) ?? ''
  const employeeId = (formData.get('employeeId') as string | null) ?? ''
  const shiftTemplateId = (formData.get('shiftTemplateId') as string | null) ?? ''
  const notes = (formData.get('notes') as string) || undefined

  if (!date || !employeeId || !shiftTemplateId) {
    return { error: 'Please fill in all required fields.' }
  }
  if (!isValidDate(date)) {
    return { error: 'Invalid date format.' }
  }
  if (!isValidId(employeeId) || !isValidId(shiftTemplateId)) {
    return { error: 'Invalid selection. Please reload and try again.' }
  }

  // Hard block: team rotation constraint must be satisfied before writing.
  try {
    const employeeWithTeam = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        team: {
          select: {
            id: true, name: true, color: true,
            rotationAnchorDate: true, rotationLength: true,
            rotationSlots: { select: { weekOffset: true, shiftTemplateId: true } },
          },
        },
      },
    })
    if (employeeWithTeam?.team) {
      const violation = checkTeamRotationViolation(
        employeeWithTeam.team as TeamWithSlots,
        shiftTemplateId,
        date,
      )
      if (!violation.ok) {
        const activeTemplate = await prisma.shiftTemplate.findUnique({
          where: { id: violation.activeShiftTemplateId },
          select: { name: true },
        })
        return {
          error:
            `Team rotation conflict: ${employeeWithTeam.team.name} is scheduled for` +
            ` "${activeTemplate?.name ?? violation.activeShiftTemplateId}" this week —` +
            ` not eligible for this shift.`,
        }
      }
    }
  } catch {
    // If the check itself errors, fall through and allow the assignment
    // (fail-open on the guard, not on the write).
  }

  try {
    const result = await createAssignment({ organizationId: orgId, date, employeeId, shiftTemplateId, notes })
    if (!result.ok) return { error: result.error }
    revalidatePath('/planning')
    revalidatePath('/', 'layout')
    await logAction({
      organizationId: orgId, userId,
      actionType: 'create_assignment', entityType: 'assignment',
      entityId: result.assignment.id,
      summary: `Created assignment on ${date}`,
      afterData: { date, employeeId, shiftTemplateId, notes: notes ?? null },
    })
    // Check if this employee is now over contract hours for the week
    await notifyOverHours({ organizationId: orgId, employeeId, date })
    return {}
  } catch (err) {
    console.error('createAssignmentAction error:', err)
    return { error: 'Could not create assignment. Please try again.' }
  }
}

export async function deleteAssignmentAction(id: string): Promise<{ error?: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canMutate(role)) return { error: 'You do not have permission to perform this action.' }
  if (!isValidId(id)) return { error: 'Invalid assignment id.' }
  try {
    const before = await getAssignmentById(id)
    await deleteAssignment(id)
    revalidatePath('/planning')
    await logAction({
      organizationId: orgId, userId,
      actionType: 'delete_assignment', entityType: 'assignment',
      entityId: id,
      summary: before
        ? `Deleted assignment on ${before.rosterDay.date} (${before.employee.name} — ${before.shiftTemplate.name})`
        : `Deleted assignment`,
      beforeData: before ? {
        date: before.rosterDay.date,
        employeeId: before.employeeId,
        employeeName: before.employee.name,
        shiftTemplateId: before.shiftTemplateId,
        shiftName: before.shiftTemplate.name,
        notes: before.notes,
      } : null,
    })
    return {}
  } catch (err) {
    console.error('deleteAssignmentAction error:', err)
    return { error: 'Could not delete assignment. Please try again.' }
  }
}

export async function updateAssignmentAction(
  assignmentId: string,
  shiftTemplateId: string,
  notes: string | null
): Promise<{ error?: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canMutate(role)) return { error: 'You do not have permission to perform this action.' }
  if (!isValidId(assignmentId) || !isValidId(shiftTemplateId)) {
    return { error: 'Invalid data. Please reload and try again.' }
  }
  try {
    const before = await getAssignmentById(assignmentId)
    const result = await updateAssignment({ assignmentId, shiftTemplateId, notes })
    if (!result.ok) return { error: result.error }
    revalidatePath('/planning')
    await logAction({
      organizationId: orgId, userId,
      actionType: 'update_assignment', entityType: 'assignment',
      entityId: assignmentId,
      summary: `Updated assignment${before ? ` on ${before.rosterDay.date} (${before.employee.name})` : ''}`,
      beforeData: before ? {
        shiftTemplateId: before.shiftTemplateId,
        shiftName: before.shiftTemplate.name,
        notes: before.notes,
      } : null,
      afterData: { shiftTemplateId, notes },
    })
    return {}
  } catch (err) {
    console.error('updateAssignmentAction error:', err)
    return { error: 'Update failed. Please try again.' }
  }
}

export async function moveAssignmentAction(
  assignmentId: string,
  targetDate: string,
  targetEmployeeId: string
): Promise<{ error?: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canMutate(role)) return { error: 'You do not have permission to perform this action.' }
  if (!isValidId(assignmentId) || !isValidId(targetEmployeeId)) {
    return { error: 'Invalid data. Please reload and try again.' }
  }
  if (!isValidDate(targetDate)) {
    return { error: 'Invalid target date.' }
  }
  try {
    const before = await getAssignmentById(assignmentId)
    // Hard block: check team rotation for the target employee + date + shift
    if (before) {
      try {
        const targetEmployee = await prisma.employee.findUnique({
          where: { id: targetEmployeeId },
          include: {
            team: {
              select: {
                id: true, name: true, color: true,
                rotationAnchorDate: true, rotationLength: true,
                rotationSlots: { select: { weekOffset: true, shiftTemplateId: true } },
              },
            },
          },
        })
        if (targetEmployee?.team) {
          const violation = checkTeamRotationViolation(
            targetEmployee.team as TeamWithSlots,
            before.shiftTemplateId,
            targetDate,
          )
          if (!violation.ok) {
            const activeTemplate = await prisma.shiftTemplate.findUnique({
              where: { id: violation.activeShiftTemplateId },
              select: { name: true },
            })
            return {
              error:
                `Team rotation conflict: ${targetEmployee.team.name} is scheduled for` +
                ` "${activeTemplate?.name ?? violation.activeShiftTemplateId}" this week —` +
                ` cannot move to this shift.`,
            }
          }
        }
      } catch {
        // Fail-open: if the guard itself errors, allow the move
      }
    }
    const result = await moveAssignment({ assignmentId, targetDate, targetEmployeeId })
    if (!result.ok) return { error: result.error }
    revalidatePath('/planning')
    await logAction({
      organizationId: orgId, userId,
      actionType: 'move_assignment', entityType: 'assignment',
      entityId: assignmentId,
      summary: `Moved assignment to ${targetDate}${before ? ` (from ${before.rosterDay.date})` : ''}`,
      beforeData: before ? { date: before.rosterDay.date, employeeId: before.employeeId } : null,
      afterData: { date: targetDate, employeeId: targetEmployeeId },
    })
    return {}
  } catch (err) {
    console.error('moveAssignmentAction error:', err)
    return { error: 'Move failed. Please try again.' }
  }
}

export async function copyAssignmentAction(
  assignmentId: string,
  targetDate: string,
  targetEmployeeId: string
): Promise<{ error?: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canMutate(role)) return { error: 'You do not have permission to perform this action.' }
  if (!isValidId(assignmentId) || !isValidId(targetEmployeeId)) {
    return { error: 'Invalid data. Please reload and try again.' }
  }
  if (!isValidDate(targetDate)) {
    return { error: 'Invalid target date.' }
  }
  // Hard block: check team rotation for the target employee + date + shift
  try {
    const source = await getAssignmentById(assignmentId)
    if (source) {
      const targetEmployee = await prisma.employee.findUnique({
        where: { id: targetEmployeeId },
        include: {
          team: {
            select: {
              id: true, name: true, color: true,
              rotationAnchorDate: true, rotationLength: true,
              rotationSlots: { select: { weekOffset: true, shiftTemplateId: true } },
            },
          },
        },
      })
      if (targetEmployee?.team) {
        const violation = checkTeamRotationViolation(
          targetEmployee.team as TeamWithSlots,
          source.shiftTemplateId,
          targetDate,
        )
        if (!violation.ok) {
          const activeTemplate = await prisma.shiftTemplate.findUnique({
            where: { id: violation.activeShiftTemplateId },
            select: { name: true },
          })
          return {
            error:
              `Team rotation conflict: ${targetEmployee.team.name} is scheduled for` +
              ` "${activeTemplate?.name ?? violation.activeShiftTemplateId}" this week —` +
              ` cannot copy to this shift.`,
          }
        }
      }
    }
  } catch {
    // Fail-open on guard error
  }
  try {
    const result = await copyAssignmentToSlot({ assignmentId, targetDate, targetEmployeeId })
    if (!result.ok) return { error: result.error }
    revalidatePath('/planning')
    await logAction({
      organizationId: orgId, userId,
      actionType: 'copy_assignment', entityType: 'assignment',
      entityId: assignmentId,
      summary: `Copied assignment to ${targetDate}`,
      afterData: { targetDate, targetEmployeeId, sourceAssignmentId: assignmentId },
    })
    return {}
  } catch (err) {
    console.error('copyAssignmentAction error:', err)
    return { error: 'Copy failed. Please try again.' }
  }
}

// ---------------------------------------------------------------------------
// Day copy action
// ---------------------------------------------------------------------------

export async function copyDayAction(formData: FormData): Promise<{ error?: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canMutate(role)) return { error: 'You do not have permission to perform this action.' }
  const sourceDate = (formData.get('sourceDate') as string | null) ?? ''
  const targetDate = (formData.get('targetDate') as string | null) ?? ''

  if (!sourceDate || !targetDate) {
    return { error: 'Please provide both dates.' }
  }
  if (!isValidDate(sourceDate) || !isValidDate(targetDate)) {
    return { error: 'Invalid date format.' }
  }
  if (sourceDate === targetDate) {
    return { error: 'Source and target dates must be different.' }
  }

  try {
    await copyRosterDay(sourceDate, targetDate, orgId)
    revalidatePath('/planning')
    await logAction({
      organizationId: orgId, userId,
      actionType: 'copy_day', entityType: 'bulk',
      entityId: `${sourceDate}_to_${targetDate}`,
      summary: `Copied schedule from ${sourceDate} to ${targetDate}`,
      afterData: { sourceDate, targetDate },
    })
    return {}
  } catch (err) {
    console.error('copyDayAction error:', err)
    return { error: 'Day copy failed. Please try again.' }
  }
}

// ---------------------------------------------------------------------------
// Bulk schedule actions
// ---------------------------------------------------------------------------

export async function copyEmployeeWeekAction(
  formData: FormData
): Promise<{ count?: number; error?: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canMutate(role)) return { error: 'You do not have permission to perform this action.' }
  const employeeId = (formData.get('employeeId') as string | null) ?? ''
  const sourceWeekStart = (formData.get('sourceWeekStart') as string | null) ?? ''
  const targetWeekStart = (formData.get('targetWeekStart') as string | null) ?? ''

  if (!employeeId || !sourceWeekStart || !targetWeekStart) {
    return { error: 'Please fill in all fields.' }
  }
  if (!isValidId(employeeId)) {
    return { error: 'Invalid employee. Please reload and try again.' }
  }
  if (!isValidDate(sourceWeekStart) || !isValidDate(targetWeekStart)) {
    return { error: 'Invalid date format.' }
  }
  if (sourceWeekStart === targetWeekStart) {
    return { error: 'Source and target weeks must be different.' }
  }

  try {
    const { count } = await copyEmployeeWeek({ organizationId: orgId, employeeId, sourceWeekStart, targetWeekStart })
    revalidatePath('/planning')
    await logAction({
      organizationId: orgId, userId,
      actionType: 'copy_employee_week', entityType: 'bulk',
      entityId: `${employeeId}_${sourceWeekStart}`,
      summary: `Copied employee week from ${sourceWeekStart} to ${targetWeekStart} (${count} assignment${count !== 1 ? 's' : ''})`,
      afterData: { employeeId, sourceWeekStart, targetWeekStart, count },
    })
    return { count }
  } catch (err) {
    console.error('copyEmployeeWeekAction error:', err)
    return { error: 'Week copy failed. Please try again.' }
  }
}

export async function copyEmployeeScheduleAction(
  formData: FormData
): Promise<{ count?: number; error?: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canMutate(role)) return { error: 'You do not have permission to perform this action.' }
  const sourceEmployeeId = (formData.get('sourceEmployeeId') as string | null) ?? ''
  const targetEmployeeId = (formData.get('targetEmployeeId') as string | null) ?? ''
  const startDate = (formData.get('startDate') as string | null) ?? ''
  const endDate = (formData.get('endDate') as string | null) ?? ''

  if (!sourceEmployeeId || !targetEmployeeId || !startDate || !endDate) {
    return { error: 'Please fill in all fields.' }
  }
  if (!isValidId(sourceEmployeeId) || !isValidId(targetEmployeeId)) {
    return { error: 'Invalid employee. Please reload and try again.' }
  }
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return { error: 'Invalid date format.' }
  }
  if (sourceEmployeeId === targetEmployeeId) {
    return { error: 'Source and target employee must be different.' }
  }
  if (startDate > endDate) {
    return { error: 'Start date must be before end date.' }
  }

  try {
    const { count } = await copyEmployeeSchedule({ organizationId: orgId, sourceEmployeeId, targetEmployeeId, startDate, endDate })
    revalidatePath('/planning')
    await logAction({
      organizationId: orgId, userId,
      actionType: 'copy_employee_schedule', entityType: 'bulk',
      entityId: `${sourceEmployeeId}_to_${targetEmployeeId}`,
      summary: `Copied employee schedule ${startDate}–${endDate} (${count} assignment${count !== 1 ? 's' : ''})`,
      afterData: { sourceEmployeeId, targetEmployeeId, startDate, endDate, count },
    })
    return { count }
  } catch (err) {
    console.error('copyEmployeeScheduleAction error:', err)
    return { error: 'Schedule copy failed. Please try again.' }
  }
}

export async function copyWeekScheduleAction(
  formData: FormData
): Promise<{ count?: number; error?: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canMutate(role)) return { error: 'You do not have permission to perform this action.' }
  const sourceWeekStart = (formData.get('sourceWeekStart') as string | null) ?? ''
  const targetWeekStart = (formData.get('targetWeekStart') as string | null) ?? ''

  if (!sourceWeekStart || !targetWeekStart) {
    return { error: 'Please fill in both dates.' }
  }
  if (!isValidDate(sourceWeekStart) || !isValidDate(targetWeekStart)) {
    return { error: 'Invalid date format.' }
  }
  if (sourceWeekStart === targetWeekStart) {
    return { error: 'Source and target weeks must be different.' }
  }

  try {
    const { count } = await copyWeekSchedule({ organizationId: orgId, sourceWeekStart, targetWeekStart })
    revalidatePath('/planning')
    await logAction({
      organizationId: orgId, userId,
      actionType: 'copy_week', entityType: 'bulk',
      entityId: `${sourceWeekStart}_to_${targetWeekStart}`,
      summary: `Copied week schedule from ${sourceWeekStart} to ${targetWeekStart} (${count} assignment${count !== 1 ? 's' : ''})`,
      afterData: { sourceWeekStart, targetWeekStart, count },
    })
    return { count }
  } catch (err) {
    console.error('copyWeekScheduleAction error:', err)
    return { error: 'Week copy failed. Please try again.' }
  }
}

export async function repeatPatternAction(
  formData: FormData
): Promise<{ count?: number; error?: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canMutate(role)) return { error: 'You do not have permission to perform this action.' }
  const startDate = (formData.get('startDate') as string | null) ?? ''
  const endDate = (formData.get('endDate') as string | null) ?? ''
  const weeksRaw = (formData.get('weeks') as string | null) ?? ''
  const weeks = parseInt(weeksRaw, 10)

  if (!startDate || !endDate) {
    return { error: 'Please fill in the date range.' }
  }
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return { error: 'Invalid date format.' }
  }
  if (startDate > endDate) {
    return { error: 'Start date must be before end date.' }
  }
  if (!weeks || weeks < 1 || weeks > 52) {
    return { error: 'Weeks must be between 1 and 52.' }
  }

  try {
    const { count } = await repeatPattern({ organizationId: orgId, startDate, endDate, weeks })
    revalidatePath('/planning')
    await logAction({
      organizationId: orgId, userId,
      actionType: 'repeat_pattern', entityType: 'bulk',
      entityId: `${startDate}_${endDate}_x${weeks}`,
      summary: `Repeated ${weeks}-week pattern from ${startDate}–${endDate} (${count} assignment${count !== 1 ? 's' : ''})`,
      afterData: { startDate, endDate, weeks, count },
    })
    return { count }
  } catch (err) {
    console.error('repeatPatternAction error:', err)
    return { error: 'Repeat failed. Please try again.' }
  }
}

// ---------------------------------------------------------------------------
// Auto-fill actions
// ---------------------------------------------------------------------------

export async function getAutofillCandidatesAction(
  shiftTemplateId: string,
  date: string,
  departmentScope?: string[] | null,
): Promise<{ candidates?: AutofillCandidate[]; error?: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { error: 'You do not have permission to perform this action.' }
  if (!isValidId(shiftTemplateId) || !isValidDate(date)) {
    return { error: 'Invalid data.' }
  }
  try {
    const candidates = await getAutofillCandidates({ organizationId: orgId, shiftTemplateId, date, departmentScope })
    return { candidates }
  } catch (err) {
    console.error('getAutofillCandidatesAction error:', err)
    return { error: 'Could not load candidates. Please try again.' }
  }
}

export async function autoFillShiftAction(
  shiftTemplateId: string,
  date: string,
  requiredHeadcount: number,
  departmentScope?: string[] | null,
): Promise<AutofillResult & { error?: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canMutate(role)) {
    return { created: 0, remaining: requiredHeadcount, candidates: [], error: 'You do not have permission to perform this action.' }
  }
  if (!isValidId(shiftTemplateId) || !isValidDate(date)) {
    return { created: 0, remaining: requiredHeadcount, candidates: [], error: 'Invalid data.' }
  }
  if (isNaN(requiredHeadcount) || requiredHeadcount < 1) {
    return { created: 0, remaining: 0, candidates: [], error: 'Invalid headcount.' }
  }
  try {
    const result = await autoFillShift({ organizationId: orgId, shiftTemplateId, date, requiredHeadcount, departmentScope })
    revalidatePath('/planning')
    revalidatePath('/', 'layout')
    if (result.created > 0) {
      await logAction({
        organizationId: orgId, userId,
        actionType: 'autofill', entityType: 'bulk',
        entityId: `${shiftTemplateId}_${date}`,
        summary: `Auto-filled ${result.created} assignment${result.created !== 1 ? 's' : ''} for shift on ${date}${result.remaining > 0 ? ` (${result.remaining} still open)` : ''}`,
        afterData: { shiftTemplateId, date, created: result.created, remaining: result.remaining },
      })
    }
    if (result.remaining > 0) {
      const type = result.requiredSkillName ? 'no_skill_match' : 'understaffed'
      const title = result.requiredSkillName
        ? 'No matching staff available'
        : 'Shift understaffed'
      const message = result.requiredSkillName
        ? `${result.remaining} slot(s) on ${date} could not be filled — no staff with the required skill (${result.requiredSkillName}) are available.`
        : `${result.remaining} slot(s) on ${date} remain unfilled after auto-fill.`
      await notifyOrgPlanners({ organizationId: orgId, type, title, message, severity: 'critical' })
    }
    // Check over-hours for every employee the engine attempted to assign
    if (result.created > 0 && result.candidates.length > 0) {
      await Promise.all(
        result.candidates.map(({ employee }) =>
          notifyOverHours({ organizationId: orgId, employeeId: employee.id, date }),
        ),
      )
    }
    return result
  } catch (err) {
    console.error('autoFillShiftAction error:', err)
    return { created: 0, remaining: requiredHeadcount, candidates: [], error: 'Auto-fill failed. Please try again.' }
  }
}

// ---------------------------------------------------------------------------
// AI-Assisted Scheduling actions
// ---------------------------------------------------------------------------

/**
 * Returns scored, ranked candidates for an understaffed shift/date.
 * Viewers may call this (read-only insight — no role restriction).
 * The scoring logic is deterministic and fully explained in src/lib/scoring.ts.
 */
export async function getShiftRecommendationsAction(
  shiftTemplateId: string,
  date: string,
): Promise<{ result?: RecommendationResult; error?: string }> {
  const { orgId } = await getCurrentContext()
  if (!isValidId(shiftTemplateId) || !isValidDate(date)) {
    return { error: 'Invalid data.' }
  }
  try {
    const result = await getRankedCandidates({ organizationId: orgId, shiftTemplateId, date })
    return { result }
  } catch (err) {
    console.error('getShiftRecommendationsAction error:', err)
    return { error: 'Could not load recommendations. Please try again.' }
  }
}

/**
 * Assigns a specific employee to a shift/date (source: AI Assist panel).
 * Requires planner or admin role.
 */
export async function assignCandidateAction(
  employeeId: string,
  shiftTemplateId: string,
  date: string,
): Promise<{ error?: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canMutate(role)) {
    return { error: 'You do not have permission to perform this action.' }
  }
  if (!isValidId(employeeId) || !isValidId(shiftTemplateId) || !isValidDate(date)) {
    return { error: 'Invalid data.' }
  }
  try {
    const result = await createAssignment({
      organizationId: orgId,
      date,
      employeeId,
      shiftTemplateId,
    })
    if (!result.ok) return { error: result.error }
    revalidatePath('/planning')
    await logAction({
      organizationId: orgId,
      userId,
      actionType: 'create_assignment',
      entityType: 'assignment',
      entityId: result.assignment.id,
      summary: `AI-assisted: Assigned to shift on ${date}`,
      afterData: { date, employeeId, shiftTemplateId, source: 'ai_assist' },
    })
    return {}
  } catch (err) {
    console.error('assignCandidateAction error:', err)
    return { error: 'Could not create assignment. Please try again.' }
  }
}

// ---------------------------------------------------------------------------
// Escalation notification sync
// ---------------------------------------------------------------------------

/**
 * Computes the current operational snapshot server-side and writes Notification
 * records for any active escalations that have not already been notified within
 * the last 4 hours (deduplication window).
 *
 * Called by OperationsView on mount so that planners/admins see live alerts
 * in the notification bell without waiting for a manual autofill or assignment.
 */
export async function syncEscalationNotificationsAction(): Promise<void> {
  try {
    const { orgId } = await getCurrentContext()

    const [assignments, employees, templates, requirements, locations, departments] = await Promise.all([
      getAssignments(orgId),
      getEmployeesWithContext(orgId),
      getShiftTemplatesWithContext(orgId),
      getShiftRequirements(orgId),
      getLocations(orgId),
      getDepartments(orgId),
    ])

    const requirementsMap = new Map(requirements.map((r) => [r.shiftTemplateId, r.requiredHeadcount]))
    const snap = computeOpsSnapshot({
      employees: employees as Parameters<typeof computeOpsSnapshot>[0]['employees'],
      templates: templates as Parameters<typeof computeOpsSnapshot>[0]['templates'],
      assignments: assignments.map((a) => ({
        employeeId: a.employeeId,
        shiftTemplateId: a.shiftTemplateId,
        rosterDay: { date: a.rosterDay.date },
      })),
      requirementsMap,
      locations,
      departments,
    })

    if (snap.escalations.length === 0) return

    const members = await prisma.organizationMembership.findMany({
      where: { organizationId: orgId, role: { in: ['admin', 'planner'] } },
      select: { userId: true },
    })
    if (members.length === 0) return

    // Dedup: skip if the same type+title was already notified for this user within 4 hours
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000)
    const recentNotifs = await prisma.notification.findMany({
      where: {
        organizationId: orgId,
        userId: { in: members.map((m) => m.userId) },
        createdAt: { gte: fourHoursAgo },
        type: { in: ['understaffed', 'no_skill_match', 'over_hours'] },
      },
      select: { userId: true, type: true, title: true },
    })
    const seen = new Set(recentNotifs.map((n) => `${n.userId}:${n.type}:${n.title}`))

    const toCreate: {
      organizationId: string
      userId: string
      type: string
      title: string
      message: string
      severity: string
    }[] = []

    for (const issue of snap.escalations) {
      let type: string
      if (issue.kind === 'critical-understaffed' || issue.kind === 'understaffed') {
        type = 'understaffed'
      } else if (issue.kind === 'no-skilled-candidates' || issue.kind === 'skill-mismatch') {
        type = 'no_skill_match'
      } else if (issue.kind === 'over-contract') {
        type = 'over_hours'
      } else {
        continue // temp-reliance / site/dept understaffed: no matching notification type yet
      }

      for (const member of members) {
        const key = `${member.userId}:${type}:${issue.title}`
        if (seen.has(key)) continue
        seen.add(key) // prevent duplicates within this batch
        toCreate.push({
          organizationId: orgId,
          userId: member.userId,
          type,
          title: issue.title,
          message: issue.detail,
          severity: issue.severity,
        })
      }
    }

    if (toCreate.length === 0) return

    await Promise.all(toCreate.map((n) => prisma.notification.create({ data: n })))
    revalidatePath('/', 'layout')
  } catch (err) {
    console.error('[syncEscalationNotificationsAction] Error:', err)
  }
}

