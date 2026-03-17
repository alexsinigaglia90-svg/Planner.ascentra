'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { createEmployee } from '@/lib/queries/employees'
import { getCurrentContext, canMutate } from '@/lib/auth/context'
import { resolveEmployeeType, resolveFixedWorkingDays } from '@/lib/import/employeeImport'

export type BulkImportRow = {
  name: string
  /** Canonical employee type resolved by the client before submission. */
  employeeType: 'internal' | 'temp'
  /** ID of an existing Department in the org. */
  mainDepartmentId: string
  /** ID of an existing EmployeeFunction in the org. */
  functionId: string
  teamId: string | null
  /** Optional ID of an existing Location in the org. */
  locationId?: string | null
  /** Contract hours per week (e.g. 40). Defaults to 0 when not provided. */
  contractHours?: number
  /** Optional fixed working days, already validated + normalised client-side. */
  fixedWorkingDays?: string[]
  /** Skill IDs to link (EmployeeSkill records). */
  skillIds?: string[]
}

export type BulkImportResult =
  | { ok: true; created: number; skipped: number; entitiesCreated?: number; skillsLinked?: number }
  | { ok: false; error: string }

/** Create entities that don't exist yet (departments, functions, skills, locations). */
export type EntityToCreate = {
  type: 'department' | 'function' | 'skill' | 'location'
  name: string
}

export async function createEntitiesAction(
  entities: EntityToCreate[],
): Promise<{ ok: true; created: Record<string, string> } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }

  const created: Record<string, string> = {} // name → id

  for (const entity of entities) {
    const name = entity.name.trim()
    if (!name) continue
    const key = `${entity.type}:${name.toLowerCase()}`

    try {
      switch (entity.type) {
        case 'department': {
          const existing = await prisma.department.findFirst({
            where: { organizationId: orgId, name: { equals: name, mode: 'insensitive' } },
          })
          if (existing) { created[key] = existing.id; break }
          const dept = await prisma.department.create({
            data: { organizationId: orgId, name },
          })
          created[key] = dept.id
          break
        }
        case 'function': {
          const existing = await prisma.employeeFunction.findFirst({
            where: { organizationId: orgId, name: { equals: name, mode: 'insensitive' } },
          })
          if (existing) { created[key] = existing.id; break }
          const fn = await prisma.employeeFunction.create({
            data: { organizationId: orgId, name, overhead: false },
          })
          created[key] = fn.id
          break
        }
        case 'skill': {
          const existing = await prisma.skill.findFirst({
            where: { organizationId: orgId, name: { equals: name, mode: 'insensitive' } },
          })
          if (existing) { created[key] = existing.id; break }
          const skill = await prisma.skill.create({
            data: { organizationId: orgId, name },
          })
          created[key] = skill.id
          break
        }
        case 'location': {
          const existing = await prisma.location.findFirst({
            where: { organizationId: orgId, name: { equals: name, mode: 'insensitive' } },
          })
          if (existing) { created[key] = existing.id; break }
          const loc = await prisma.location.create({
            data: { organizationId: orgId, name },
          })
          created[key] = loc.id
          break
        }
      }
    } catch (err) {
      console.error(`[import] Failed to create ${entity.type} "${name}":`, err)
    }
  }

  revalidatePath('/workforce/employees')
  revalidatePath('/settings/masterdata')
  return { ok: true, created }
}

