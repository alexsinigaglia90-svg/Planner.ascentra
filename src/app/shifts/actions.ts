'use server'

import { revalidatePath } from 'next/cache'
import { createShiftTemplate } from '@/lib/queries/shiftTemplates'
import { setShiftRequirement } from '@/lib/queries/shiftRequirements'
import { setShiftRequiredSkill } from '@/lib/queries/skills'
import { setShiftTemplateLocation, setShiftTemplateDepartment } from '@/lib/queries/locations'
import { getCurrentContext, canMutate } from '@/lib/auth/context'
import { logAction } from '@/lib/audit'
import { prisma } from '@/lib/db/client'

export async function createShiftTemplateAction(formData: FormData) {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) throw new Error('You do not have permission to perform this action.')
  const name = formData.get('name') as string
  const startTime = formData.get('startTime') as string
  const endTime = formData.get('endTime') as string
  const requiredEmployees = parseInt(formData.get('requiredEmployees') as string, 10)

  if (!name || !startTime || !endTime || isNaN(requiredEmployees)) {
    throw new Error('Invalid form data')
  }

  await createShiftTemplate({ organizationId: orgId, name, startTime, endTime, requiredEmployees })
  revalidatePath('/shifts')
}

export async function setShiftRequirementAction(
  shiftTemplateId: string,
  requiredHeadcount: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission to perform this action.' }
  if (!shiftTemplateId || isNaN(requiredHeadcount) || requiredHeadcount < 0) {
    return { ok: false, error: 'Invalid data.' }
  }
  await setShiftRequirement({ organizationId: orgId, shiftTemplateId, requiredHeadcount })
  revalidatePath('/shifts')
  revalidatePath('/planning')
  await logAction({
    organizationId: orgId, userId,
    actionType: 'update_requirement', entityType: 'requirement',
    entityId: shiftTemplateId,
    summary: `Set required headcount to ${requiredHeadcount} for shift template ${shiftTemplateId}`,
    afterData: { shiftTemplateId, requiredHeadcount },
  })
  return { ok: true }
}

export async function setShiftRequiredSkillAction(
  shiftTemplateId: string,
  skillId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  if (!shiftTemplateId) return { ok: false, error: 'Invalid data.' }
  try {
    await setShiftRequiredSkill({ shiftTemplateId, skillId })
    revalidatePath('/shifts')
    revalidatePath('/planning')
    return { ok: true }
  } catch (err) {
    console.error('setShiftRequiredSkillAction error:', err)
    return { ok: false, error: 'Could not update required skill. Please try again.' }
  }
}

export async function setShiftTemplateLocationAction(
  shiftTemplateId: string,
  locationId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  if (!shiftTemplateId) return { ok: false, error: 'Invalid data.' }
  try {
    await setShiftTemplateLocation(shiftTemplateId, locationId)
    revalidatePath('/shifts')
    revalidatePath('/planning')
    return { ok: true }
  } catch (err) {
    console.error('setShiftTemplateLocationAction error:', err)
    return { ok: false, error: 'Could not update location. Please try again.' }
  }
}

export async function setShiftTemplateDepartmentAction(
  shiftTemplateId: string,
  departmentId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  if (!shiftTemplateId) return { ok: false, error: 'Invalid data.' }
  try {
    await setShiftTemplateDepartment(shiftTemplateId, departmentId)
    revalidatePath('/shifts')
    revalidatePath('/planning')
    return { ok: true }
  } catch (err) {
    console.error('setShiftTemplateDepartmentAction error:', err)
    return { ok: false, error: 'Could not update department. Please try again.' }
  }
}

export async function updateShiftBreakConfigAction(
  shiftTemplateId: string,
  breakMinutes: number,
  breakMode: string,
  breakWindowStart: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'Geen rechten.' }
  if (!shiftTemplateId) return { ok: false, error: 'Ongeldig shift ID.' }

  try {
    await prisma.shiftTemplate.update({
      where: { id: shiftTemplateId },
      data: {
        breakMinutes: Math.max(0, Math.min(120, breakMinutes)),
        breakMode,
        breakWindowStart: breakWindowStart || null,
      },
    })
    revalidatePath('/shifts')
    revalidatePath('/planning')
    revalidatePath('/planning2')
    revalidatePath('/demand')
    return { ok: true }
  } catch (err) {
    console.error('updateShiftBreakConfigAction error:', err)
    return { ok: false, error: 'Kon pauzeconfiguratie niet opslaan.' }
  }
}

export async function deleteShiftTemplateAction(
  shiftTemplateId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'Geen rechten.' }

  try {
    const template = await prisma.shiftTemplate.findFirst({
      where: { id: shiftTemplateId, organizationId: orgId },
      select: { id: true, name: true },
    })
    if (!template) return { ok: false, error: 'Shift template niet gevonden.' }

    // Check if assignments exist
    const assignmentCount = await prisma.assignment.count({
      where: { shiftTemplateId, organizationId: orgId },
    })
    if (assignmentCount > 0) {
      return { ok: false, error: `Kan niet verwijderen: ${assignmentCount} toewijzingen gebruiken dit template.` }
    }

    // Delete requirements first, then template
    await prisma.shiftRequirement.deleteMany({ where: { shiftTemplateId } })
    await prisma.shiftTemplate.delete({ where: { id: shiftTemplateId } })

    await logAction({
      organizationId: orgId,
      userId,
      actionType: 'delete_assignment',
      entityType: 'requirement',
      entityId: shiftTemplateId,
      summary: `Shift template "${template.name}" verwijderd`,
    })

    revalidatePath('/shifts')
    revalidatePath('/planning')
    return { ok: true }
  } catch (err) {
    console.error('deleteShiftTemplateAction error:', err)
    return { ok: false, error: 'Kon shift template niet verwijderen.' }
  }
}
