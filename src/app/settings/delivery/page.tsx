import { redirect } from 'next/navigation'
import { getCurrentContext } from '@/lib/auth/context'
import { getDeliveryLogs, getDeliveryStats } from '@/lib/queries/delivery'
import DeliveryLogView from '@/components/settings/DeliveryLogView'

export const metadata = { title: 'Delivery Log — Planner Ascentra' }

export default async function DeliveryPage() {
  const ctx = await getCurrentContext()
  if (ctx.role !== 'admin') redirect('/dashboard')

  const [logs, stats] = await Promise.all([
    getDeliveryLogs(ctx.orgId),
    getDeliveryStats(ctx.orgId),
  ])

  return <DeliveryLogView logs={logs} stats={stats} />
}
