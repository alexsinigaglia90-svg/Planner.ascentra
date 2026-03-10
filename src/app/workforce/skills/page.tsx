import { getEmployees } from '@/lib/queries/employees'
import { getProcesses, getProcessScores } from '@/lib/queries/processes'
import { getCurrentContext, canMutate } from '@/lib/auth/context'
import SkillMatrixView from '@/components/workforce/SkillMatrixView'

export default async function WorkforceSkillsPage() {
  const { orgId, role } = await getCurrentContext()
  const canEdit = canMutate(role)

  const [employees, processes, scores] = await Promise.all([
    getEmployees(orgId),
    getProcesses(orgId),
    getProcessScores(orgId),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Skill Matrix</h1>
        <p className="mt-1 text-sm text-gray-500">
          Performance capability scores (0–100) per employee and process.
        </p>
      </div>

      <SkillMatrixView
        employees={employees}
        processes={processes}
        scores={scores}
        canEdit={canEdit}
      />
    </div>
  )
}
