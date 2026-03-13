import { getEmployees } from '@/lib/queries/employees'
import { getProcesses, getProcessScores } from '@/lib/queries/processes'
import { getSkills } from '@/lib/queries/skills'
import { getCurrentContext, canMutate } from '@/lib/auth/context'
import WorkforceSkillsView from '@/components/workforce/WorkforceSkillsView'

export default async function WorkforceSkillsPage() {
  const { orgId, role } = await getCurrentContext()
  const canEdit = canMutate(role)

  const [employees, processes, scores, skills] = await Promise.all([
    getEmployees(orgId),
    getProcesses(orgId),
    getProcessScores(orgId),
    getSkills(orgId),
  ])

  return (
    <WorkforceSkillsView
      employees={employees}
      processes={processes}
      scores={scores}
      skills={skills}
      canEdit={canEdit}
    />
  )
}
