import type { PeriodMetrics, DayMetrics } from '@/lib/analytics'

interface Props {
  metrics: PeriodMetrics
}

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function DeltaBar({ day, maxAbs }: { day: DayMetrics; maxAbs: number }) {
  const pct = maxAbs > 0 ? Math.min(100, (Math.abs(day.delta) / maxAbs) * 100) : 0
  const color =
    day.delta < 0 ? 'bg-red-400' : day.delta > 0 ? 'bg-amber-400' : 'bg-green-400'
  const textColor =
    day.delta < 0 ? 'text-red-600' : day.delta > 0 ? 'text-amber-600' : 'text-green-500'
  const sign = day.delta > 0 ? '+' : ''

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-1.5 rounded-full bg-gray-100 overflow-hidden shrink-0">
        <div
          className={`h-full rounded-full ${color} transition-all duration-200`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs tabular-nums font-medium w-7 ${textColor}`}>
        {day.delta === 0 ? '–' : `${sign}${day.delta}`}
      </span>
    </div>
  )
}

export default function StaffingTrendTable({ metrics }: Props) {
  if (metrics.byDay.length === 0) return null

  const today = localToday()
  const maxAbsDelta = Math.max(1, ...metrics.byDay.map((d) => Math.abs(d.delta)))

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
          Daily breakdown
        </span>
        <span className="text-xs text-gray-400">
          {metrics.totalDays} days · {metrics.startDate} – {metrics.endDate}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/30">
              <th className="text-left px-5 py-2 text-xs font-medium text-gray-400 whitespace-nowrap">
                Date
              </th>
              <th className="text-right px-3 py-2 text-xs font-medium text-gray-400 whitespace-nowrap">
                Req.
              </th>
              <th className="text-right px-3 py-2 text-xs font-medium text-gray-400 whitespace-nowrap">
                Assigned
              </th>
              <th className="px-3 py-2 text-xs font-medium text-gray-400 whitespace-nowrap">
                Delta
              </th>
              <th className="text-right px-3 py-2 text-xs font-medium text-blue-400 whitespace-nowrap">
                Int.
              </th>
              <th className="text-right px-3 py-2 text-xs font-medium text-orange-400 whitespace-nowrap">
                Temp
              </th>
              <th className="text-right px-5 py-2 text-xs font-medium text-gray-400 whitespace-nowrap">
                Open
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {metrics.byDay.map((day) => {
              const isToday = day.date === today
              return (
                <tr
                  key={day.date}
                  className={[
                    'transition-colors hover:bg-gray-50/60',
                    isToday ? 'bg-blue-50/25' : '',
                  ].join(' ')}
                >
                  <td
                    className={[
                      'px-5 py-2 whitespace-nowrap text-xs font-medium',
                      isToday ? 'text-blue-600' : 'text-gray-700',
                    ].join(' ')}
                  >
                    {formatDate(day.date)}
                    {isToday && (
                      <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-500 font-normal">
                        today
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs text-gray-400">
                    {day.totalRequired}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-medium text-gray-700">
                    {day.totalAssigned}
                  </td>
                  <td className="px-3 py-2">
                    <DeltaBar day={day} maxAbs={maxAbsDelta} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs text-blue-500">
                    {day.internalCount > 0 ? day.internalCount : '–'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs text-orange-400">
                    {day.tempCount > 0 ? day.tempCount : '–'}
                  </td>
                  <td
                    className={[
                      'px-5 py-2 text-right tabular-nums text-xs font-medium',
                      day.openPositions > 0 ? 'text-red-500' : 'text-gray-300',
                    ].join(' ')}
                  >
                    {day.openPositions > 0 ? day.openPositions : '–'}
                  </td>
                </tr>
              )
            })}
          </tbody>

          {/* Per-template coverage footer */}
          {metrics.byTemplate.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-100 bg-gray-50/40">
                <td colSpan={7} className="px-5 py-3">
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {metrics.byTemplate.map((tpl) => {
                      const pct = Math.round(tpl.coverageRate * 100)
                      const coverageColor =
                        pct >= 90 ? 'bg-green-400' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400'
                      return (
                        <div key={tpl.templateId} className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-gray-500 font-medium truncate">
                            {tpl.templateName}
                          </span>
                          <span className="text-[10px] text-gray-400 shrink-0">
                            {tpl.startTime}–{tpl.endTime}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <div className="w-14 h-1 rounded-full bg-gray-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${coverageColor}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] tabular-nums text-gray-400">{pct}%</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
