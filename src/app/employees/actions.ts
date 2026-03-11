'use server'

import { revalidatePath } from 'next/cache'
import { createEmployee } from '@/lib/queries/employees'
import { createSkill, addEmployeeSkill, removeEmployeeSkill } from '@/lib/queries/skills'
import {
  createLocation, createDepartment, updateDepartment,
  setEmployeeLocation, setEmployeeDepartment,
} from '@/lib/queries/locations'
import {
  createEmployeeFunction, updateEmployeeFunction, setEmployeeFunction,
} from '@/lib/queries/functions'
import { setEmployeeTeam } from '@/lib/queries/teams'
import { getCurrentContext, canMutate } from '@/lib/auth/context'

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

  if (!name || !email || !employeeType || isNaN(contractHours) || !status) {
    throw new Error('Invalid form data')
  }

  await createEmployee({ organizationId: orgId, name, email, employeeType, contractHours, status, functionId, mainDepartmentId })
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
