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
import { getLocations, getDepartments, getDepartmentsWithHierarchy } from '@/lib/queries/locations'
import { computeOpsSnapshot } from '@/lib/ops'
import { analyzeStaffing } from '@/lib/staffing'
import { buildTempDemand, buildTemplateContextMap, buildParentMap } from '@/lib/tempDemand'
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

// ---------------------------------------------------------------------------
// Temp-demand export — Phase 6
// ---------------------------------------------------------------------------

/**
 * Returns all open (understaffed) staffing slots within the given date range
 * as flat TempDemandRow records, enriched with location / department / skill
 * context. Read-only — planners and viewers can call this.
 *
 * @param startDate  ISO YYYY-MM-DD (inclusive)
 * @param endDate    ISO YYYY-MM-DD (inclusive)
 */
export async function getTempDemandAction(startDate: string, endDate: string) {
  try {
    const { orgId } = await getCurrentContext()

    const [assignments, employees, templates, requirements, departments] =
      await Promise.all([
        prisma.assignment.findMany({
          where: {
            organizationId: orgId,
            rosterDay: { date: { gte: startDate, lte: endDate } },
          },
          include: { rosterDay: true, shiftTemplate: true, employee: true },
        }),
        getEmployeesWithContext(orgId),
        getShiftTemplatesWithContext(orgId),
        getShiftRequirements(orgId),
        getDepartmentsWithHierarchy(orgId),
      ])

    // analyzeStaffing expects Map<shiftTemplateId, number> and a dates array
    const requirementsMap = new Map(
      requirements.map((r) => [r.shiftTemplateId, r.requiredHeadcount]),
    )

    // Generate the inclusive date range as ISO strings
    const dates: string[] = []
    const cursor = new Date(startDate)
    const end = new Date(endDate)
    while (cursor <= end) {
      dates.push(cursor.toISOString().slice(0, 10))
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    const entries = analyzeStaffing({
      dates,
      assignments,
      employees,
      templates,
      requirementsMap,
    })

    const templateContextMap = buildTemplateContextMap(templates)
    const parentMap = buildParentMap(departments)

    const rows = buildTempDemand({
      staffingEntries: entries,
      templateContextMap,
      parentMap,
    })

    return { rows }
  } catch (err) {
    console.error('[getTempDemandAction] Error:', err)
    return { error: 'Failed to build temp demand export' }
  }
}

// ---------------------------------------------------------------------------
// DEV/TEST ONLY — remove before production
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Plan Wizard — bulk plan generation
// ---------------------------------------------------------------------------

export interface PlanWizardInput {
  weekOffsets: number[]        // e.g. [0, 1, 2, 3, 4, 5]
  departmentId: string
  shiftTemplateIds: string[]
  priorityOrder: 'internal-first' | 'temp-first'
  separateOverhead: boolean
  mode: 'performance' | 'training'
  processAssignment: 'fixed' | 'rotate'
  traineeCount: number
  trainingProcessId?: string | null
  selectedTraineeIds?: string[]
  respectContractHours: boolean
  maxOvertimeHours: number
  fairSpread: boolean
}

export interface PlanWizardResult {
  totalCreated: number
  totalRemaining: number
  totalSlots: number
  byShift: { shiftName: string; created: number; remaining: number }[]
  conflicts: string[]
  error?: string
}

/** Generate date strings for given week offsets (Mon-Fri or Mon-Sun). */
function generateWeekDates(weekOffsets: number[], includeWeekends = false): string[] {
  const dates: string[] = []
  const now = new Date()
  const day = now.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const currentMonday = new Date(now)
  currentMonday.setDate(now.getDate() + mondayOffset)

  for (const offset of weekOffsets) {
    for (let d = 0; d < (includeWeekends ? 7 : 5); d++) {
      const date = new Date(currentMonday)
      date.setDate(currentMonday.getDate() + offset * 7 + d)
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      dates.push(iso)
    }
  }
  return dates
}

/**
 * Bulk plan generation for the Plan Wizard.
 * Iterates over all selected weeks x dates x shifts and calls autoFillShift
 * for each open slot, respecting the wizard's strategy settings.
 */
export async function generatePlanAction(input: PlanWizardInput): Promise<PlanWizardResult> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canMutate(role)) {
    return { totalCreated: 0, totalRemaining: 0, totalSlots: 0, byShift: [], conflicts: [], error: 'No permission.' }
  }

  try {
    const dates = generateWeekDates(input.weekOffsets)

    // Resolve department scope (include subdepartments)
    const deptHierarchy = await getDepartmentsWithHierarchy(orgId)
    const parentDept = deptHierarchy.find((d) => d.id === input.departmentId)
    const departmentScope = parentDept
      ? [parentDept.id, ...parentDept.children.map((c) => c.id)]
      : [input.departmentId]

    // Get shift templates with their required headcount
    const allTemplates = await getShiftTemplatesWithContext(orgId)
    const requirements = await getShiftRequirements(orgId)
    const reqMap = new Map(requirements.map((r) => [r.shiftTemplateId, r.requiredHeadcount]))

    const selectedTemplates = allTemplates.filter((t) => input.shiftTemplateIds.includes(t.id))

    let totalCreated = 0
    let totalRemaining = 0
    let totalSlots = 0
    const byShift = new Map<string, { shiftName: string; created: number; remaining: number }>()
    const conflicts: string[] = []

    // Process each date x shift combination
    for (const date of dates) {
      for (const template of selectedTemplates) {
        const required = reqMap.get(template.id) ?? template.requiredEmployees
        totalSlots += required

        const entry = byShift.get(template.id) ?? { shiftName: template.name, created: 0, remaining: 0 }

        try {
          const result = await autoFillShift({
            organizationId: orgId,
            shiftTemplateId: template.id,
            date,
            requiredHeadcount: required,
            departmentScope,
          })

          entry.created += result.created
          entry.remaining += result.remaining
          totalCreated += result.created
          totalRemaining += result.remaining

          if (result.remaining > 0) {
            conflicts.push(`${template.name} on ${date}: ${result.remaining} unfilled`)
          }
        } catch (err) {
          console.error(`generatePlan error for ${template.name} on ${date}:`, err)
          entry.remaining += required
          totalRemaining += required
          conflicts.push(`${template.name} on ${date}: error during fill`)
        }

        byShift.set(template.id, entry)
      }
    }

    // ── Training mode: assign selected trainees to open slots ──────────────
    if (input.mode === 'training' && input.trainingProcessId && input.traineeCount > 0) {
      // Get trainee IDs — either manually selected or auto-pick from level 0/1 employees
      let traineeIds: string[] = []
      if (input.selectedTraineeIds && input.selectedTraineeIds.length > 0) {
        traineeIds = input.selectedTraineeIds
      } else {
        // Auto-select: find employees with level 0/1 on the training process
        const scores = await prisma.employeeProcessScore.findMany({
          where: {
            organizationId: orgId,
            processId: input.trainingProcessId,
            level: { lte: 1 },
          },
          select: { employeeId: true },
        })
        const eligibleIds = new Set(scores.map((s) => s.employeeId))
        // Also include employees with NO score record for this process
        const allDeptEmployees = await prisma.employee.findMany({
          where: {
            organizationId: orgId,
            status: 'active',
            departmentId: { in: departmentScope },
            employeeType: 'internal',
          },
          select: { id: true },
        })
        for (const emp of allDeptEmployees) {
          if (!eligibleIds.has(emp.id)) {
            // Check if they have a score at all for this process
            const hasScore = await prisma.employeeProcessScore.findUnique({
              where: { employeeId_processId: { employeeId: emp.id, processId: input.trainingProcessId } },
              select: { level: true },
            })
            if (!hasScore) eligibleIds.add(emp.id) // no record = never assessed = eligible
          }
        }
        traineeIds = Array.from(eligibleIds).slice(0, input.traineeCount)
      }

      // Assign trainees to open slots across the dates
      let traineesAssigned = 0
      for (const traineeId of traineeIds) {
        for (const date of dates) {
          // Check if trainee already has an assignment on this date
          const rosterDay = await prisma.rosterDay.findUnique({
            where: { organizationId_date: { organizationId: orgId, date } },
            select: { id: true },
          })
          if (rosterDay) {
            const existing = await prisma.assignment.findFirst({
              where: { rosterDayId: rosterDay.id, employeeId: traineeId },
            })
            if (existing) continue // already scheduled this day
          }

          // Find first shift with open slots
          for (const template of selectedTemplates) {
            const day = await prisma.rosterDay.upsert({
              where: { organizationId_date: { organizationId: orgId, date } },
              update: {},
              create: { organizationId: orgId, date },
            })
            const assignedCount = await prisma.assignment.count({
              where: { rosterDayId: day.id, shiftTemplateId: template.id },
            })
            const required = reqMap.get(template.id) ?? template.requiredEmployees
            if (assignedCount < required) {
              try {
                await prisma.assignment.create({
                  data: {
                    organizationId: orgId,
                    rosterDayId: day.id,
                    shiftTemplateId: template.id,
                    employeeId: traineeId,
                    notes: 'Training assignment (Plan Wizard)',
                  },
                })
                totalCreated++
                traineesAssigned++
                break // next trainee, next date
              } catch {
                // unique constraint = already assigned, skip
              }
            }
          }
        }
      }

      if (traineesAssigned > 0) {
        conflicts.push(`Training: ${traineesAssigned} trainee assignments created`)
      }
    }

    // Log the bulk action
    await logAction({
      organizationId: orgId,
      userId,
      actionType: 'plan-wizard',
      entityType: 'bulk',
      entityId: `wizard_${Date.now()}`,
      summary: `Plan Wizard: ${totalCreated} assignments created across ${dates.length} days, ${selectedTemplates.length} shifts. ${totalRemaining} slots remaining.`,
      afterData: {
        weekOffsets: input.weekOffsets,
        departmentId: input.departmentId,
        shiftTemplateIds: input.shiftTemplateIds,
        totalCreated,
        totalRemaining,
        mode: input.mode,
        priorityOrder: input.priorityOrder,
      },
    })

    revalidatePath('/planning')
    revalidatePath('/', 'layout')

    return {
      totalCreated,
      totalRemaining,
      totalSlots,
      byShift: Array.from(byShift.values()),
      conflicts,
    }
  } catch (err) {
    console.error('generatePlanAction error:', err)
    return { totalCreated: 0, totalRemaining: 0, totalSlots: 0, byShift: [], conflicts: [], error: 'Plan generation failed.' }
  }
}

/** Deletes every assignment for the current org. For testing only. */
export async function deleteAllAssignmentsAction(): Promise<{ error?: string; count?: number }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { error: 'You do not have permission to perform this action.' }
  try {
    const result = await prisma.assignment.deleteMany({ where: { organizationId: orgId } })
    revalidatePath('/planning')
    return { count: result.count }
  } catch (err) {
    console.error('deleteAllAssignmentsAction error:', err)
    return { error: 'Could not delete all assignments. Please try again.' }
  }
}

