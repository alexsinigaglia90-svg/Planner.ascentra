'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { DepartmentDayStats, DepartmentSummary } from '@/lib/demand'
import { formatDateLabel } from './Planner2View'

// ─── Coverage color helpers ──────────────────────────────────────────────────

function coverageColor(coverage: number): string {
  if (coverage >= 1) return 'bg-emerald-50 border-emerald-200 text-emerald-700'
  if (coverage >= 0.9) return 'bg-emerald-50/60 border-emerald-100 text-emerald-600'
  if (coverage >= 0.7) return 'bg-amber-50 border-amber-200 text-amber-700'
  return 'bg-red-50 border-red-200 text-red-700'
}

function coverageBg(coverage: number): string {
  if (coverage >= 1) return 'rgba(16, 185, 129, 0.12)'
  if (coverage >= 0.9) return 'rgba(16, 185, 129, 0.07)'
  if (coverage >= 0.7) return 'rgba(245, 158, 11, 0.1)'
  return 'rgba(239, 68, 68, 0.1)'
}

function statusDot(status: DepartmentDayStats['status']): string {
  switch (status) {
    case 'critical': return 'bg-red-500'
    case 'warning': return 'bg-amber-400'
    case 'good': return 'bg-emerald-500'
    case 'over': return 'bg-blue-400'
  }
}

// ─── Summary KPI Cards ──────────────────────────────────────────────────────

function SummaryCards({ summaries }: { summaries: DepartmentSummary[] }) {
  const totalRequired = summaries.reduce((s, d) => s + d.totalRequired, 0)
  const totalAssigned = summaries.reduce((s, d) => s + d.totalAssigned, 0)
  const overallCoverage = totalRequired > 0 ? totalAssigned / totalRequired : 1
  const criticalCount = summaries.reduce((s, d) => s + d.criticalDays, 0)
  const warningCount = summaries.reduce((s, d) => s + d.warningDays, 0)

  const kpis = [
    { label: 'Dekking', value: `${Math.round(overallCoverage * 100)}%`, sub: `${totalAssigned}/${totalRequired} slots`, color: overallCoverage >= 0.9 ? 'text-emerald-600' : overallCoverage >= 0.7 ? 'text-amber-600' : 'text-red-600' },
    { label: 'Afdelingen', value: String(summaries.length), sub: 'actief', color: 'text-gray-900' },
    { label: 'Kritiek', value: String(criticalCount), sub: 'dag-slots', color: criticalCount > 0 ? 'text-red-600' : 'text-gray-400' },
    { label: 'Waarschuwing', value: String(warningCount), sub: 'dag-slots', color: warningCount > 0 ? 'text-amber-600' : 'text-gray-400' },
  ]

  return (
    <div className="grid grid-cols-4 gap-3">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{kpi.label}</p>
          <p className={`text-xl font-bold tabular-nums mt-0.5 ${kpi.color}`}>{kpi.value}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{kpi.sub}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Department Row ──────────────────────────────────────────────────────────

function DepartmentRow({
  summary,
  dayStats,
  dates,
  onSelectDepartment,
  onSelectCell,
  index,
}: {
  summary: DepartmentSummary
  dayStats: DepartmentDayStats[]
  dates: string[]
  onSelectDepartment: (id: string) => void
  onSelectCell: (deptId: string, date: string) => void
  index: number
}) {
  const statsByDate = useMemo(() => {
    const map = new Map<string, DepartmentDayStats>()
    for (const s of dayStats) map.set(s.date, s)
    return map
  }, [dayStats])

  const coveragePct = Math.round(summary.weekCoverage * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className="flex items-stretch gap-0 rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* Department label — clickable */}
      <button
        type="button"
        onClick={() => onSelectDepartment(summary.id)}
        className="shrink-0 w-48 px-4 py-3 text-left border-r border-gray-100 hover:bg-gray-50 transition-colors group"
      >
        <div className="flex items-center gap-2.5">
          {summary.color && (
            <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: summary.color }} />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-gray-700">{summary.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs font-bold tabular-nums ${coveragePct >= 90 ? 'text-emerald-600' : coveragePct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                {coveragePct}%
              </span>
              <span className="text-[10px] text-gray-400 tabular-nums">
                {summary.totalAssigned}/{summary.totalRequired}
              </span>
            </div>
          </div>
        </div>
      </button>

      {/* Day cells */}
      <div className="flex-1 flex items-stretch">
        {dates.map((date) => {
          const stat = statsByDate.get(date)
          if (!stat) {
            return <div key={date} className="flex-1 border-r border-gray-50 last:border-r-0" />
          }

          const pct = Math.round(stat.coverage * 100)

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectCell(summary.id, date)}
              className="flex-1 border-r border-gray-50 last:border-r-0 px-1 py-2 hover:brightness-95 transition-all group/cell relative"
              style={{ backgroundColor: coverageBg(stat.coverage) }}
              title={`${summary.name} — ${formatDateLabel(date).day} ${formatDateLabel(date).date}: ${stat.directAssigned}/${stat.required} (${pct}%)`}
            >
              <div className="flex flex-col items-center gap-1">
                {/* Status dot */}
                <div className={`h-1.5 w-1.5 rounded-full ${statusDot(stat.status)}`} />
                {/* Coverage */}
                <span className="text-xs font-bold tabular-nums text-gray-700">{pct}%</span>
                {/* Counts */}
                <span className="text-[9px] tabular-nums text-gray-400">
                  {stat.directAssigned}/{stat.required}
                </span>
              </div>

              {/* Shift breakdown on hover */}
              <div className="absolute inset-x-0 bottom-0 h-1 flex gap-px opacity-0 group-hover/cell:opacity-100 transition-opacity">
                {stat.shiftBreakdown.map((shift) => (
                  <div
                    key={shift.shiftTemplateId}
                    className="flex-1 rounded-t-sm"
                    style={{
                      backgroundColor:
                        shift.status === 'understaffed' ? '#ef4444'
                        : shift.status === 'overstaffed' ? '#3b82f6'
                        : '#10b981',
                      opacity: 0.6,
                    }}
                  />
                ))}
              </div>
            </button>
          )
        })}
      </div>
    </motion.div>
  )
}

