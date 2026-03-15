import { getCurrentContext } from '@/lib/auth/context'
import { computeCostBreakdown } from '@/lib/opex'
import OpexDashboard from '@/components/settings/OpexDashboard'

export default async function CostsPage() {
  const { orgId } = await getCurrentContext()

  // Current month
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const monthEndStr = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}`

  // Previous month for comparison
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
  const prevMonthStart = `${prevMonthEnd.getFullYear()}-${String(prevMonthEnd.getMonth() + 1).padStart(2, '0')}-01`
  const prevMonthEndStr = `${prevMonthEnd.getFullYear()}-${String(prevMonthEnd.getMonth() + 1).padStart(2, '0')}-${String(prevMonthEnd.getDate()).padStart(2, '0')}`

  const [current, previous] = await Promise.all([
    computeCostBreakdown(orgId, monthStart, monthEndStr),
    computeCostBreakdown(orgId, prevMonthStart, prevMonthEndStr),
  ])

  return <OpexDashboard current={current} previous={previous} />
}
