import { getEmployeesWithContext } from '@/lib/queries/employees'
import { getSkills } from '@/lib/queries/skills'
import { getLocations, getDepartmentsWithHierarchy } from '@/lib/queries/locations'
import { getTeamSummaries } from '@/lib/queries/teams'
import { getEmployeeFunctions } from '@/lib/queries/functions'
import { getCurrentContext, canMutate } from '@/lib/auth/context'
import EmployeeTable from '@/components/employees/EmployeeTable'
import EmployeeForm from '@/components/employees/EmployeeForm'
import SkillsManager from '@/components/employees/SkillsManager'
import LocationDeptManager from '@/components/employees/LocationDeptManager'

export default async function EmployeesPage() {
  const { orgId, role } = await getCurrentContext()
  const canEdit = canMutate(role)
  const [employees, skills, locations, departmentTree, teams, employeeFunctions] = await Promise.all([
    getEmployeesWithContext(orgId),
    getSkills(orgId),
    getLocations(orgId),
    getDepartmentsWithHierarchy(orgId),
    getTeamSummaries(orgId),
    getEmployeeFunctions(orgId),
  ])

  // Flatten hierarchy to a labelled list for selectors (table + create form).
  // Children appear right after their parent, prefixed so hierarchy is visible.
  const departmentsFlat = departmentTree.flatMap((d) => [
    { id: d.id, name: d.name },
    ...d.children.map((c) => ({ id: c.id, name: `\u00a0\u00a0\u2514 ${c.name}` })),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Employees</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your workforce directory.</p>
      </div>

      <EmployeeTable
        employees={employees}
        orgSkills={skills}
        locations={locations}
        departments={departmentsFlat}
        teams={teams}
        functions={employeeFunctions}
        canEdit={canEdit}
      />
      {canEdit && (
        <EmployeeForm departments={departmentsFlat} functions={employeeFunctions} />
      )}

      <SkillsManager skills={skills} />
      <LocationDeptManager locations={locations} departments={departmentTree} />
    </div>
  )
}
