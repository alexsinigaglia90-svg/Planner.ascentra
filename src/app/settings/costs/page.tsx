import { getCurrentContext } from '@/lib/auth/context'
import { computeCostBreakdown } from '@/lib/opex'
import OpexDashboard from '@/components/settings/OpexDashboard'

function monthBounds(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month + 1, 0)
  const end = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
  return { start, end }
}

export default async function CostsPage() {
  const { orgId } = await getCurrentContext()
  const now = new Date()

  // Compute 6 months of data for trending
  const months: { label: string; start: string; end: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const bounds = monthBounds(d.getFullYear(), d.getMonth())
    months.push({
      label: d.toLocaleDateString('nl-NL', { month: 'short' }),
      ...bounds,
    })
  }

  const breakdowns = await Promise.all(
    months.map((m) => computeCostBreakdown(orgId, m.start, m.end)),
  )

  const trend = months.map((m, i) => ({
    label: m.label,
    totalCost: breakdowns[i].totalCost,
    internalCost: breakdowns[i].internalCost,
    tempCost: breakdowns[i].tempCost,
    overtimeCost: breakdowns[i].overtimeCost,
  }))

  const current = breakdowns[breakdowns.length - 1]
  const previous = breakdowns[breakdowns.length - 2]

  return <OpexDashboard current={current} previous={previous} trend={trend} />
}
