'use server'

import { revalidatePath } from 'next/cache'
import { createEmployee, setFixedWorkingDays } from '@/lib/queries/employees'
import { createSkill, addEmployeeSkill, removeEmployeeSkill } from '@/lib/queries/skills'
import {
  createLocation, createDepartment, createSubdepartment, updateDepartment,
  setEmployeeLocation, setEmployeeDepartment,
} from '@/lib/queries/locations'
import {
  createEmployeeFunction, updateEmployeeFunction, setEmployeeFunction,
} from '@/lib/queries/functions'
import { setEmployeeTeam } from '@/lib/queries/teams'
import { getCurrentContext, canMutate } from '@/lib/auth/context'
import { prisma } from '@/lib/db/client'

export async function createEmployeeAction(formData: FormData) {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) throw new Error('You do not have permission to perform this action.')
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const employeeType = formData.get('employeeType') as string
  const contractHours = parseFloat(formData.get('contractHours') as string)
  const status = formData.get('status') as string
  const functionId = (formData.get('functionId') as string) || null
  const mainDepartmentId = (formData.get('mainDepartmentId') as string) || null
  // Accept fixedWorkingDays as multiple checkbox values with the same field name
  const fixedWorkingDays = (formData.getAll('fixedWorkingDays') as string[]).filter(Boolean)

  if (!name || !email || !employeeType || isNaN(contractHours) || !status) {
    throw new Error('Invalid form data')
  }

  await createEmployee({ organizationId: orgId, name, email, employeeType, contractHours, status, functionId, mainDepartmentId, fixedWorkingDays: fixedWorkingDays.length > 0 ? fixedWorkingDays : [] })
  revalidatePath('/employees')
}

export async function createSkillAction(
  name: string,
): Promise<{ ok: true; id: string; name: string } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'Skill name cannot be empty.' }
  if (trimmed.length > 60) return { ok: false, error: 'Skill name too long (max 60 chars).' }
  try {
    const skill = await createSkill({ organizationId: orgId, name: trimmed })
    revalidatePath('/employees')
    revalidatePath('/shifts')
    return { ok: true, id: skill.id, name: skill.name }
  } catch (err) {
    console.error('createSkillAction error:', err)
    return { ok: false, error: 'Could not create skill. Please try again.' }
  }
}

export async function addEmployeeSkillAction(
  employeeId: string,
  skillId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  if (!employeeId || !skillId) return { ok: false, error: 'Invalid data.' }
  try {
    await addEmployeeSkill({ employeeId, skillId })
    revalidatePath('/employees')
    revalidatePath('/planning')
    return { ok: true }
  } catch (err) {
    console.error('addEmployeeSkillAction error:', err)
    return { ok: false, error: 'Could not add skill. Please try again.' }
  }
}

export async function removeEmployeeSkillAction(
  employeeId: string,
  skillId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  if (!employeeId || !skillId) return { ok: false, error: 'Invalid data.' }
  try {
    await removeEmployeeSkill({ employeeId, skillId })
    revalidatePath('/employees')
    revalidatePath('/planning')
    return { ok: true }
  } catch (err) {
    console.error('removeEmployeeSkillAction error:', err)
    return { ok: false, error: 'Could not remove skill. Please try again.' }
  }
}

// ---------------------------------------------------------------------------
// Location / Department management actions
// ---------------------------------------------------------------------------

export async function createLocationAction(
  name: string,
): Promise<{ ok: true; id: string; name: string } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'Location name cannot be empty.' }
  if (trimmed.length > 80) return { ok: false, error: 'Name too long (max 80 chars).' }
  try {
    const loc = await createLocation({ organizationId: orgId, name: trimmed })
    revalidatePath('/employees')
    revalidatePath('/shifts')
    return { ok: true, id: loc.id, name: loc.name }
  } catch (err) {
    console.error('createLocationAction error:', err)
    return { ok: false, error: 'Could not create location. Please try again.' }
  }
}

