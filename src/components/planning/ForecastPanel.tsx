import type { ForecastEntry, ForecastResult } from '@/lib/forecasting'
import { Tooltip, EmptyState } from '@/components/ui'

interface Props {
  forecast: ForecastResult
  /** Max historical sample size across all entries — used for confidence rendering. */
  maxSample: number
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** ~N with muted indigo styling — clearly "estimated" */
function ForecastNum({
  value,
  hasHistory,
  className = '',
}: {
  value: number
  hasHistory: boolean
  className?: string
}) {
  return (
    <span
      className={`tabular-nums ${hasHistory ? 'text-indigo-600' : 'text-gray-300'} ${className}`}
    >
      {hasHistory ? `~${value}` : '–'}
    </span>
  )
}

/** Visual confidence bar based on sampleSize vs maxSample */
function ConfidenceDot({ sampleSize }: { sampleSize: number }) {
  if (sampleSize === 0) {
    return <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-200" title="No history" />
  }
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-300"
      title={`Based on ${sampleSize} past observation${sampleSize !== 1 ? 's' : ''}`}
    />
  )
}

function GapIndicator({ gap, hasHistory }: { gap: number; hasHistory: boolean }) {
  if (!hasHistory) return <span className="text-gray-300 text-xs">–</span>
  if (gap <= 0) {
    return (
      <span className="rounded-full border border-green-100 bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-600">
        full
      </span>
    )
  }
  return (
    <span className="rounded-full border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
      {gap} open
    </span>
  )
}

function MixBar({
  internal,
  temp,
  hasHistory,
}: {
  internal: number
  temp: number
  hasHistory: boolean
}) {
  if (!hasHistory) return <span className="text-gray-300 text-xs">–</span>
  const total = internal + temp
  if (total === 0) return <span className="text-gray-300 text-xs">–</span>
  const iPct = Math.round((internal / total) * 100)
  return (
    <div className="flex items-center gap-1 min-w-[72px]">
      <div className="flex-1 h-1 rounded-full bg-orange-100 overflow-hidden">
        <div className="h-full rounded-full bg-blue-400" style={{ width: `${iPct}%` }} />
      </div>
      <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">{iPct}%</span>
    </div>
  )
}

/** Group entries by date, preserving order. */
function groupByDate(entries: ForecastEntry[]): Map<string, ForecastEntry[]> {
  const map = new Map<string, ForecastEntry[]>()
  for (const e of entries) {
    if (!map.has(e.date)) map.set(e.date, [])
    map.get(e.date)!.push(e)
  }
  return map
}