export async function bulkImportEmployeesAction(
  rows: BulkImportRow[],
): Promise<BulkImportResult> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }

  const validRows = rows.filter((r) => r.name.trim().length > 0)
  if (validRows.length === 0) return { ok: false, error: 'No valid rows to import.' }

  // ── Server-side validation (defense in depth) ─────────────────────────────

  // Load all department and function IDs in one query each — no N+1
  const [orgDepts, orgFns, orgLocations] = await Promise.all([
    prisma.department.findMany({ where: { organizationId: orgId }, select: { id: true } }),
    prisma.employeeFunction.findMany({ where: { organizationId: orgId }, select: { id: true } }),
    prisma.location.findMany({ where: { organizationId: orgId }, select: { id: true } }),
  ])
  const validDeptIds = new Set(orgDepts.map((d) => d.id))
  const validFnIds = new Set(orgFns.map((f) => f.id))
  const validLocationIds = new Set(orgLocations.map((l) => l.id))

  for (const row of validRows) {
    if (resolveEmployeeType(row.employeeType) === null) {
      return { ok: false, error: `Invalid employee type: "${row.employeeType}".` }
    }
    if (!validDeptIds.has(row.mainDepartmentId)) {
      return { ok: false, error: `Department not found (id: ${row.mainDepartmentId}). It may have been deleted.` }
    }
    if (!validFnIds.has(row.functionId)) {
      return { ok: false, error: `Function not found (id: ${row.functionId}). It may have been deleted.` }
    }
    if (row.locationId != null && !validLocationIds.has(row.locationId)) {
      return { ok: false, error: `Location not found (id: ${row.locationId}). It may have been deleted.` }
    }
    // Server-side guard: re-validate fixedWorkingDays if provided as a raw string array
    if (row.fixedWorkingDays !== undefined) {
      for (const day of row.fixedWorkingDays) {
        if (resolveFixedWorkingDays(day) === null) {
          return { ok: false, error: `Invalid fixed working day value: "${day}".` }
        }
      }
    }
  }

  // ── Duplicate detection ────────────────────────────────────────────────────

  const existingEmployees = await prisma.employee.findMany({
    where: { organizationId: orgId },
    select: { name: true },
  })
  const existingNames = new Set(existingEmployees.map((e) => e.name.toLowerCase().trim()))

  let created = 0
  let skipped = 0
  let skillsLinked = 0

  for (const row of validRows) {
    const name = row.name.trim()

    // Skip duplicates (case-insensitive)
    if (existingNames.has(name.toLowerCase())) {
      skipped++
      continue
    }

    // Placeholder email: unique per import row
    const email = `import-${crypto.randomUUID()}@placeholder`

    const emp = await createEmployee({
      organizationId: orgId,
      name,
      email,
      employeeType: row.employeeType,
      contractHours: row.contractHours ?? 0,
      status: 'active',
      functionId: row.functionId,
      mainDepartmentId: row.mainDepartmentId,
      ...(row.locationId != null ? { locationId: row.locationId } : {}),
      ...(row.fixedWorkingDays !== undefined ? { fixedWorkingDays: row.fixedWorkingDays } : {}),
    })

    if (row.teamId) {
      await prisma.employee.update({ where: { id: emp.id }, data: { teamId: row.teamId } })
    }

    // Link skills
    if (row.skillIds && row.skillIds.length > 0) {
      for (const skillId of row.skillIds) {
        try {
          await prisma.employeeSkill.create({
            data: { employeeId: emp.id, skillId },
          })
          skillsLinked++
        } catch {
          // Skip duplicates silently
        }
      }
    }

    existingNames.add(name.toLowerCase())
    created++
  }

  revalidatePath('/workforce/employees')
  revalidatePath('/employees')
  revalidatePath('/workforce/skills')

  return { ok: true, created, skipped, skillsLinked }
}

// ---------------------------------------------------------------------------
// Matrix import — skill matrix pivot table
// ---------------------------------------------------------------------------

export type MatrixImportRow = {
  name: string
  team?: string
  functionRaw?: string
  levels: { processName: string; level: number }[]
}

export type MatrixImportResult =
  | { ok: true; employeesMatched: number; employeesCreated: number; levelsSet: number; processesCreated: number }
  | { ok: false; error: string }

// ---------------------------------------------------------------------------
// Ultra-fast matrix import — 3 phases, raw SQL for bulk upsert
// ---------------------------------------------------------------------------

