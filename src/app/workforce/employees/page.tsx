import { getEmployeesWithContext } from '@/lib/queries/employees'
import { getTeamSummaries } from '@/lib/queries/teams'
import { getCurrentContext, canMutate } from '@/lib/auth/context'
import WorkforceEmployeesView from '@/components/workforce/WorkforceEmployeesView'

export default async function WorkforceEmployeesPage() {
  const { orgId, role } = await getCurrentContext()
  const canEdit = canMutate(role)
  const [employees, teams] = await Promise.all([
    getEmployeesWithContext(orgId),
    getTeamSummaries(orgId),
  ])

  return (
    <WorkforceEmployeesView
      employees={employees}
      teams={teams}
      canEdit={canEdit}
    />
  )
}
