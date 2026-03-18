import { getAssignments } from '@/lib/queries/assignments'
import { getEmployeesWithContext } from '@/lib/queries/employees'
import { getShiftTemplates } from '@/lib/queries/shiftTemplates'
import { getShiftRequirements } from '@/lib/queries/shiftRequirements'
import { getDepartmentsWithHierarchy } from '@/lib/queries/locations'
import { getProcesses, getProcessScores } from '@/lib/queries/processes'
import { getCurrentContext, canMutate } from '@/lib/auth/context'
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
    processScores,
  ] = await Promise.all([
    getAssignments(orgId),
    getEmployeesWithContext(orgId),
    getShiftTemplates(orgId),
    getShiftRequirements(orgId),
    getDepartmentsWithHierarchy(orgId),
    getProcesses(orgId),
    getProcessScores(orgId),
  ])

  // Flatten department hierarchy to simple list
  // Assign colors from a palette since Department model has no color field
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
      />
    </div>
  )
}