/** Phase 1: Create processes, return processIdMap */
export async function matrixImportStep1_Processes(
  processesToCreate: { name: string; group: string | null }[],
): Promise<{ ok: true; processIdMap: Record<string, string>; processesCreated: number } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }

  try {
    const processIdMap: Record<string, string> = {}
    const existingProcesses = await prisma.process.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, sortOrder: true },
    })
    for (const p of existingProcesses) processIdMap[p.name.toLowerCase()] = p.id

    // Batch-create new processes
    const toCreate = processesToCreate.filter((p) => !processIdMap[p.name.toLowerCase()])
    const nextSort = (existingProcesses.length > 0 ? Math.max(...existingProcesses.map((p) => p.sortOrder)) : -1) + 1

    if (toCreate.length > 0) {
      // Create all at once via transaction
      const created = await prisma.$transaction(
        toCreate.map((proc, i) => prisma.process.create({
          data: { organizationId: orgId, name: proc.name, sortOrder: nextSort + i },
        }))
      )
      for (const p of created) processIdMap[p.name.toLowerCase()] = p.id
    }

    return { ok: true, processIdMap, processesCreated: toCreate.length }
  } catch (err) {
    console.error('matrixImportStep1 error:', err)
    return { ok: false, error: 'Failed to create processes.' }
  }
}

/** Phase 2: Resolve/create all employees + set team/department/function */
export async function matrixImportStep2_Employees(
  rows: MatrixImportRow[],
): Promise<{ ok: true; employeeIdMap: Record<string, string>; employeesMatched: number; employeesCreated: number } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }

  try {
    // Load existing data in parallel
    const [existing, departments, functions, teams] = await Promise.all([
      prisma.employee.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
      prisma.department.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
      prisma.employeeFunction.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
      prisma.team.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
    ])

    const empByName = new Map(existing.map((e) => [e.name.toLowerCase().trim(), e.id]))
    const deptByName = new Map(departments.map((d) => [d.name.toLowerCase().trim(), d.id]))
    const fnByName = new Map(functions.map((f) => [f.name.toLowerCase().trim(), f.id]))
    const teamByName = new Map(teams.map((t) => [t.name.toLowerCase().trim(), t.id]))

    // Collect per-row metadata for team/dept/fn resolution
    const rowMeta = new Map<string, { team?: string; fn?: string }>()
    for (const row of rows) {
      const name = row.name.trim().toLowerCase()
      if (!name) continue
      rowMeta.set(name, { team: row.team?.trim(), fn: row.functionRaw?.trim() })
    }

    // Find names that need creation
    const namesToCreate: { name: string; deptId: string | null; fnId: string | null; teamId: string | null }[] = []
    const seen = new Set<string>()
    for (const row of rows) {
      const name = row.name.trim()
      if (!name) continue
      const key = name.toLowerCase()
      if (empByName.has(key) || seen.has(key)) continue
      seen.add(key)

      // Resolve team/dept/fn from the row data
      const teamVal = row.team?.trim().toLowerCase() ?? ''
      const fnVal = row.functionRaw?.trim().toLowerCase() ?? ''

      // "Team" column in skill matrices is usually a department (Inbound, Outbound, etc.)
      const deptId = deptByName.get(teamVal) ?? null
      const teamId = !deptId ? (teamByName.get(teamVal) ?? null) : null
      const fnId = fnByName.get(fnVal) ?? null

      namesToCreate.push({ name, deptId, fnId, teamId })
    }

    // Batch-create new employees via transaction
    if (namesToCreate.length > 0) {
      const created = await prisma.$transaction(
        namesToCreate.map((e) => prisma.employee.create({
          data: {
            organizationId: orgId,
            name: e.name,
            email: `import-${crypto.randomUUID()}@placeholder`,
            employeeType: 'internal',
            contractHours: 0,
            status: 'active',
            ...(e.deptId ? { departmentId: e.deptId } : {}),
            ...(e.fnId ? { functionId: e.fnId } : {}),
            ...(e.teamId ? { teamId: e.teamId } : {}),
          },
          select: { id: true, name: true },
        }))
      )
      for (const emp of created) empByName.set(emp.name.toLowerCase().trim(), emp.id)
    }

    // Also update existing employees with team/dept/fn if currently unset
    const updateOps: ReturnType<typeof prisma.employee.update>[] = []
    for (const row of rows) {
      const name = row.name.trim()
      if (!name) continue
      const key = name.toLowerCase()
      const empId = empByName.get(key)
      if (!empId) continue
      // Only for employees that already existed (not just created)
      if (seen.has(key)) continue

      const teamVal = row.team?.trim().toLowerCase() ?? ''
      const fnVal = row.functionRaw?.trim().toLowerCase() ?? ''
      const deptId = deptByName.get(teamVal) ?? null
      const teamId = !deptId ? (teamByName.get(teamVal) ?? null) : null
      const fnId = fnByName.get(fnVal) ?? null

      const update: Record<string, string> = {}
      if (deptId) update.departmentId = deptId
      if (teamId) update.teamId = teamId
      if (fnId) update.functionId = fnId

      if (Object.keys(update).length > 0) {
        updateOps.push(prisma.employee.update({ where: { id: empId }, data: update }))
      }
    }
    if (updateOps.length > 0) {
      await prisma.$transaction(updateOps)
    }

    // Build final map
    const employeeIdMap: Record<string, string> = {}
    for (const [name, id] of empByName) employeeIdMap[name] = id

    const employeesMatched = rows.filter((r) => r.name.trim() && existing.some((e) => e.name.toLowerCase().trim() === r.name.trim().toLowerCase())).length

    return { ok: true, employeeIdMap, employeesMatched, employeesCreated: namesToCreate.length }
  } catch (err) {
    console.error('matrixImportStep2 error:', err)
    return { ok: false, error: 'Failed to resolve employees.' }
  }
}

