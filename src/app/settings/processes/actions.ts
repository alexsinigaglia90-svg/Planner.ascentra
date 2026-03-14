'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/auth/context'
import { prisma } from '@/lib/db/client'
import { createProcessRecord, updateProcessRecord, type ProcessDetailRow } from '@/lib/queries/processes'

async function requireAdmin(): Promise<
  { orgId: string } | { ok: false; error: string }
> {
  const ctx = await getCurrentContext()
  if (ctx.role !== 'admin') return { ok: false, error: 'Only administrators may manage processes.' }
  return { orgId: ctx.orgId }
}

function isValidId(s: unknown): s is string {
  return typeof s === 'string' && s.trim().length >= 10
}

export async function createProcessAction(input: {
  name: string
  departmentId: string | null
  normUnit: string | null
  normPerHour: number | null
  minStaff: number | null
  maxStaff: number | null
  requiredSkillId: string | null
  active: boolean
}): Promise<{ ok: true; process: ProcessDetailRow } | { ok: false; error: string }> {
  const guard = await requireAdmin()
  if ('ok' in guard && !guard.ok) return guard
  const { orgId } = guard as { orgId: string }

  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Process name is required.' }
  if (name.length > 120) return { ok: false, error: 'Name too long (max 120 chars).' }

  if (input.normPerHour !== null && (input.normPerHour <= 0 || !Number.isFinite(input.normPerHour))) {
    return { ok: false, error: 'Output per hour must be a positive number.' }
  }
  if (input.minStaff !== null && input.minStaff < 0) {
    return { ok: false, error: 'Minimum staffing cannot be negative.' }
  }
  if (input.maxStaff !== null && input.maxStaff < 0) {
    return { ok: false, error: 'Maximum staffing cannot be negative.' }
  }
  if (input.minStaff !== null && input.maxStaff !== null && input.minStaff > input.maxStaff) {
    return { ok: false, error: 'Minimum staffing cannot exceed maximum staffing.' }
  }

  // Validate department and skill belong to this org
  if (input.departmentId) {
    const dept = await prisma.department.findFirst({ where: { id: input.departmentId, organizationId: orgId } })
    if (!dept) return { ok: false, error: 'Selected department not found.' }
  }
  if (input.requiredSkillId) {
    const skill = await prisma.skill.findFirst({ where: { id: input.requiredSkillId, organizationId: orgId } })
    if (!skill) return { ok: false, error: 'Selected skill not found.' }
  }

  try {
    const process = await createProcessRecord({
      organizationId: orgId,
      name,
      departmentId: input.departmentId,
      normUnit: input.normUnit,
      normPerHour: input.normPerHour,
      minStaff: input.minStaff,
      maxStaff: input.maxStaff,
      requiredSkillId: input.requiredSkillId,
      active: input.active,
    })
    revalidatePath('/settings/processes')
    revalidatePath('/workforce/skills')
    return { ok: true, process }
  } catch (err) {
    console.error('[createProcessAction] Error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Unique constraint')) {
      return { ok: false, error: 'A process with this name already exists.' }
    }
    return { ok: false, error: 'Could not create process. Please try again.' }
  }
}

export async function deleteProcessAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdmin()
  if ('ok' in guard && !guard.ok) return guard
  const { orgId } = guard as { orgId: string }

  if (!isValidId(id)) return { ok: false, error: 'Invalid process ID.' }

  const existing = await prisma.process.findFirst({ where: { id, organizationId: orgId } })
  if (!existing) return { ok: false, error: 'Process not found.' }

  try {
    await prisma.process.delete({ where: { id } })
    revalidatePath('/settings/processes')
    revalidatePath('/workforce/skills')
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not delete process. Please try again.' }
  }
}

export async function updateProcessAction(
  id: string,
  input: {
    name: string
    departmentId: string | null
    normUnit: string | null
    normPerHour: number | null
    minStaff: number | null
    maxStaff: number | null
    requiredSkillId: string | null
    active: boolean
  },
): Promise<{ ok: true; process: ProcessDetailRow } | { ok: false; error: string }> {
  const guard = await requireAdmin()
  if ('ok' in guard && !guard.ok) return guard
  const { orgId } = guard as { orgId: string }

  if (!isValidId(id)) return { ok: false, error: 'Invalid process ID.' }

  const existing = await prisma.process.findFirst({ where: { id, organizationId: orgId } })
  if (!existing) return { ok: false, error: 'Process not found.' }

  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Process name is required.' }
  if (name.length > 120) return { ok: false, error: 'Name too long (max 120 chars).' }

  if (input.normPerHour !== null && (input.normPerHour <= 0 || !Number.isFinite(input.normPerHour))) {
    return { ok: false, error: 'Output per hour must be a positive number.' }
  }
  if (input.minStaff !== null && input.minStaff < 0) {
    return { ok: false, error: 'Minimum staffing cannot be negative.' }
  }
  if (input.maxStaff !== null && input.maxStaff < 0) {
    return { ok: false, error: 'Maximum staffing cannot be negative.' }
  }
  if (input.minStaff !== null && input.maxStaff !== null && input.minStaff > input.maxStaff) {
    return { ok: false, error: 'Minimum staffing cannot exceed maximum staffing.' }
  }

  if (input.departmentId) {
    const dept = await prisma.department.findFirst({ where: { id: input.departmentId, organizationId: orgId } })
    if (!dept) return { ok: false, error: 'Selected department not found.' }
  }
  if (input.requiredSkillId) {
    const skill = await prisma.skill.findFirst({ where: { id: input.requiredSkillId, organizationId: orgId } })
    if (!skill) return { ok: false, error: 'Selected skill not found.' }
  }

  try {
    const process = await updateProcessRecord({
      id,
      organizationId: orgId,
      name,
      departmentId: input.departmentId,
      normUnit: input.normUnit,
      normPerHour: input.normPerHour,
      minStaff: input.minStaff,
      maxStaff: input.maxStaff,
      requiredSkillId: input.requiredSkillId,
      active: input.active,
    })
    revalidatePath('/settings/processes')
    revalidatePath('/workforce/skills')
    return { ok: true, process }
  } catch (err) {
    console.error('[updateProcessAction] Error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Unique constraint')) {
      return { ok: false, error: 'A process with this name already exists.' }
    }
    return { ok: false, error: 'Could not update process. Please try again.' }
  }
}