export async function createDepartmentAction(
  name: string,
): Promise<{ ok: true; id: string; name: string } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'Department name cannot be empty.' }
  if (trimmed.length > 80) return { ok: false, error: 'Name too long (max 80 chars).' }
  try {
    const dept = await createDepartment({ organizationId: orgId, name: trimmed })
    revalidatePath('/employees')
    revalidatePath('/shifts')
    return { ok: true, id: dept.id, name: dept.name }
  } catch (err) {
    console.error('createDepartmentAction error:', err)
    return { ok: false, error: 'Could not create department. Please try again.' }
  }
}

export async function createSubdepartmentAction(
  name: string,
  parentDepartmentId: string,
): Promise<{ ok: true; id: string; name: string } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'Subdepartment name cannot be empty.' }
  if (trimmed.length > 80) return { ok: false, error: 'Name too long (max 80 chars).' }
  if (!parentDepartmentId) return { ok: false, error: 'Parent department is required.' }
  try {
    const dept = await createSubdepartment({ organizationId: orgId, name: trimmed, parentDepartmentId })
    revalidatePath('/employees')
    revalidatePath('/shifts')
    return { ok: true, id: dept.id, name: dept.name }
  } catch (err) {
    console.error('createSubdepartmentAction error:', err)
    return { ok: false, error: 'Could not create subdepartment. Please try again.' }
  }
}

export async function setEmployeeLocationAction(
  employeeId: string,
  locationId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  if (!employeeId) return { ok: false, error: 'Invalid data.' }
  try {
    await setEmployeeLocation(employeeId, locationId)
    revalidatePath('/employees')
    revalidatePath('/planning')
    return { ok: true }
  } catch (err) {
    console.error('setEmployeeLocationAction error:', err)
    return { ok: false, error: 'Could not update location. Please try again.' }
  }
}

export async function setEmployeeDepartmentAction(
  employeeId: string,
  departmentId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  if (!employeeId) return { ok: false, error: 'Invalid data.' }
  try {
    await setEmployeeDepartment(employeeId, departmentId)
    revalidatePath('/employees')
    revalidatePath('/planning')
    return { ok: true }
  } catch (err) {
    console.error('setEmployeeDepartmentAction error:', err)
    return { ok: false, error: 'Could not update department. Please try again.' }
  }
}

export async function setEmployeeTeamAction(
  employeeId: string,
  teamId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  if (!employeeId) return { ok: false, error: 'Invalid data.' }
  try {
    await setEmployeeTeam(employeeId, teamId)
    revalidatePath('/employees')
    revalidatePath('/planning')
    return { ok: true }
  } catch (err) {
    console.error('setEmployeeTeamAction error:', err)
    return { ok: false, error: 'Could not update team. Please try again.' }
  }
}

// ---------------------------------------------------------------------------
// EmployeeFunction management actions
// ---------------------------------------------------------------------------

export async function createEmployeeFunctionAction(
  name: string,
  overhead = false,
): Promise<{ ok: true; id: string; name: string; overhead: boolean } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'Function name cannot be empty.' }
  if (trimmed.length > 80) return { ok: false, error: 'Name too long (max 80 chars).' }
  try {
    const fn = await createEmployeeFunction({ organizationId: orgId, name: trimmed, overhead })
    revalidatePath('/employees')
    revalidatePath('/workforce/employees')
    return { ok: true, id: fn.id, name: fn.name, overhead: fn.overhead }
  } catch (err) {
    console.error('createEmployeeFunctionAction error:', err)
    return { ok: false, error: 'Could not create function. Please try again.' }
  }
}

