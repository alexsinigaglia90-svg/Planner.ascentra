import { getAssignments } from '@/lib/queries/assignments'
import { getEmployeesWithContext } from '@/lib/queries/employees'
import { getShiftTemplates } from '@/lib/queries/shiftTemplates'
import { getDepartmentsWithHierarchy } from '@/lib/queries/locations'
import { getProcessScores } from '@/lib/queries/processes'
import { getProcessShiftLinks } from '@/lib/queries/processShiftLinks'
import { getTeams } from '@/lib/queries/teams'
import { getCurrentContext } from '@/lib/auth/context'
import { prisma } from '@/lib/db/client'
import Planner3View from '@/components/planning/Planner3View'

export default async function Planning3Page() {
  const { orgId } = await getCurrentContext()

  const [assignments, employees, templates, departments, processScores, processShiftLinks, teams] =
    await Promise.all([
      getAssignments(orgId),
      getEmployeesWithContext(orgId),
      getShiftTemplates(orgId),
      getDepartmentsWithHierarchy(orgId),
      getProcessScores(orgId),
      getProcessShiftLinks(orgId),
      getTeams(orgId),
    ])

  // Direct Prisma query — getProcesses() omits departmentId + active
  const processes = await prisma.process.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, color: true, active: true, departmentId: true, sortOrder: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  // Flatten dept hierarchy + assign palette colours (same approach as planning2/page.tsx)
  const DEPT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#3b82f6']
  const allDepts = departments.flatMap((d) => [d, ...d.children])
  const deptList = allDepts.map((d, i) => ({
    id: d.id,
    name: d.name,
    color: DEPT_COLORS[i % DEPT_COLORS.length],
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-950">Planner 3.0</h1>
        <p className="mt-1 text-[13px] text-gray-500">
          Hiërarchisch overzicht: afdelingen → ploegen → processen met bezetting.
        </p>
      </div>
      <Planner3View
        employees={employees}
        departments={deptList}
        processes={processes}
        processScores={processScores}
        processShiftLinks={processShiftLinks}
        assignments={assignments}
        teams={teams}
        templates={templates}
      />
    </div>
  )
}
