import { getAssignments } from '@/lib/queries/assignments'
import { getEmployeesForPlanning } from '@/lib/queries/employees'
import { getShiftTemplates } from '@/lib/queries/shiftTemplates'
import { getShiftRequirements } from '@/lib/queries/shiftRequirements'
import { getLocations, getDepartmentsWithHierarchy } from '@/lib/queries/locations'
import { getEmployeeTeamMap } from '@/lib/queries/teams'
import { checkTeamRotationViolation } from '@/lib/teams'
import { getCurrentContext } from '@/lib/auth/context'
import PlanningView from '@/components/planning/PlanningView'

export default async function PlanningPage() {
  const { orgId, role } = await getCurrentContext()
  const [assignments, employees, templates, requirements, locations, departments, employeeTeamMap] = await Promise.all([
    getAssignments(orgId),
    getEmployeesForPlanning(orgId),
    getShiftTemplates(orgId),
    getShiftRequirements(orgId),
    getLocations(orgId),
    getDepartmentsWithHierarchy(orgId),
    getEmployeeTeamMap(orgId),
  ])

  // Compute which assignment IDs violate their employee's team rotation
  const rotationViolationIds = new Set<string>()
  for (const a of assignments) {
    const team = employeeTeamMap.get(a.employeeId)
    if (team) {
      const result = checkTeamRotationViolation(team, a.shiftTemplateId, a.rosterDay.date)
      if (!result.ok) rotationViolationIds.add(a.id)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Planning</h1>
        <p className="mt-1 text-sm text-gray-500">Assign employees to shifts.</p>
      </div>

      <PlanningView
        employees={employees}
        assignments={assignments}
        templates={templates}
        requirements={requirements}
        locations={locations}
        departments={departments}
        role={role}
        rotationViolationIds={rotationViolationIds}
        employeeTeamMap={employeeTeamMap}
      />
    </div>
  )
}
