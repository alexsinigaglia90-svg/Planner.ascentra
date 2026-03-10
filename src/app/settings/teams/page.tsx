import { redirect } from 'next/navigation'
import { getCurrentContext } from '@/lib/auth/context'
import { getTeams } from '@/lib/queries/teams'
import { getShiftTemplates } from '@/lib/queries/shiftTemplates'
import TeamsView from '@/components/settings/TeamsView'

export const metadata = { title: 'Teams — Planner Ascentra' }

export default async function TeamsPage() {
  const ctx = await getCurrentContext()
  if (ctx.role !== 'admin') redirect('/dashboard')

  const [teams, shiftTemplates] = await Promise.all([
    getTeams(ctx.orgId),
    getShiftTemplates(ctx.orgId),
  ])

  return <TeamsView teams={teams} shiftTemplates={shiftTemplates} />
}
