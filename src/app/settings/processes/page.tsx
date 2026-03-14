import { redirect } from 'next/navigation'
import { getCurrentContext } from '@/lib/auth/context'
import { getDepartmentsWithHierarchy } from '@/lib/queries/locations'
import { getSkills } from '@/lib/queries/skills'
import { getProcessesForMasterData } from '@/lib/queries/processes'
import ProcessesView from '@/components/settings/ProcessesView'

export const metadata = { title: 'Processes — Planner Ascentra' }

export default async function ProcessesPage() {
  const ctx = await getCurrentContext()
  if (ctx.role !== 'admin') redirect('/dashboard')

  const [departmentTree, skills, processes] = await Promise.all([
    getDepartmentsWithHierarchy(ctx.orgId),
    getSkills(ctx.orgId),
    getProcessesForMasterData(ctx.orgId).catch(() => []),
  ])

  return (
    <ProcessesView
      initialProcesses={processes}
      departmentTree={departmentTree}
      skills={skills}
    />
  )
}
