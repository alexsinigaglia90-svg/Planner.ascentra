import { computeHealthScore } from '@/lib/ascentrai'
import { getCurrentContext } from '@/lib/auth/context'
import CopilotBar from '@/components/CopilotBar'

/** Server component that computes insights and renders the CopilotBar. */
export default async function AscentrAIBar({ pageContext }: { pageContext?: string }) {
  try {
    const { orgId } = await getCurrentContext()
    const health = await computeHealthScore(orgId)

    // Filter insights by page context if provided
    let relevant = health.insights
    if (pageContext === 'planning') {
      relevant = health.insights.filter((i) => ['staffing', 'risk_warning', 'compliance'].includes(i.type))
    } else if (pageContext === 'leave') {
      relevant = health.insights.filter((i) => i.type === 'risk_warning' || i.description.toLowerCase().includes('afwezig') || i.description.toLowerCase().includes('verlof'))
    } else if (pageContext === 'workforce') {
      relevant = health.insights.filter((i) => ['training', 'efficiency'].includes(i.type))
    }

    if (relevant.length === 0) return null
    return <CopilotBar insights={relevant} maxVisible={2} />
  } catch {
    return null
  }
}
