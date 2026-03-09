import { getAnalyticsSnapshot } from '@/lib/queries/analytics'
import { getCurrentContext } from '@/lib/auth/context'
import { computeMetrics, type TemplateMetrics } from '@/lib/analytics'
import { computeWeekdayPatterns, generateForecast } from '@/lib/forecasting'
import ForecastPanel from '@/components/planning/ForecastPanel'

// ── Date helpers (server-side, timezone-safe) ─────────────────────────────────

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function generateDates(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i))
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  return `${s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: 'blue' | 'red' | 'amber' | 'green' | 'gray'
}) {
  const valueColors = {
    blue: 'text-blue-700',
    red: 'text-red-700',
    amber: 'text-amber-700',
    green: 'text-green-700',
    gray: 'text-gray-900',
  }
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <div className={`text-2xl font-bold tabular-nums ${valueColors[accent ?? 'gray']}`}>
        {value}
      </div>
      <div className="mt-0.5 text-xs font-medium text-gray-500">{label}</div>
      {sub && <div className="mt-1 text-[11px] text-gray-400">{sub}</div>}
    </div>
  )
}

function CoverageBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'bg-green-400' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  )
}

function TemplateRow({ tpl }: { tpl: TemplateMetrics }) {
  const pct = Math.round(tpl.coverageRate * 100)
  const avgLabel = tpl.averageAssigned.toFixed(1)
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
      <td className="px-5 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">
        {tpl.templateName}
      </td>
      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
        {tpl.startTime}–{tpl.endTime}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-xs text-gray-500">
        {tpl.requiredPerDay}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-xs font-medium text-gray-700">
        {tpl.totalAssignedInPeriod}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-xs text-gray-500">{avgLabel}/day</td>
      <td className="px-5 py-3 min-w-[140px]">
        <CoverageBar pct={pct} />
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-xs">
        {tpl.totalOpen > 0 ? (
          <span className="text-red-500 font-medium">{tpl.totalOpen}</span>
        ) : (
          <span className="text-gray-300">–</span>
        )}
      </td>
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { orgId } = await getCurrentContext()
  const today = todayStr()
  const startDate = addDays(today, -27) // 28-day lookback
  const snapshot = await getAnalyticsSnapshot(orgId, startDate, today)

  const dates = generateDates(startDate, 28)
  const metrics = computeMetrics({
    dates,
    assignments: snapshot.assignments,
    templates: snapshot.templates,
    employees: snapshot.employees,
  })

  const internalPct =
    snapshot.activeEmployees > 0
      ? Math.round((snapshot.internalEmployees / snapshot.activeEmployees) * 100)
      : 0
  const tempPct = 100 - internalPct

  // Per-week trend: split 28 days into 4 × 7-day groups
  const weekBuckets = [0, 1, 2, 3].map((w) => {
    const chunk = metrics.byDay.slice(w * 7, w * 7 + 7)
    const assigned = chunk.reduce((s, d) => s + d.totalAssigned, 0)
    const required = chunk.reduce((s, d) => s + d.totalRequired, 0)
    const open = chunk.reduce((s, d) => s + d.openPositions, 0)
    const weekStart = chunk[0]?.date ?? ''
    const weekEnd = chunk[chunk.length - 1]?.date ?? ''
    const pct = required > 0 ? Math.round((assigned / required) * 100) : 0
    return { weekStart, weekEnd, assigned, required, open, pct }
  })

  const hasData = snapshot.activeEmployees > 0 || snapshot.totalTemplates > 0

  // ── Forecasting v1: weekday-pattern baseline for next 7 days ─────────────
  const weekdayPatterns = computeWeekdayPatterns({
    assignments: snapshot.assignments,
    templates: snapshot.templates,
    employees: snapshot.employees,
    today,
  })
  const forecastDates = generateDates(addDays(today, 1), 7)
  const forecast = generateForecast({
    futureDates: forecastDates,
    patterns: weekdayPatterns,
    templates: snapshot.templates,
  })
  const forecastMaxSample = Math.max(0, ...forecast.entries.map((e) => e.sampleSize))

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Workforce analytics · {formatDateRange(startDate, today)}
        </p>
      </div>

      {!hasData ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-8 py-12 text-center">
          <p className="text-sm font-medium text-gray-600">No data yet</p>
          <p className="mt-1 text-xs text-gray-400">
            Add employees and shift templates to start seeing analytics.
          </p>
        </div>
      ) : (
        <>
          {/* ── Headline stats ─────────────────────────────────────────────── */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Overview
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Active employees"
                value={snapshot.activeEmployees}
                sub={`${snapshot.internalEmployees} internal · ${snapshot.tempEmployees} temp`}
                accent="gray"
              />
              <StatCard
                label="Shift templates"
                value={snapshot.totalTemplates}
                accent="gray"
              />
              <StatCard
                label="Assignments (28 days)"
                value={metrics.totalAssignments}
                accent="blue"
              />
              <StatCard
                label="Open positions (28 days)"
                value={metrics.totalOpen}
                sub={
                  metrics.understaffedInstances > 0
                    ? `${metrics.understaffedInstances} understaffed shift/day combos`
                    : 'All shifts fully covered'
                }
                accent={metrics.totalOpen > 0 ? 'red' : 'green'}
              />
            </div>
          </section>

          {/* ── Team composition ───────────────────────────────────────────── */}
          {snapshot.activeEmployees > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Team composition
              </h2>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      <span className="text-sm text-gray-700 font-medium">
                        {snapshot.internalEmployees} internal
                      </span>
                      <span className="text-xs text-gray-400">({internalPct}%)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                      <span className="text-sm text-gray-700 font-medium">
                        {snapshot.tempEmployees} temp
                      </span>
                      <span className="text-xs text-gray-400">({tempPct}%)</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {snapshot.activeEmployees} total active
                  </span>
                </div>
                <div className="h-3 rounded-full bg-orange-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${internalPct}%` }}
                  />
                </div>
                {/* Assignment mix this period */}
                {metrics.totalAssignments > 0 && (
                  <p className="mt-3 text-xs text-gray-400">
                    Assignment mix this period:{' '}
                    <span className="text-blue-600 font-medium">
                      {Math.round(metrics.internalRatio * 100)}% internal
                    </span>
                    {' · '}
                    <span className="text-orange-500 font-medium">
                      {Math.round((1 - metrics.internalRatio) * 100)}% temp
                    </span>
                  </p>
                )}
              </div>
            </section>
          )}

          {/* ── Weekly trend (last 4 weeks) ─────────────────────────────────── */}
          {metrics.totalAssignments > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Weekly trend · last 4 weeks
              </h2>
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/40">
                      <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400">
                        Week
                      </th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">
                        Required
                      </th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">
                        Assigned
                      </th>
                      <th className="px-5 py-2.5 text-xs font-medium text-gray-400 min-w-[160px]">
                        Coverage
                      </th>
                      <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-400">
                        Open
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {weekBuckets.map((week, i) => (
                      <tr
                        key={i}
                        className="hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="px-5 py-3 text-xs text-gray-600 whitespace-nowrap">
                          {week.weekStart && week.weekEnd
                            ? formatDateRange(week.weekStart, week.weekEnd)
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-xs text-gray-400">
                          {week.required}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-xs font-medium text-gray-700">
                          {week.assigned}
                        </td>
                        <td className="px-5 py-3">
                          <CoverageBar pct={week.pct} />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-xs">
                          {week.open > 0 ? (
                            <span className="text-red-500 font-medium">{week.open}</span>
                          ) : (
                            <span className="text-gray-300">–</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Per-template coverage ───────────────────────────────────────── */}
          {metrics.byTemplate.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Shift template coverage · 28 days
              </h2>
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/40">
                        <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400">
                          Template
                        </th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400">
                          Hours
                        </th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">
                          Req./day
                        </th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">
                          Total assigned
                        </th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">
                          Avg/day
                        </th>
                        <th className="px-5 py-2.5 text-xs font-medium text-gray-400 min-w-[160px]">
                          Coverage
                        </th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">
                          Open
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {metrics.byTemplate.map((tpl) => (
                        <TemplateRow key={tpl.templateId} tpl={tpl} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* ── Forecast: next 7 days ─────────────────────────────────────────── */}
          {snapshot.totalTemplates > 0 && forecast.entries.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Forecast · next 7 days
              </h2>
              <ForecastPanel forecast={forecast} maxSample={forecastMaxSample} />
            </section>
          )}
        </>
      )}
    </div>
  )
}

