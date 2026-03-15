import { getCurrentContext } from '@/lib/auth/context'
import { computeSignals } from '@/lib/signals'
import SignalsTimeline from '@/components/SignalsTimeline'

export default async function SignalsPage() {
  const { orgId } = await getCurrentContext()
  const signals = await computeSignals(orgId)

  return (
    <div className="space-y-6">
      <div className="pb-5 border-b border-[#E6E8F0]">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1">AscentrAI</p>
        <h1 className="text-[22px] font-bold text-gray-900 leading-tight">Forecast & Signalen</h1>
        <p className="mt-1 text-sm text-gray-500">Externe en interne factoren die je workforce planning beinvloeden.</p>
      </div>
      <SignalsTimeline signals={signals} />
    </div>
  )
}
