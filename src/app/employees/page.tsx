import { getEmployeesWithContext } from '@/lib/queries/employees'
import { getSkills } from '@/lib/queries/skills'
import { getLocations, getDepartments } from '@/lib/queries/locations'
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
  const [employees, skills, locations, departments, teams, employeeFunctions] = await Promise.all([
    getEmployeesWithContext(orgId),
    getSkills(orgId),
    getLocations(orgId),
    getDepartments(orgId),
    getTeamSummaries(orgId),
    getEmployeeFunctions(orgId),
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
        departments={departments}
        teams={teams}
        functions={employeeFunctions}
        canEdit={canEdit}
      />
      {canEdit && (
        <EmployeeForm departments={departments} functions={employeeFunctions} />
      )}

      <SkillsManager skills={skills} />
      <LocationDeptManager locations={locations} departments={departments} />
    </div>
  )
}
