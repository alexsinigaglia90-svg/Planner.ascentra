'use server'

import { revalidatePath } from 'next/cache'
import { createEmployee } from '@/lib/queries/employees'
import type { Employee } from '@/lib/queries/employees'
import { setEmployeeTeam } from '@/lib/queries/teams'
import { getCurrentContext, canMutate } from '@/lib/auth/context'

export async function createWorkforceEmployeeAction(
  formData: FormData,
): Promise<{ ok: true; employee: Employee } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }

  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()
  const employeeType = formData.get('employeeType') as string
  const contractHours = parseFloat(formData.get('contractHours') as string)
  const status = formData.get('status') as string
  const teamId = (formData.get('teamId') as string) || null

  if (!name || !email || !employeeType || isNaN(contractHours) || !status) {
    return { ok: false, error: 'Please fill in all required fields.' }
  }

  try {
    const created = await createEmployee({ organizationId: orgId, name, email, employeeType, contractHours, status })
    if (teamId) {
      await setEmployeeTeam(created.id, teamId)
    }
    revalidatePath('/workforce/employees')
    revalidatePath('/employees')
    // Return the employee with the resolved teamId so the client can update immediately
    return { ok: true, employee: { ...created, teamId } }
  } catch (err) {
    console.error('createWorkforceEmployeeAction error:', err)
    return { ok: false, error: 'Could not create employee. Please try again.' }
  }
}

export async function setWorkforceEmployeeTeamAction(
  employeeId: string,
  teamId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }
  if (!employeeId) return { ok: false, error: 'Invalid data.' }
  try {
    await setEmployeeTeam(employeeId, teamId)
    revalidatePath('/workforce/employees')
    revalidatePath('/employees')
    return { ok: true }
  } catch (err) {
    console.error('setWorkforceEmployeeTeamAction error:', err)
    return { ok: false, error: 'Could not update team. Please try again.' }
  }
}
