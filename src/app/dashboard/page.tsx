import { getAnalyticsSnapshot } from '@/lib/queries/analytics'
import { getCurrentContext } from '@/lib/auth/context'
import { computeMetrics, type TemplateMetrics } from '@/lib/analytics'
import { computeWeekdayPatterns, generateForecast } from '@/lib/forecasting'
import AscentrAIBar from '@/components/AscentrAIBar'
import DailySummary from '@/components/DailySummary'
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
    red: 'text-red-600',
    amber: 'text-amber-700',
    green: 'text-emerald-600',
    gray: 'text-gray-900',
  }
  const accentColors = {
    blue: '#4F6BFF',
    red: '#EF4444',
    amber: '#F59E0B',
    green: '#10B981',
    gray: '#D1D5DB',
  }
  const accentVar = { '--stat-accent': accentColors[accent ?? 'gray'] } as React.CSSProperties
  return (
    <div className="ds-stat-card" style={accentVar}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
        {label}
      </div>
      <div className={`text-[28px] font-bold tabular-nums leading-none ${valueColors[accent ?? 'gray']}`}>
        {value}
      </div>
      {sub && (
        <div className="mt-2.5 text-[11px] text-gray-400 leading-snug">{sub}</div>
      )}
    </div>
  )
}

function CoverageBar({ pct }: { pct: number }) {
  const color =
    pct >= 90
      ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
      : pct >= 60
        ? 'bg-gradient-to-r from-amber-300 to-amber-400'
        : 'bg-gradient-to-r from-red-400 to-red-500'
  const textColor =
    pct >= 90 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-red-500'
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-2 rounded-full bg-gray-100/80 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-semibold tabular-nums w-9 text-right ${textColor}`}>
        {pct}%
      </span>
    </div>
  )
}

function TemplateRow({ tpl }: { tpl: TemplateMetrics }) {
  const pct = Math.round(tpl.coverageRate * 100)
  const avgLabel = tpl.averageAssigned.toFixed(1)
  return (
    <tr className="ds-table-row">
      <td className="ds-table-td ds-table-td-primary whitespace-nowrap">
        {tpl.templateName}
      </td>
      <td className="ds-table-td ds-table-td-meta whitespace-nowrap">
        {tpl.startTime}–{tpl.endTime}
      </td>
      <td className="ds-table-td ds-table-td-meta text-right tabular-nums">
        {tpl.requiredPerDay}
      </td>
      <td className="ds-table-td ds-table-td-secondary text-right tabular-nums">
        {tpl.totalAssignedInPeriod}
      </td>
      <td className="ds-table-td ds-table-td-meta text-right tabular-nums">{avgLabel}/day</td>
      <td className="ds-table-td min-w-[140px]">
        <CoverageBar pct={pct} />
      </td>
      <td className="ds-table-td text-right tabular-nums text-xs">
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
    <div className="space-y-10">
      {/* Daily summary */}
      <DailySummary />

      {/* AscentrAI insights */}
      <AscentrAIBar />

      {/* Page header */}
      <div className="flex items-end justify-between pb-6 border-b border-gray-100">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#0B0B0C]">Dashboard</h1>
          <p className="mt-1.5 text-sm text-gray-400">
            Workforce analytics · {formatDateRange(startDate, today)}
          </p>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-300 bg-gray-50 rounded-full px-3 py-1 border border-gray-100">
          28-day view
        </span>
      </div>

      {!hasData ? (
        <div className="ds-card px-8 py-12 text-center">
          <p className="text-sm font-medium text-gray-600">No data yet</p>
          <p className="mt-1 text-xs text-gray-400">
            Add employees and shift templates to start seeing analytics.
          </p>
        </div>
      ) : (
        <>
          {/* ── Headline stats ─────────────────────────────────────────────── */}
          <section>
            <h2 className="ds-section-heading mb-4">Overview</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
              <h2 className="ds-section-heading mb-4">Team composition</h2>
              <div className="ds-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-5">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 shadow-sm" />
                      <span className="text-sm text-gray-700 font-semibold">
                        {snapshot.internalEmployees}
                      </span>
                      <span className="text-xs text-gray-400">internal</span>
                      <span className="text-[10px] text-gray-300 font-medium">({internalPct}%)</span>
                    </div>
                    <div className="w-px h-4 bg-gray-200" />
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-br from-orange-300 to-orange-500 shadow-sm" />
                      <span className="text-sm text-gray-700 font-semibold">
                        {snapshot.tempEmployees}
                      </span>
                      <span className="text-xs text-gray-400">temp</span>
                      <span className="text-[10px] text-gray-300 font-medium">({tempPct}%)</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-300">
                    {snapshot.activeEmployees} total
                  </span>
                </div>
                <div className="h-3.5 rounded-full bg-orange-100/80 overflow-hidden shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-500"
                    style={{ width: `${internalPct}%` }}
                  />
                </div>
                {metrics.totalAssignments > 0 && (
                  <div className="mt-4 pt-3.5 border-t border-gray-100/80 flex items-center gap-1.5 text-[11px] text-gray-400">
                    <span>Assignment mix this period:</span>
                    <span className="text-blue-600 font-semibold">
                      {Math.round(metrics.internalRatio * 100)}% internal
                    </span>
                    <span>·</span>
                    <span className="text-orange-500 font-semibold">
                      {Math.round((1 - metrics.internalRatio) * 100)}% temp
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Weekly trend (last 4 weeks) ─────────────────────────────────── */}
          {metrics.totalAssignments > 0 && (
            <section>
              <h2 className="ds-section-heading mb-4">
                Weekly trend · last 4 weeks
              </h2>
              <div className="ds-table-wrap">
                <table className="w-full text-sm">
                  <thead className="ds-table-head">
                    <tr>
                      <th className="ds-table-th">Week</th>
                      <th className="ds-table-th ds-table-th-right">Required</th>
                      <th className="ds-table-th ds-table-th-right">Assigned</th>
                      <th className="ds-table-th min-w-[160px]">Coverage</th>
                      <th className="ds-table-th ds-table-th-right">Open</th>
                    </tr>
                  </thead>
                  <tbody className="ds-table-body">
                    {weekBuckets.map((week, i) => (
                      <tr key={i} className="ds-table-row">
                        <td className="ds-table-td ds-table-td-secondary whitespace-nowrap">
                          {week.weekStart && week.weekEnd
                            ? formatDateRange(week.weekStart, week.weekEnd)
                            : '—'}
                        </td>
                        <td className="ds-table-td ds-table-td-meta text-right tabular-nums">
                          {week.required}
                        </td>
                        <td className="ds-table-td ds-table-td-secondary text-right tabular-nums">
                          {week.assigned}
                        </td>
                        <td className="ds-table-td">
                          <CoverageBar pct={week.pct} />
                        </td>
                        <td className="ds-table-td text-right tabular-nums text-xs">
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
              <h2 className="ds-section-heading mb-4">
                Shift template coverage · 28 days
              </h2>
              <div className="ds-table-wrap">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="ds-table-head">
                      <tr>
                        <th className="ds-table-th">Template</th>
                        <th className="ds-table-th">Hours</th>
                        <th className="ds-table-th ds-table-th-right">Req./day</th>
                        <th className="ds-table-th ds-table-th-right">Total assigned</th>
                        <th className="ds-table-th ds-table-th-right">Avg/day</th>
                        <th className="ds-table-th min-w-[160px]">Coverage</th>
                        <th className="ds-table-th ds-table-th-right">Open</th>
                      </tr>
                    </thead>
                    <tbody className="ds-table-body">
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
              <h2 className="ds-section-heading mb-4">
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

