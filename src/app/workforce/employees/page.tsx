import { getEmployeesWithContext } from '@/lib/queries/employees'
import { getTeamSummaries } from '@/lib/queries/teams'
import { getDepartments } from '@/lib/queries/locations'
import { getEmployeeFunctions } from '@/lib/queries/functions'
import { getCurrentContext, canMutate } from '@/lib/auth/context'
import WorkforceEmployeesView from '@/components/workforce/WorkforceEmployeesView'

export default async function WorkforceEmployeesPage() {
  const { orgId, role } = await getCurrentContext()
  const canEdit = canMutate(role)
  const [employees, teams, departments, employeeFunctions] = await Promise.all([
    getEmployeesWithContext(orgId),
    getTeamSummaries(orgId),
    getDepartments(orgId),
    getEmployeeFunctions(orgId),
  ])

  return (
    <WorkforceEmployeesView
      employees={employees}
      teams={teams}
      departments={departments}
      functions={employeeFunctions}
      canEdit={canEdit}
    />
  )
}