export default function ForecastPanel({ forecast, maxSample }: Props) {
  if (forecast.entries.length === 0) {
    return (
      <EmptyState
        compact
        title="Nog geen forecastdata beschikbaar"
        description="Prognoses verschijnen zodra toekomstige datums in het huidige venster vallen."
      />
    )
  }

  const grouped = groupByDate(forecast.entries)
  const hasAnyHistory = forecast.entries.some((e) => e.hasHistory)
  const allNoHistory = !hasAnyHistory

  return (
    <div className="rounded-xl border border-indigo-100 bg-white overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-indigo-50 bg-indigo-50/40">
        <div className="flex items-center gap-2">
          {/* Forecast icon — sparkle-style diamond */}
          <svg
            className="w-3.5 h-3.5 text-indigo-400 shrink-0"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M8 1l1.5 5.5L15 8l-5.5 1.5L8 15l-1.5-5.5L1 8l5.5-1.5L8 1z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
            Forecast
          </span>
          <span className="rounded-full border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-500">
            weekday avg
          </span>
        </div>

        <span className="text-xs text-gray-400">
          {forecast.startDate} – {forecast.endDate}
          {maxSample > 0 && (
            <span className="ml-1.5 text-indigo-300">
              · {maxSample} day{maxSample !== 1 ? 's' : ''} of history
            </span>
          )}
        </span>
      </div>

      {/* No history notice */}
      {allNoHistory && (
        <div className="px-5 py-3 border-b border-indigo-50 bg-amber-50/40">
          <p className="text-xs text-amber-600">
            No historical data yet — forecasts will appear once past shifts are recorded.
            Values below show &quot;–&quot; until patterns can be learned.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-indigo-50/60 bg-indigo-50/20">
              <th className="text-left px-5 py-2 text-xs font-medium text-gray-400 whitespace-nowrap">
                Date
              </th>
              <th className="text-left px-3 py-2 text-xs font-medium text-gray-400 whitespace-nowrap">
                Shift
              </th>
              <th className="text-right px-3 py-2 text-xs font-medium text-gray-400 whitespace-nowrap">
                <Tooltip text="Minimum benodigd personeel voor deze dienst.">
                  <span>Required</span>
                </Tooltip>
              </th>
              <th className="text-right px-3 py-2 text-xs font-medium text-indigo-400 whitespace-nowrap">
                <Tooltip text="Geschat benodigd personeel op basis van historisch weekdaggemiddelde.">
                  <span>~Forecast</span>
                </Tooltip>
              </th>
              <th className="px-3 py-2 text-xs font-medium text-gray-400 whitespace-nowrap">
                <Tooltip text="Verschil tussen verwacht en benodigd personeel.">
                  <span>Gap</span>
                </Tooltip>
              </th>
              <th className="px-3 py-2 text-xs font-medium text-gray-400 whitespace-nowrap">
                <Tooltip text="Verhouding intern / tijdelijk personeel op basis van historische inzet.">
                  <span>Int / Temp</span>
                </Tooltip>
              </th>
              <th className="text-center px-3 py-2 text-xs font-medium text-gray-300 whitespace-nowrap">
                <Tooltip text="Betrouwbaarheidsscore van de forecast op basis van beschikbare historische data.">
                  <span>Conf.</span>
                </Tooltip>
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from(grouped.entries()).map(([date, rows]) => (
              rows.map((entry, rowIdx) => (
                <tr
                  key={`${date}-${entry.template.id}`}
                  className="border-b border-indigo-50/40 hover:bg-indigo-50/20 transition-colors"
                >
                  {/* Date cell — only on first row per date group */}
                  {rowIdx === 0 ? (
                    <td
                      rowSpan={rows.length}
                      className="px-5 py-2 align-top whitespace-nowrap"
                    >
                      <div className="text-xs font-medium text-gray-700">
                        {formatDate(date)}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {WEEKDAY_LABELS[entry.weekday]}
                      </div>
                    </td>
                  ) : null}

                  {/* Shift template */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="text-xs font-medium text-gray-700">
                      {entry.template.name}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {entry.template.startTime}–{entry.template.endTime}
                    </div>
                  </td>

                  {/* Required */}
                  <td className="px-3 py-2 text-right tabular-nums text-xs text-gray-400">
                    {entry.required}
                  </td>

                  {/* Forecast assigned — indigo, ~ prefix */}
                  <td className="px-3 py-2 text-right">
                    <ForecastNum
                      value={entry.forecastedAssigned}
                      hasHistory={entry.hasHistory}
                      className="text-sm font-semibold"
                    />
                  </td>

                  {/* Gap / open positions */}
                  <td className="px-3 py-2">
                    <GapIndicator gap={entry.forecastedOpen} hasHistory={entry.hasHistory} />
                  </td>

                  {/* Internal / temp mix bar */}
                  <td className="px-3 py-2">
                    <MixBar
                      internal={entry.forecastedInternal}
                      temp={entry.forecastedTemp}
                      hasHistory={entry.hasHistory}
                    />
                  </td>

                  {/* Confidence dot */}
                  <td className="px-3 py-2 text-center">
                    <ConfidenceDot sampleSize={entry.sampleSize} />
                  </td>
                </tr>
              ))
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer: methodology explanation */}
      <div className="px-5 py-3 border-t border-indigo-50 bg-indigo-50/20">
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Forecasts use{' '}
          <span className="font-medium text-indigo-400">
            historical weekday averages
          </span>{' '}
          — the mean assignments seen on the same day-of-week in past records.
          Values are rounded to whole numbers.{' '}
          <span className="text-gray-300">~</span> = estimated.
        </p>
      </div>
    </div>
  )
}
