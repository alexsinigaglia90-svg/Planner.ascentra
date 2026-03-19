import { getAssignments } from '@/lib/queries/assignments'
import { getEmployeesWithContext } from '@/lib/queries/employees'
import { getShiftTemplates } from '@/lib/queries/shiftTemplates'
import { getShiftRequirements } from '@/lib/queries/shiftRequirements'
import { getDepartmentsWithHierarchy } from '@/lib/queries/locations'
import { getProcesses, getProcessScores } from '@/lib/queries/processes'
import { getProcessShiftLinks } from '@/lib/queries/processShiftLinks'
import { getTeams } from '@/lib/queries/teams'
import { getCurrentContext, canMutate } from '@/lib/auth/context'
import { prisma } from '@/lib/db/client'
import { computeDemandTargets } from '@/lib/demandBridge'
import Planner2View from '@/components/planning/Planner2View'

export default async function Planning2Page() {
  const { orgId, role } = await getCurrentContext()
  const edit = canMutate(role)

  const [
    assignments,
    employees,
    templates,
    requirementsRaw,
    departments,
    processes,
    processesForDemand,
    processScores,
    processShiftLinks,
    volumeForecasts,
    teams,
  ] = await Promise.all([
    getAssignments(orgId),
    getEmployeesWithContext(orgId),
    getShiftTemplates(orgId),
    getShiftRequirements(orgId),
    getDepartmentsWithHierarchy(orgId),
    getProcesses(orgId),
    prisma.process.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, active: true, normUnit: true, normPerHour: true, departmentId: true },
    }),
    getProcessScores(orgId),
    getProcessShiftLinks(orgId),
    prisma.volumeForecast.findMany({
      where: { organizationId: orgId },
      select: { processId: true, date: true, volume: true, confidence: true, source: true },
    }),
    getTeams(orgId),
  ])

  // Build teamId → employee headcount map
  const employeeTeamCounts = new Map<string, number>()
  for (const emp of employees) {
    const teamId = emp.team?.id
    if (teamId) {
      employeeTeamCounts.set(teamId, (employeeTeamCounts.get(teamId) ?? 0) + 1)
    }
  }

  // Flatten department hierarchy to simple list
  // Assign colors from a palette since Department model has no color field
  const DEPT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#3b82f6']
  const allDepts = departments.flatMap((d) => [d, ...d.children])
  const deptList = allDepts.map((d, i) => ({
    id: d.id,
    name: d.name,
    color: DEPT_COLORS[i % DEPT_COLORS.length],
  }))

  // Compute volume-driven demand targets (ManpowerTarget per shift)
  const demandTargetsMap = (() => {
    if (volumeForecasts.length === 0 || processShiftLinks.length === 0) return undefined

    const today = new Date()
    const dates: string[] = []
    for (let i = -7; i < 56; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      dates.push(d.toISOString().slice(0, 10))
    }

    const result = computeDemandTargets({
      forecasts: volumeForecasts.map((f) => ({
        processId: f.processId,
        date: f.date,
        volume: f.volume,
        confidence: f.confidence as 'firm' | 'provisional',
        source: f.source as 'manual' | 'import' | 'api',
      })),
      processes: processesForDemand.filter((p) => p.active).map((p) => ({
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-950">Planning</h1>
        <p className="mt-1 text-[13px] text-gray-500">
          Overzicht van alle afdelingen, shifts en medewerkers.
        </p>
      </div>
      <Planner2View
        assignments={assignments}
        employees={employees}
        templates={templates}
        requirements={requirementsRaw}
        departments={deptList}
        processes={processes}
        processScores={processScores}
        canEdit={edit}
        demandTargetsMap={demandTargetsMap}
        teams={teams}
        employeeTeamCounts={employeeTeamCounts}
      />
    </div>
  )
}