/** Phase 3: Bulk upsert ALL skill levels in batched transactions */
export async function matrixImportStep3_Levels(
  rows: MatrixImportRow[],
  processIdMap: Record<string, string>,
  employeeIdMap: Record<string, string>,
): Promise<{ ok: true; levelsSet: number } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }

  try {
    // Collect all upsert tuples
    const tuples: { employeeId: string; processId: string; level: number }[] = []

    for (const row of rows) {
      const name = row.name.trim()
      if (!name) continue
      const empId = employeeIdMap[name.toLowerCase()]
      if (!empId) continue

      for (const { processName, level } of row.levels) {
        const processId = processIdMap[processName.toLowerCase()]
        if (!processId) continue
        tuples.push({ employeeId: empId, processId, level: Math.max(0, Math.min(4, level)) })
      }
    }

    if (tuples.length === 0) return { ok: true, levelsSet: 0 }

    // Batched $transaction upserts — 200 per transaction for speed + reliability
    const CHUNK = 200
    for (let i = 0; i < tuples.length; i += CHUNK) {
      const chunk = tuples.slice(i, i + CHUNK)
      await prisma.$transaction(
        chunk.map((t) =>
          prisma.employeeProcessScore.upsert({
            where: { employeeId_processId: { employeeId: t.employeeId, processId: t.processId } },
            update: { level: t.level },
            create: { employeeId: t.employeeId, processId: t.processId, organizationId: orgId, score: 0, level: t.level },
          })
        )
      )
    }

    revalidatePath('/workforce/skills')
    revalidatePath('/workforce/employees')
    revalidatePath('/employees')

    return { ok: true, levelsSet: tuples.length }
  } catch (err) {
    console.error('matrixImportStep3 error:', err)
    return { ok: false, error: 'Failed to set skill levels.' }
  }
}

/** Legacy single-call action */
export async function matrixImportAction(
  rows: MatrixImportRow[],
  processesToCreate: { name: string; group: string | null }[],
): Promise<MatrixImportResult> {
  const step1 = await matrixImportStep1_Processes(processesToCreate)
  if (!step1.ok) return step1
  const step2 = await matrixImportStep2_Employees(rows)
  if (!step2.ok) return step2
  const step3 = await matrixImportStep3_Levels(rows, step1.processIdMap, step2.employeeIdMap)
  if (!step3.ok) return step3

  return {
    ok: true,
    employeesMatched: step2.employeesMatched,
    employeesCreated: step2.employeesCreated,
    levelsSet: step3.levelsSet,
    processesCreated: step1.processesCreated,
  }
}

// Keep old step names as aliases for the UI
export const matrixImportStep2_EmployeeBatch = matrixImportStep2_Employees
export async function matrixImportStep3_Finalize(): Promise<{ ok: true }> { return { ok: true } }

