import { redirect } from 'next/navigation'
import { getCurrentContext } from '@/lib/auth/context'
import { getOrgMembers } from '@/lib/queries/users'
import UsersView from '@/components/settings/UsersView'

export const metadata = { title: 'Users — Planner Ascentra' }

export default async function UsersPage() {
  const ctx = await getCurrentContext()
  if (ctx.role !== 'admin') redirect('/dashboard')

  const members = await getOrgMembers(ctx.orgId)

  return <UsersView members={members} currentUserId={ctx.userId} />
}
