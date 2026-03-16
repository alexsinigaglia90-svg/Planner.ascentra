'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { getCurrentContext, canMutate, canApprove } from '@/lib/auth/context'
import { logAction } from '@/lib/audit'

// ── Types ───────────────────────────────────────────────────────────────────

export interface TempEmployee {
  id: string
  name: string
  email: string
  contractHours: number
  status: string
  department: string | null
  team: string | null
  location: string | null
  employeeFunction: string | null
  fixedWorkingDays: string[]
  assignmentCount: number
  createdAt: string
}

export interface AgencyToken {
  id: string
  token: string
  agencyName: string
  agencyEmail: string | null
  expiresAt: string
  usedAt: string | null
  uploadedCount: number | null
  createdByName: string
  notes: string | null
  createdAt: string
}

export interface TempStats {
  total: number
  active: number
  inactive: number
  withAssignments: number
  avgContractHours: number
  departments: { name: string; count: number }[]
}

// ── Queries ─────────────────────────────────────────────────────────────────

export async function getTempEmployees(): Promise<TempEmployee[]> {
  const { orgId } = await getCurrentContext()
  const employees = await prisma.employee.findMany({
    where: { organizationId: orgId, employeeType: 'temp' },
    include: {
      department: { select: { name: true } },
      team: { select: { name: true } },
      location: { select: { name: true } },
      employeeFunction: { select: { name: true } },
      _count: { select: { assignments: true } },
    },
    orderBy: { name: 'asc' },
  })

  return employees.map((e) => ({
    id: e.id,
    name: e.name,
    email: e.email,
    contractHours: e.contractHours,
    status: e.status,
    department: e.department?.name ?? null,
    team: e.team?.name ?? null,
    location: e.location?.name ?? null,
    employeeFunction: e.employeeFunction?.name ?? null,
    fixedWorkingDays: e.fixedWorkingDays,
    assignmentCount: e._count.assignments,
    createdAt: e.createdAt.toISOString(),
  }))
}

