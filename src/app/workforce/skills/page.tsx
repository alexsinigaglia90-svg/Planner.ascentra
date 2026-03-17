import { getEmployees } from '@/lib/queries/employees'
import { getProcesses, getProcessScores } from '@/lib/queries/processes'
import { getSkills, getSkillsWithUsage } from '@/lib/queries/skills'
import { getCurrentContext, canMutate } from '@/lib/auth/context'
import { prisma } from '@/lib/db/client'
import WorkforceSkillsView from '@/components/workforce/WorkforceSkillsView'

export default async function WorkforceSkillsPage() {
  const { orgId, role } = await getCurrentContext()
  const canEdit = canMutate(role)

  const [employees, processes, scores, skills, skillsWithUsage, totalEmployees] = await Promise.all([
    getEmployees(orgId),
    getProcesses(orgId),
    getProcessScores(orgId),
    getSkills(orgId),
    getSkillsWithUsage(orgId),
    prisma.employee.count({ where: { organizationId: orgId, status: 'active' } }),
  ])

  return (
    <WorkforceSkillsView
      employees={employees}
      processes={processes}
      scores={scores}
      skills={skills}
      skillsWithUsage={skillsWithUsage}
      totalEmployees={totalEmployees}
      canEdit={canEdit}
    />
  )
}
