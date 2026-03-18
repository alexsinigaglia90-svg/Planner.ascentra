import { getAssignments } from '@/lib/queries/assignments'
import { getEmployeesForPlanning } from '@/lib/queries/employees'
import { getShiftTemplates } from '@/lib/queries/shiftTemplates'
import { getShiftRequirements } from '@/lib/queries/shiftRequirements'
import { getLocations, getDepartmentsWithHierarchy } from '@/lib/queries/locations'
import { getEmployeeTeamMap } from '@/lib/queries/teams'
import { getProcessShiftLinks } from '@/lib/queries/processShiftLinks'
import { prisma } from '@/lib/db/client'
import { checkTeamRotationViolation } from '@/lib/teams'
import { computeDemandTargets } from '@/lib/demandBridge'
import { getCurrentContext } from '@/lib/auth/context'
import PlanningView from '@/components/planning/PlanningView'
import AscentrAIBar from '@/components/AscentrAIBar'

export default async function PlanningPage() {
  const { orgId, role } = await getCurrentContext()
  const [assignments, employees, templates, requirements, locations, departments, employeeTeamMap, processes, processScores, processShiftLinks, volumeForecasts] = await Promise.all([
    getAssignments(orgId),
    getEmployeesForPlanning(orgId),
    getShiftTemplates(orgId),
    getShiftRequirements(orgId),
    getLocations(orgId),
    getDepartmentsWithHierarchy(orgId),
    getEmployeeTeamMap(orgId),
    prisma.process.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, departmentId: true, active: true, normUnit: true, normPerHour: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.employeeProcessScore.findMany({
      where: { organizationId: orgId },
      select: { employeeId: true, processId: true, level: true },
    }),
    getProcessShiftLinks(orgId),
    prisma.volumeForecast.findMany({
      where: { organizationId: orgId },
      select: { processId: true, date: true, volume: true, confidence: true, source: true },
    }),
  ])

  // Attach process scores to employees for Plan Wizard training mode
  const scoresByEmployee = new Map<string, { processId: string; level: number }[]>()
  for (const s of processScores) {
    const list = scoresByEmployee.get(s.employeeId) ?? []
    list.push({ processId: s.processId, level: s.level })
    scoresByEmployee.set(s.employeeId, list)
  }
  const employeesWithScores = employees.map((e) => ({
    ...e,
    processScores: scoresByEmployee.get(e.id) ?? [],
  }))

  // Compute which assignment IDs violate their employee's team rotation
  const rotationViolationIds = new Set<string>()
  for (const a of assignments) {
    const team = employeeTeamMap.get(a.employeeId)
    if (team) {
      const result = checkTeamRotationViolation(team, a.shiftTemplateId, a.rosterDay.date)
      if (!result.ok) rotationViolationIds.add(a.id)
    }
  }

  // Compute demand-driven ManpowerTargets from volume forecasts
  const demandTargetsMap = (() => {
    if (volumeForecasts.length === 0 || processShiftLinks.length === 0) return undefined

    // Generate date range (4 weeks forward from today)
    const today = new Date()
    const dates: string[] = []
    for (let i = 0; i < 28; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    }

    const result = computeDemandTargets({
      forecasts: volumeForecasts.map((f) => ({
        processId: f.processId,
        date: f.date,
        volume: f.volume,
        confidence: f.confidence as 'firm' | 'provisional',
        source: f.source as 'manual' | 'import' | 'api',
      })),
      processes: processes.filter((p) => p.active).map((p) => ({
        id: p.id,
        name: p.name,
        normUnit: p.normUnit ?? null,
        normPerHour: p.normPerHour ?? null,
        departmentId: p.departmentId ?? null,
      })),
      processShiftLinks: processShiftLinks.map((l) => ({
        processId: l.processId,
        shiftTemplateId: l.shiftTemplateId,
      })),
      shifts: templates.map((t) => ({ id: t.id, startTime: t.startTime, endTime: t.endTime })),
      employeeScores: processScores,
      dates,
    })

    return result.targets
  })()

  return (
    <div className="space-y-6">
      <AscentrAIBar pageContext="planning" />
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Planning</h1>
        <p className="mt-1 text-sm text-gray-500">Assign employees to shifts.</p>
      </div>

      <PlanningView
        employees={employeesWithScores}
        assignments={assignments}
        templates={templates}
        requirements={requirements}
        locations={locations}
        departments={departments}
        role={role}
        rotationViolationIds={rotationViolationIds}
        employeeTeamMap={employeeTeamMap}
        processes={processes}
        demandTargetsMap={demandTargetsMap}
      />
    </div>
  )
}