export async function getTempStats(): Promise<TempStats> {
  const { orgId } = await getCurrentContext()
  const temps = await prisma.employee.findMany({
    where: { organizationId: orgId, employeeType: 'temp' },
    select: { status: true, contractHours: true, department: { select: { name: true } }, _count: { select: { assignments: true } } },
  })

  const active = temps.filter((t) => t.status === 'active')
  const deptMap = new Map<string, number>()
  for (const t of temps) {
    const d = t.department?.name ?? 'Geen afdeling'
    deptMap.set(d, (deptMap.get(d) ?? 0) + 1)
  }

  return {
    total: temps.length,
    active: active.length,
    inactive: temps.length - active.length,
    withAssignments: temps.filter((t) => t._count.assignments > 0).length,
    avgContractHours: active.length > 0 ? Math.round(active.reduce((s, t) => s + t.contractHours, 0) / active.length) : 0,
    departments: [...deptMap.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
  }
}

// ── Create single temp ──────────────────────────────────────────────────────

export async function createTempAction(input: {
  name: string
  email?: string
  contractHours: number
  departmentId?: string
  functionId?: string
  locationId?: string
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'Geen toegang.' }

  try {
    const email = input.email?.trim() || `temp-${randomBytes(6).toString('hex')}@placeholder`
    const emp = await prisma.employee.create({
      data: {
        organizationId: orgId,
        name: input.name.trim(),
        email,
        employeeType: 'temp',
        contractHours: Math.max(0, input.contractHours),
        status: 'active',
        departmentId: input.departmentId || null,
        functionId: input.functionId || null,
        locationId: input.locationId || null,
      },
    })

    await logAction({
      organizationId: orgId, userId,
      actionType: 'create_assignment', entityType: 'bulk', entityId: emp.id,
      summary: `Temp medewerker aangemaakt: ${input.name}`,
    })

    revalidatePath('/workforce/temps')
    revalidatePath('/workforce/employees')
    return { ok: true, id: emp.id }
  } catch (err) {
    console.error('createTempAction error:', err)
    return { ok: false, error: 'Kon temp niet aanmaken.' }
  }
}

// ── Bulk import temps ───────────────────────────────────────────────────────

export interface TempImportRow {
  name: string
  email?: string
  contractHours?: number
  department?: string
  function?: string
  location?: string
}

export async function bulkImportTempsAction(
  rows: TempImportRow[],
): Promise<{ ok: true; created: number; skipped: number } | { ok: false; error: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'Geen toegang.' }

  try {
    // Load lookup tables
    const [departments, functions, locations] = await Promise.all([
      prisma.department.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
      prisma.employeeFunction.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
      prisma.location.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
    ])

    const deptMap = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]))
    const funcMap = new Map(functions.map((f) => [f.name.toLowerCase(), f.id]))
    const locMap = new Map(locations.map((l) => [l.name.toLowerCase(), l.id]))

    // Existing names for dedup
    const existing = await prisma.employee.findMany({
      where: { organizationId: orgId, employeeType: 'temp' },
      select: { name: true },
    })
    const existingNames = new Set(existing.map((e) => e.name.toLowerCase()))

    let created = 0
    let skipped = 0

    for (const row of rows) {
      const name = row.name?.trim()
      if (!name) { skipped++; continue }
      if (existingNames.has(name.toLowerCase())) { skipped++; continue }

      const email = row.email?.trim() || `temp-${randomBytes(6).toString('hex')}@placeholder`

      await prisma.employee.create({
        data: {
          organizationId: orgId,
          name,
          email,
          employeeType: 'temp',
          contractHours: row.contractHours ?? 0,
          status: 'active',
          departmentId: row.department ? deptMap.get(row.department.toLowerCase()) ?? null : null,
          functionId: row.function ? funcMap.get(row.function.toLowerCase()) ?? null : null,
          locationId: row.location ? locMap.get(row.location.toLowerCase()) ?? null : null,
        },
      })
      existingNames.add(name.toLowerCase())
      created++
    }

    await logAction({
      organizationId: orgId, userId,
      actionType: 'create_assignment', entityType: 'bulk', entityId: 'bulk-temp-import',
      summary: `Bulk temp import: ${created} aangemaakt, ${skipped} overgeslagen`,
    })

    revalidatePath('/workforce/temps')
    revalidatePath('/workforce/employees')
    return { ok: true, created, skipped }
  } catch (err) {
    console.error('bulkImportTempsAction error:', err)
    return { ok: false, error: 'Import mislukt.' }
  }
}

// ── Agency upload tokens ────────────────────────────────────────────────────

export async function getAgencyTokens(): Promise<AgencyToken[]> {
  const { orgId } = await getCurrentContext()
  const tokens = await prisma.agencyUploadToken.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
  })
  return tokens.map((t) => ({
    id: t.id,
    token: t.token,
    agencyName: t.agencyName,
    agencyEmail: t.agencyEmail,
    expiresAt: t.expiresAt.toISOString(),
    usedAt: t.usedAt?.toISOString() ?? null,
    uploadedCount: t.uploadedCount,
    createdByName: t.createdByName,
    notes: t.notes,
    createdAt: t.createdAt.toISOString(),
  }))
}

