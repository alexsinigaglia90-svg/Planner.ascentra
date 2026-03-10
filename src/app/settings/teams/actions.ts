'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext, canMutate } from '@/lib/auth/context'
import {
  createTeam,
  updateTeam,
  deleteTeam,
  setTeamRotationSlots,
} from '@/lib/queries/teams'

// ─── Guards ───────────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<
  { orgId: string; userId: string } | { ok: false; error: string }
> {
  const ctx = await getCurrentContext()
  if (ctx.role !== 'admin') return { ok: false, error: 'Only administrators may manage teams.' }
  return { orgId: ctx.orgId, userId: ctx.userId }
}

function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00')
  return !isNaN(d.getTime())
}

function isValidId(s: string): boolean {
  return typeof s === 'string' && s.trim().length >= 10
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createTeamAction(data: {
  name: string
  color?: string | null
  rotationAnchorDate: string
  rotationLength: number
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const guard = await requireAdmin()
  if ('ok' in guard && !guard.ok) return guard
  const { orgId } = guard as { orgId: string; userId: string }

  const name = data.name.trim()
  if (!name) return { ok: false, error: 'Team name is required.' }
  if (name.length > 80) return { ok: false, error: 'Name too long (max 80 chars).' }
  if (!isValidDate(data.rotationAnchorDate)) {
    return { ok: false, error: 'Rotation anchor date must be a valid YYYY-MM-DD date.' }
  }
  if (!Number.isInteger(data.rotationLength) || data.rotationLength < 1 || data.rotationLength > 52) {
    return { ok: false, error: 'Rotation length must be between 1 and 52 weeks.' }
  }

  try {
    const team = await createTeam({
      organizationId: orgId,
      name,
      color: data.color ?? null,
      rotationAnchorDate: data.rotationAnchorDate,
      rotationLength: data.rotationLength,
    })
    revalidatePath('/settings/teams')
    revalidatePath('/employees')
    return { ok: true, id: team.id }
  } catch (err) {
    console.error('createTeamAction error:', err)
    return { ok: false, error: 'Could not create team. The name may already be taken.' }
  }
}

export async function updateTeamAction(
  id: string,
  data: {
    name?: string
    color?: string | null
    rotationAnchorDate?: string
    rotationLength?: number
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdmin()
  if ('ok' in guard && !guard.ok) return guard
  const { orgId } = guard as { orgId: string; userId: string }

  if (!isValidId(id)) return { ok: false, error: 'Invalid team id.' }
  if (data.name !== undefined) {
    const name = data.name.trim()
    if (!name) return { ok: false, error: 'Team name is required.' }
    if (name.length > 80) return { ok: false, error: 'Name too long (max 80 chars).' }
    data.name = name
  }
  if (data.rotationAnchorDate !== undefined && !isValidDate(data.rotationAnchorDate)) {
    return { ok: false, error: 'Rotation anchor date must be a valid YYYY-MM-DD date.' }
  }
  if (data.rotationLength !== undefined) {
    if (!Number.isInteger(data.rotationLength) || data.rotationLength < 1 || data.rotationLength > 52) {
      return { ok: false, error: 'Rotation length must be between 1 and 52 weeks.' }
    }
  }

  try {
    await updateTeam(id, orgId, data)
    revalidatePath('/settings/teams')
    revalidatePath('/planning')
    return { ok: true }
  } catch (err) {
    console.error('updateTeamAction error:', err)
    return { ok: false, error: 'Could not update team. The name may already be taken.' }
  }
}

export async function deleteTeamAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdmin()
  if ('ok' in guard && !guard.ok) return guard
  const { orgId } = guard as { orgId: string; userId: string }

  if (!isValidId(id)) return { ok: false, error: 'Invalid team id.' }

  try {
    await deleteTeam(id, orgId)
    revalidatePath('/settings/teams')
    revalidatePath('/employees')
    revalidatePath('/planning')
    return { ok: true }
  } catch (err) {
    console.error('deleteTeamAction error:', err)
    return { ok: false, error: 'Could not delete team. Please try again.' }
  }
}

export async function setTeamRotationSlotsAction(
  teamId: string,
  slots: { weekOffset: number; shiftTemplateId: string }[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdmin()
  if ('ok' in guard && !guard.ok) return guard
  const { orgId } = guard as { orgId: string; userId: string }

  if (!isValidId(teamId)) return { ok: false, error: 'Invalid team id.' }
  for (const s of slots) {
    if (!Number.isInteger(s.weekOffset) || s.weekOffset < 0) {
      return { ok: false, error: 'Invalid week offset in rotation slots.' }
    }
    if (!isValidId(s.shiftTemplateId)) {
      return { ok: false, error: 'Invalid shift template id in rotation slots.' }
    }
  }

  try {
    await setTeamRotationSlots(teamId, orgId, slots)
    revalidatePath('/settings/teams')
    revalidatePath('/planning')
    return { ok: true }
  } catch (err) {
    console.error('setTeamRotationSlotsAction error:', err)
    return { ok: false, error: 'Could not save rotation schedule. Please try again.' }
  }
}
