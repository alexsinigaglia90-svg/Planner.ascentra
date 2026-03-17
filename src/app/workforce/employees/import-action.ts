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
// Chunked matrix import — 3-step pipeline with progress reporting
// ---------------------------------------------------------------------------

/** Step 1: Create processes, return processIdMap */
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

    let nextSort = (existingProcesses.length > 0 ? Math.max(...existingProcesses.map((p) => p.sortOrder)) : -1) + 1
    let processesCreated = 0

    for (const proc of processesToCreate) {
      const key = proc.name.toLowerCase()
      if (processIdMap[key]) continue
      const created = await prisma.process.create({
        data: { organizationId: orgId, name: proc.name, sortOrder: nextSort++ },
      })
      processIdMap[key] = created.id
      processesCreated++
    }

    return { ok: true, processIdMap, processesCreated }
  } catch (err) {
    console.error('matrixImportStep1 error:', err)
    return { ok: false, error: 'Failed to create processes.' }
  }
}

/** Step 2: Process a batch of employee rows (match/create + set levels) */
export async function matrixImportStep2_EmployeeBatch(
  rows: MatrixImportRow[],
  processIdMap: Record<string, string>,
): Promise<{ ok: true; employeesMatched: number; employeesCreated: number; levelsSet: number } | { ok: false; error: string }> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }

  let employeesMatched = 0
  let employeesCreated = 0
  let levelsSet = 0

  try {
    // Load existing employees for matching (single query)
    const existingEmployees = await prisma.employee.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
    })
    const empByName = new Map(existingEmployees.map((e) => [e.name.toLowerCase().trim(), e.id]))

    // Phase A: Resolve all employee IDs (create missing ones)
    const resolvedRows: { empId: string; levels: { processId: string; level: number }[] }[] = []

    for (const row of rows) {
      const name = row.name.trim()
      if (!name) continue

      let empId = empByName.get(name.toLowerCase())
      if (empId) {
        employeesMatched++
      } else {
        const emp = await createEmployee({
          organizationId: orgId,
          name,
          email: `import-${crypto.randomUUID()}@placeholder`,
          employeeType: 'internal',
          contractHours: 0,
          status: 'active',
        })
        empId = emp.id
        empByName.set(name.toLowerCase(), empId)
        employeesCreated++
      }

      const levels: { processId: string; level: number }[] = []
      for (const { processName, level } of row.levels) {
        const processId = processIdMap[processName.toLowerCase()]
        if (processId) levels.push({ processId, level: Math.max(0, Math.min(4, level)) })
      }
      resolvedRows.push({ empId, levels })
    }

    // Phase B: Batch upsert all levels in a single transaction with parallel operations
    const PARALLEL_CHUNK = 50
    const allUpserts = resolvedRows.flatMap((r) =>
      r.levels.map((l) => ({ employeeId: r.empId, processId: l.processId, level: l.level }))
    )

    for (let i = 0; i < allUpserts.length; i += PARALLEL_CHUNK) {
      const chunk = allUpserts.slice(i, i + PARALLEL_CHUNK)
      await prisma.$transaction(
        chunk.map((u) =>
          prisma.employeeProcessScore.upsert({
            where: { employeeId_processId: { employeeId: u.employeeId, processId: u.processId } },
            update: { level: u.level },
            create: { employeeId: u.employeeId, processId: u.processId, organizationId: orgId, score: 0, level: u.level },
          })
        )
      )
      levelsSet += chunk.length
    }

    return { ok: true, employeesMatched, employeesCreated, levelsSet }
  } catch (err) {
    console.error('matrixImportStep2 error:', err)
    return { ok: false, error: 'Failed to import employee batch.' }
  }
}

/** Step 3: Finalize — revalidate paths */
export async function matrixImportStep3_Finalize(): Promise<{ ok: true }> {
  revalidatePath('/workforce/skills')
  revalidatePath('/workforce/employees')
  revalidatePath('/employees')
  return { ok: true }
}

/** Legacy single-call action (kept for backward compat) */
export async function matrixImportAction(
  rows: MatrixImportRow[],
  processesToCreate: { name: string; group: string | null }[],
): Promise<MatrixImportResult> {
  const step1 = await matrixImportStep1_Processes(processesToCreate)
  if (!step1.ok) return step1

  const BATCH_SIZE = 25
  let totalMatched = 0, totalCreated = 0, totalLevels = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const step2 = await matrixImportStep2_EmployeeBatch(batch, step1.processIdMap)
    if (!step2.ok) return step2
    totalMatched += step2.employeesMatched
    totalCreated += step2.employeesCreated
    totalLevels += step2.levelsSet
  }

  await matrixImportStep3_Finalize()
  return { ok: true, employeesMatched: totalMatched, employeesCreated: totalCreated, levelsSet: totalLevels, processesCreated: step1.processesCreated }
}