export async function createAgencyTokenAction(input: {
  agencyName: string
  agencyEmail?: string
  expiresInDays: number
  notes?: string
}): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canApprove(role)) return { ok: false, error: 'Alleen managers en admins mogen upload links aanmaken.' }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + input.expiresInDays * 86400000)

    await prisma.agencyUploadToken.create({
      data: {
        organizationId: orgId,
        token,
        agencyName: input.agencyName.trim(),
        agencyEmail: input.agencyEmail?.trim() || null,
        expiresAt,
        createdBy: userId,
        createdByName: user?.name ?? 'Onbekend',
        notes: input.notes?.trim() || null,
      },
    })

    await logAction({
      organizationId: orgId, userId,
      actionType: 'ai_action', entityType: 'bulk', entityId: token,
      summary: `Agency upload link aangemaakt voor ${input.agencyName} (verloopt: ${expiresAt.toISOString().slice(0, 10)})`,
    })

    revalidatePath('/workforce/temps')
    return { ok: true, token }
  } catch (err) {
    console.error('createAgencyTokenAction error:', err)
    return { ok: false, error: 'Kon link niet aanmaken.' }
  }
}

export async function revokeAgencyTokenAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canApprove(role)) return { ok: false, error: 'Geen toegang.' }

  try {
    await prisma.agencyUploadToken.delete({ where: { id, organizationId: orgId } })
    revalidatePath('/workforce/temps')
    return { ok: true }
  } catch {
    return { ok: false, error: 'Kon link niet intrekken.' }
  }
}

// ── Public agency upload (no auth required — token-based) ───────────────────

export async function agencyUploadAction(
  token: string,
  rows: TempImportRow[],
): Promise<{ ok: true; created: number; skipped: number; orgName: string } | { ok: false; error: string }> {
  // Validate token
  const record = await prisma.agencyUploadToken.findUnique({ where: { token } })
  if (!record) return { ok: false, error: 'Ongeldige upload link.' }
  if (record.expiresAt < new Date()) return { ok: false, error: 'Deze upload link is verlopen.' }
  if (record.usedAt) return { ok: false, error: 'Deze upload link is al gebruikt.' }

  const orgId = record.organizationId
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } })

  // Load lookup tables
  const [departments, functions, locations] = await Promise.all([
    prisma.department.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
    prisma.employeeFunction.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
    prisma.location.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
  ])

  const deptMap = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]))
  const funcMap = new Map(functions.map((f) => [f.name.toLowerCase(), f.id]))
  const locMap = new Map(locations.map((l) => [l.name.toLowerCase(), l.id]))

  const existing = await prisma.employee.findMany({
    where: { organizationId: orgId, employeeType: 'temp' },
    select: { name: true },
  })
  const existingNames = new Set(existing.map((e) => e.name.toLowerCase()))

  let created = 0
  let skipped = 0

  for (const row of rows) {
    const name = row.name?.trim()
    if (!name) { skipped++; continue }
    if (existingNames.has(name.toLowerCase())) { skipped++; continue }

    const email = row.email?.trim() || `agency-${randomBytes(6).toString('hex')}@placeholder`

    await prisma.employee.create({
      data: {
        organizationId: orgId,
        name,
        email,
        employeeType: 'temp',
        contractHours: row.contractHours ?? 0,
        status: 'active',
        departmentId: row.department ? deptMap.get(row.department.toLowerCase()) ?? null : null,
        functionId: row.function ? funcMap.get(row.function.toLowerCase()) ?? null : null,
        locationId: row.location ? locMap.get(row.location.toLowerCase()) ?? null : null,
      },
    })
    existingNames.add(name.toLowerCase())
    created++
  }

  // Mark token as used
  await prisma.agencyUploadToken.update({
    where: { id: record.id },
    data: { usedAt: new Date(), uploadedCount: created },
  })

  return { ok: true, created, skipped, orgName: org?.name ?? 'Organisatie' }
}

// ── Deactivate / delete temps ───────────────────────────────────────────────

export async function deactivateTempAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'Geen toegang.' }
  await prisma.employee.update({ where: { id, organizationId: orgId }, data: { status: 'inactive' } })
  revalidatePath('/workforce/temps')
  return { ok: true }
}

export async function activateTempAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'Geen toegang.' }
  await prisma.employee.update({ where: { id, organizationId: orgId }, data: { status: 'active' } })
  revalidatePath('/workforce/temps')
  return { ok: true }
}