export async function updateEmployeeFunctionAction(
  id: string,
  data: { name?: string; overhead?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  if (!id) return { ok: false, error: 'Invalid function ID.' }
  const update: { name?: string; overhead?: boolean } = {}
  if (data.name !== undefined) {
    const trimmed = data.name.trim()
    if (!trimmed) return { ok: false, error: 'Function name cannot be empty.' }
    if (trimmed.length > 80) return { ok: false, error: 'Name too long (max 80 chars).' }
    update.name = trimmed
  }
  if (data.overhead !== undefined) update.overhead = data.overhead
  try {
    await updateEmployeeFunction(id, update)
    revalidatePath('/employees')
    revalidatePath('/workforce/employees')
    return { ok: true }
  } catch (err) {
    console.error('updateEmployeeFunctionAction error:', err)
    return { ok: false, error: 'Could not update function. Please try again.' }
  }
}

export async function setEmployeeFunctionAction(
  employeeId: string,
  functionId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  if (!employeeId) return { ok: false, error: 'Invalid data.' }
  try {
    await setEmployeeFunction(employeeId, functionId)
    revalidatePath('/employees')
    revalidatePath('/workforce/employees')
    revalidatePath('/planning')
    return { ok: true }
  } catch (err) {
    console.error('setEmployeeFunctionAction error:', err)
    return { ok: false, error: 'Could not update function. Please try again.' }
  }
}

// ---------------------------------------------------------------------------
// Department update action
// ---------------------------------------------------------------------------

export async function updateDepartmentAction(
  id: string,
  data: { name?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  if (!id) return { ok: false, error: 'Invalid department ID.' }
  if (data.name !== undefined) {
    const trimmed = data.name.trim()
    if (!trimmed) return { ok: false, error: 'Department name cannot be empty.' }
    if (trimmed.length > 80) return { ok: false, error: 'Name too long (max 80 chars).' }
    data = { ...data, name: trimmed }
  }
  try {
    await updateDepartment(id, data)
    revalidatePath('/employees')
    revalidatePath('/workforce/employees')
    revalidatePath('/shifts')
    return { ok: true }
  } catch (err) {
    console.error('updateDepartmentAction error:', err)
    return { ok: false, error: 'Could not update department. Please try again.' }
  }
}

// ---------------------------------------------------------------------------
// Fixed working days action
// ---------------------------------------------------------------------------

export async function setFixedWorkingDaysAction(
  employeeId: string,
  days: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  if (!employeeId) return { ok: false, error: 'Invalid data.' }
  try {
    await setFixedWorkingDays(employeeId, days)
    revalidatePath('/employees')
    revalidatePath('/workforce/employees')
    return { ok: true }
  } catch (err) {
    console.error('setFixedWorkingDaysAction error:', err)
    return { ok: false, error: 'Could not update fixed working days. Please try again.' }
  }
}

// ---------------------------------------------------------------------------
// Skill management — delete + rename
// ---------------------------------------------------------------------------

export async function deleteSkillAction(
  skillId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  if (!skillId) return { ok: false, error: 'Invalid skill ID.' }

  try {
    // Verify ownership
    const skill = await prisma.skill.findFirst({
      where: { id: skillId, organizationId: orgId },
      select: { id: true },
    })
    if (!skill) return { ok: false, error: 'Skill not found.' }

    // Remove all employee links + shift requirements referencing this skill
    await prisma.employeeSkill.deleteMany({ where: { skillId } })
    await prisma.shiftTemplate.updateMany({
      where: { requiredSkillId: skillId, organizationId: orgId },
      data: { requiredSkillId: null },
    })
    await prisma.skill.delete({ where: { id: skillId } })

    revalidatePath('/employees')
    revalidatePath('/workforce/skills')
    revalidatePath('/shifts')
    return { ok: true }
  } catch (err) {
    console.error('deleteSkillAction error:', err)
    return { ok: false, error: 'Could not delete skill. Please try again.' }
  }
}

export async function renameSkillAction(
  skillId: string,
  newName: string,
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  const trimmed = newName.trim()
  if (!trimmed) return { ok: false, error: 'Skill name cannot be empty.' }
  if (trimmed.length > 60) return { ok: false, error: 'Skill name too long (max 60 chars).' }

  try {
    const skill = await prisma.skill.findFirst({
      where: { id: skillId, organizationId: orgId },
      select: { id: true },
    })
    if (!skill) return { ok: false, error: 'Skill not found.' }

    // Check for name conflict
    const existing = await prisma.skill.findFirst({
      where: { organizationId: orgId, name: trimmed, id: { not: skillId } },
    })
    if (existing) return { ok: false, error: 'A skill with this name already exists.' }

    await prisma.skill.update({ where: { id: skillId }, data: { name: trimmed } })

    revalidatePath('/employees')
    revalidatePath('/workforce/skills')
    return { ok: true, name: trimmed }
  } catch (err) {
    console.error('renameSkillAction error:', err)
    return { ok: false, error: 'Could not rename skill. Please try again.' }
  }
}