// ─── Main Bird's Eye View ────────────────────────────────────────────────────

interface Props {
  dates: string[]
  departments: { id: string; name: string; color?: string | null }[]
  deptDayStats: DepartmentDayStats[]
  deptSummaries: DepartmentSummary[]
  onSelectDepartment: (id: string) => void
  onSelectCell: (deptId: string, date: string) => void
}

export function BirdsEyeView({
  dates,
  departments,
  deptDayStats,
  deptSummaries,
  onSelectDepartment,
  onSelectCell,
}: Props) {
  // Group stats by department
  const statsByDept = useMemo(() => {
    const map = new Map<string, DepartmentDayStats[]>()
    for (const s of deptDayStats) {
      const list = map.get(s.departmentId) ?? []
      list.push(s)
      map.set(s.departmentId, list)
    }
    return map
  }, [deptDayStats])

  // Detect week boundaries for visual grouping
  const weekStarts = useMemo(() => {
    const starts = new Set<string>()
    let lastWeek = -1
    for (const date of dates) {
      const d = new Date(date + 'T00:00:00')
      const week = getISOWeek(d)
      if (week !== lastWeek) {
        starts.add(date)
        lastWeek = week
      }
    }
    return starts
  }, [dates])

  if (deptSummaries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white px-8 py-16 text-center">
        <p className="text-sm font-semibold text-gray-900 mb-1">Geen afdelingen met shifts</p>
        <p className="text-[13px] text-gray-500 max-w-sm mx-auto">
          Koppel shift templates aan afdelingen om het planningsoverzicht te activeren.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <SummaryCards summaries={deptSummaries} />

      {/* Date header */}
      <div className="flex items-stretch gap-0">
        <div className="shrink-0 w-48" />
        <div className="flex-1 flex items-stretch">
          {dates.map((date) => {
            const label = formatDateLabel(date)
            const isToday = date === new Date().toISOString().slice(0, 10)
            const isWeekStart = weekStarts.has(date)
            return (
              <div
                key={date}
                className={`flex-1 text-center py-1.5 ${isWeekStart && date !== dates[0] ? 'border-l-2 border-gray-200' : ''}`}
              >
                <p className={`text-[10px] font-medium ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>
                  {label.day}
                </p>
                <p className={`text-xs font-bold tabular-nums ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                  {label.date}
                </p>
                <p className="text-[9px] text-gray-300">{label.month}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Department rows */}
      <div className="space-y-2">
        {deptSummaries.map((summary, i) => (
          <DepartmentRow
            key={summary.id}
            summary={summary}
            dayStats={statsByDept.get(summary.id) ?? []}
            dates={dates}
            onSelectDepartment={onSelectDepartment}
            onSelectCell={onSelectCell}
            index={i}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 pt-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Status</span>
        {[
          { color: 'bg-emerald-500', label: 'Volledig bezet' },
          { color: 'bg-amber-400', label: 'Aandacht (70-90%)' },
          { color: 'bg-red-500', label: 'Kritiek (<70%)' },
          { color: 'bg-blue-400', label: 'Overbezet' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${item.color}`} />
            <span className="text-[10px] text-gray-500">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function getISOWeek(d: Date): number {
  const date = new Date(d.getTime())
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
  const week1 = new Date(date.getFullYear(), 0, 4)
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}
