'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { createEmployee } from '@/lib/queries/employees'
import { createTeam } from '@/lib/queries/teams'
import { getCurrentContext, canMutate } from '@/lib/auth/context'

export type BulkImportRow = {
  name: string
  teamName: string
}

export type BulkImportResult =
  | { ok: true; created: number; skipped: number; teamsCreated: number }
  | { ok: false; error: string }

export async function bulkImportEmployeesAction(
  rows: BulkImportRow[],
): Promise<BulkImportResult> {
  const { orgId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'You do not have permission.' }

  const validRows = rows.filter((r) => r.name.trim().length > 0)
  if (validRows.length === 0) return { ok: false, error: 'No valid rows to import.' }

  // Fetch existing employee names for duplicate detection
  const existingEmployees = await prisma.employee.findMany({
    where: { organizationId: orgId },
    select: { name: true },
  })
  const existingNames = new Set(existingEmployees.map((e) => e.name.toLowerCase().trim()))

  // Fetch existing teams for name → id resolution
  const existingTeams = await prisma.team.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true },
  })
  const teamMap = new Map<string, string>() // lowercase name → id
  for (const t of existingTeams) {
    teamMap.set(t.name.toLowerCase().trim(), t.id)
  }

  let created = 0
  let skipped = 0
  let teamsCreated = 0

  for (const row of validRows) {
    const name = row.name.trim()

    // Skip duplicates (case-insensitive)
    if (existingNames.has(name.toLowerCase())) {
      skipped++
      continue
    }

    // Resolve team
    let teamId: string | null = null
    const rawTeamName = row.teamName.trim()
    if (rawTeamName) {
      const key = rawTeamName.toLowerCase()
      if (teamMap.has(key)) {
        teamId = teamMap.get(key)!
      } else {
        // Create team with safe defaults
        const newTeam = await createTeam({
          organizationId: orgId,
          name: rawTeamName,
          rotationAnchorDate: new Date().toISOString().split('T')[0],
          rotationLength: 1,
        })
        teamMap.set(key, newTeam.id)
        teamId = newTeam.id
        teamsCreated++
      }
    }

    // Placeholder email: unique per import row
    const email = `import-${crypto.randomUUID()}@placeholder`

    const emp = await createEmployee({
      organizationId: orgId,
      name,
      email,
      employeeType: 'internal',
      contractHours: 40,
      status: 'active',
    })

    if (teamId) {
      await prisma.employee.update({ where: { id: emp.id }, data: { teamId } })
    }

    existingNames.add(name.toLowerCase()) // prevent dupes within the same batch
    created++
  }

  revalidatePath('/workforce/employees')
  revalidatePath('/employees')

  return { ok: true, created, skipped, teamsCreated }
}
