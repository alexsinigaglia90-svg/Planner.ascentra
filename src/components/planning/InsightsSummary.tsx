import type { PeriodMetrics } from '@/lib/analytics'

interface Props {
  metrics: PeriodMetrics
}

interface StatChipProps {
  label: string
  value: string | number
  variant?: 'neutral' | 'bad' | 'warn' | 'good'
}

function StatChip({ label, value, variant = 'neutral' }: StatChipProps) {
  const colors = {
    neutral: 'bg-gray-50 border-gray-200 text-gray-900',
    bad: 'bg-red-50 border-red-100 text-red-800',
    warn: 'bg-amber-50 border-amber-100 text-amber-800',
    good: 'bg-green-50 border-green-100 text-green-800',
  }

  return (
    <div className={`rounded-lg border px-4 py-2.5 shrink-0 ${colors[variant]}`}>
      <div className="text-lg font-semibold leading-tight tabular-nums">{value}</div>
      <div className="text-xs opacity-60 mt-0.5 whitespace-nowrap">{label}</div>
    </div>
  )
}

export default function InsightsSummary({ metrics }: Props) {
  // Only render when there's something meaningful to show
  if (metrics.totalRequired === 0 && metrics.totalAssignments === 0) return null

  const internalPct =
    metrics.totalAssignments > 0 ? Math.round(metrics.internalRatio * 100) : 0
  const tempPct = 100 - internalPct

  return (
    <div className="flex items-stretch gap-2.5 overflow-x-auto pb-0.5">
      <StatChip label="Assignments" value={metrics.totalAssignments} variant="neutral" />

      <StatChip
        label="Open positions"
        value={metrics.totalOpen}
        variant={metrics.totalOpen > 0 ? 'bad' : 'good'}
      />

      <StatChip
        label="Understaffed"
        value={metrics.understaffedInstances}
        variant={metrics.understaffedInstances > 0 ? 'bad' : 'good'}
      />

      <StatChip
        label="Overstaffed"
        value={metrics.overstaffedInstances}
        variant={metrics.overstaffedInstances > 0 ? 'warn' : 'neutral'}
      />

      {/* Internal / temp mix chip */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 shrink-0 min-w-[136px]">
        <div className="flex items-center justify-between text-sm font-semibold leading-tight">
          <span className="text-blue-600">{internalPct}%</span>
          <span className="text-gray-300 text-xs font-normal mx-1">·</span>
          <span className="text-orange-500">{tempPct}%</span>
        </div>
        {/* Progress bar */}
        <div className="mt-1.5 h-1.5 rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${internalPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-gray-400">Internal</span>
          <span className="text-[10px] text-gray-400">Temp</span>
        </div>
      </div>
    </div>
  )
}
