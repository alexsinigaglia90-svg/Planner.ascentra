import { getEmployeesWithContext } from '@/lib/queries/employees'
import { getTeamSummaries } from '@/lib/queries/teams'
import { getDepartments, getLocations } from '@/lib/queries/locations'
import { getEmployeeFunctions } from '@/lib/queries/functions'
import { getProcesses } from '@/lib/queries/processes'
import { getCurrentContext, canMutate } from '@/lib/auth/context'
import WorkforceEmployeesView from '@/components/workforce/WorkforceEmployeesView'

export default async function WorkforceEmployeesPage() {
  const { orgId, role } = await getCurrentContext()
  const canEdit = canMutate(role)
  const [employees, teams, departments, employeeFunctions, locations, processes] = await Promise.all([
    getEmployeesWithContext(orgId),
    getTeamSummaries(orgId),
    getDepartments(orgId),
    getEmployeeFunctions(orgId),
    getLocations(orgId),
    getProcesses(orgId),
  ])

  return (
    <WorkforceEmployeesView
      employees={employees}
      teams={teams}
      departments={departments}
      functions={employeeFunctions}
      locations={locations}
      processes={processes}
      canEdit={canEdit}
    />
  )
}
