import { getCurrentContext } from '@/lib/auth/context'
import { computeHealthScore, syncInsightsToAdvice } from '@/lib/ascentrai'
import { prisma } from '@/lib/db/client'
import CopilotView from '@/components/CopilotView'

export default async function AscentrAIPage() {
  const { orgId } = await getCurrentContext()

  // Compute fresh health score + insights
  const health = await computeHealthScore(orgId)

  // Sync insights to advice records (deduplicates)
  await syncInsightsToAdvice(orgId, health.insights)

  // Fetch all advice records for history
  const adviceRecords = await prisma.copilotAdvice.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  // Stats
  const totalAdvice = await prisma.copilotAdvice.count({ where: { organizationId: orgId } })
  const acceptedCount = await prisma.copilotAdvice.count({ where: { organizationId: orgId, status: 'accepted' } })
  const completedCount = await prisma.copilotAdvice.count({ where: { organizationId: orgId, status: 'completed' } })
  const declinedCount = await prisma.copilotAdvice.count({ where: { organizationId: orgId, status: 'declined' } })
  const totalEstimatedSavings = await prisma.copilotAdvice.aggregate({
    where: { organizationId: orgId, status: { in: ['accepted', 'completed'] } },
    _sum: { estimatedSavings: true },
  })
  const totalActualSavings = await prisma.copilotAdvice.aggregate({
    where: { organizationId: orgId, status: 'completed' },
    _sum: { actualSavings: true },
  })
  const missedSavings = await prisma.copilotAdvice.aggregate({
    where: { organizationId: orgId, status: 'declined' },
    _sum: { estimatedSavings: true },
  })

  return (
    <CopilotView
      health={health}
      adviceRecords={adviceRecords.map((r) => ({
        ...r,
        metadata: r.metadata ?? undefined,
      }))}
      stats={{
        total: totalAdvice,
        accepted: acceptedCount,
        completed: completedCount,
        declined: declinedCount,
        followRate: totalAdvice > 0 ? Math.round(((acceptedCount + completedCount) / totalAdvice) * 100) : 0,
        estimatedSavings: totalEstimatedSavings._sum.estimatedSavings ?? 0,
        actualSavings: totalActualSavings._sum.actualSavings ?? 0,
        missedSavings: missedSavings._sum.estimatedSavings ?? 0,
      }}
    />
  )
}
