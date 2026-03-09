import { getAssignments } from '@/lib/queries/assignments'
import { getEmployees } from '@/lib/queries/employees'
import { getShiftTemplates } from '@/lib/queries/shiftTemplates'
import { getShiftRequirements } from '@/lib/queries/shiftRequirements'
import { getLocations, getDepartments } from '@/lib/queries/locations'
import { getCurrentContext } from '@/lib/auth/context'
import PlanningView from '@/components/planning/PlanningView'

export default async function PlanningPage() {
  const { orgId, role } = await getCurrentContext()
  const [assignments, employees, templates, requirements, locations, departments] = await Promise.all([
    getAssignments(orgId),
    getEmployees(orgId),
    getShiftTemplates(orgId),
    getShiftRequirements(orgId),
    getLocations(orgId),
    getDepartments(orgId),
  ])

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
      />
    </div>
  )
}
