'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { getCurrentContext, canMutate } from '@/lib/auth/context'

function isValidId(s: unknown): s is string {
  return typeof s === 'string' && s.trim().length >= 10
}

// ---------------------------------------------------------------------------
// Process management
// ---------------------------------------------------------------------------

export async function createProcessAction(
  name: string,
  color: string | null,
  output?: { normUnit: string; normPerHour: number } | null,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'Insufficient permissions.' }
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'Process name is required.' }
  if (trimmed.length > 80) return { ok: false, error: 'Name too long (max 80 chars).' }

  try {
    // Sort order: next after current max
    const last = await prisma.process.findFirst({
      where: { organizationId: orgId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })
    const sortOrder = (last?.sortOrder ?? -1) + 1

    const process = await prisma.process.create({
      data: {
        organizationId: orgId,
        name: trimmed,
        color: color ?? null,
        sortOrder,
        ...(output ? { normUnit: output.normUnit, normPerHour: output.normPerHour } : {}),
      },
    })
    revalidatePath('/workforce/skills')
    return { ok: true, id: process.id }
  } catch (err: unknown) {
    const e = err as { code?: string }
    if (e?.code === 'P2002') return { ok: false, error: 'A process with that name already exists.' }
    console.error('createProcessAction error:', err)
    return { ok: false, error: 'Could not create process. Please try again.' }
  }
}

export async function updateProcessAction(
  processId: string,
  data: { name?: string; color?: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'Insufficient permissions.' }
  if (!isValidId(processId)) return { ok: false, error: 'Invalid process id.' }

  try {
    const process = await prisma.process.findFirst({
      where: { id: processId, organizationId: orgId },
      select: { id: true },
    })
    if (!process) return { ok: false, error: 'Process not found.' }

    const update: Record<string, unknown> = {}
    if (data.name !== undefined) {
      const trimmed = data.name.trim()
      if (!trimmed) return { ok: false, error: 'Process name is required.' }
      if (trimmed.length > 80) return { ok: false, error: 'Name too long (max 80 chars).' }
      update.name = trimmed
    }
    if (data.color !== undefined) update.color = data.color

    await prisma.process.update({ where: { id: processId }, data: update })
    revalidatePath('/workforce/skills')
    return { ok: true }
  } catch (err: unknown) {
    const e = err as { code?: string }
    if (e?.code === 'P2002') return { ok: false, error: 'A process with that name already exists.' }
    console.error('updateProcessAction error:', err)
    return { ok: false, error: 'Could not update process. Please try again.' }
  }
}

export async function deleteProcessAction(
  processId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'Insufficient permissions.' }
  if (!isValidId(processId)) return { ok: false, error: 'Invalid process id.' }

  try {
    // Verify ownership
    const process = await prisma.process.findFirst({
      where: { id: processId, organizationId: orgId },
      select: { id: true },
    })
    if (!process) return { ok: false, error: 'Process not found.' }

    await prisma.process.delete({ where: { id: processId } })
    revalidatePath('/workforce/skills')
    return { ok: true }
  } catch (err) {
    console.error('deleteProcessAction error:', err)
    return { ok: false, error: 'Could not delete process. Please try again.' }
  }
}

// ---------------------------------------------------------------------------
// Score upsert — used by both the matrix cell edit and the detail panel
// ---------------------------------------------------------------------------

export async function upsertProcessScoreAction(
  employeeId: string,
  processId: string,
  score: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'Insufficient permissions.' }
  if (!isValidId(employeeId) || !isValidId(processId)) {
    return { ok: false, error: 'Invalid data.' }
  }
  const clamped = Math.round(Math.max(0, Math.min(100, score)))

  try {
    // Verify the employee and process both belong to this org
    const [emp, proc] = await Promise.all([
      prisma.employee.findFirst({ where: { id: employeeId, organizationId: orgId }, select: { id: true } }),
      prisma.process.findFirst({ where: { id: processId, organizationId: orgId }, select: { id: true } }),
    ])
    if (!emp) return { ok: false, error: 'Employee not found.' }
    if (!proc) return { ok: false, error: 'Process not found.' }

    await prisma.employeeProcessScore.upsert({
      where: { employeeId_processId: { employeeId, processId } },
      update: { score: clamped },
      create: { employeeId, processId, organizationId: orgId, score: clamped },
    })

    revalidatePath('/workforce/skills')
    revalidatePath('/workforce/employees')
    return { ok: true }
  } catch (err) {
    console.error('upsertProcessScoreAction error:', err)
    return { ok: false, error: 'Could not save score. Please try again.' }
  }
}

// ---------------------------------------------------------------------------
// Level upsert — capability ring system (0–4)
// ---------------------------------------------------------------------------

export async function upsertProcessLevelAction(
  employeeId: string,
  processId: string,
  level: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'Insufficient permissions.' }
  if (!isValidId(employeeId) || !isValidId(processId)) {
    return { ok: false, error: 'Invalid data.' }
  }
  const clamped = Math.round(Math.max(0, Math.min(4, level)))

  try {
    const [emp, proc] = await Promise.all([
      prisma.employee.findFirst({ where: { id: employeeId, organizationId: orgId }, select: { id: true } }),
      prisma.process.findFirst({ where: { id: processId, organizationId: orgId }, select: { id: true } }),
    ])
    if (!emp) return { ok: false, error: 'Employee not found.' }
    if (!proc) return { ok: false, error: 'Process not found.' }

    await prisma.employeeProcessScore.upsert({
      where: { employeeId_processId: { employeeId, processId } },
      update: { level: clamped },
      create: { employeeId, processId, organizationId: orgId, score: 0, level: clamped },
    })

    revalidatePath('/workforce/skills')
    revalidatePath('/workforce/employees')
    return { ok: true }
  } catch (err) {
    console.error('upsertProcessLevelAction error:', err)
    return { ok: false, error: 'Could not save capability level. Please try again.' }
  }
}
