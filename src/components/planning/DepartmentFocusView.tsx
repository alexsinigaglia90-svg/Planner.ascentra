'use client'

import { useMemo } from 'react'
import type { ShiftTemplate } from '@prisma/client'
import type { EmployeeWithContext } from '@/lib/queries/employees'
import type { ProcessRow } from '@/lib/queries/processes'
import type { DepartmentDayStats } from '@/lib/demand'
import { LEVEL_COLORS, LEVEL_LABELS } from '@/components/workforce/SkillLevelIndicator'
import { formatDateLabel } from './Planner2View'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DeptInfo {
  id: string
  name: string
  color?: string | null
}

interface Props {
  department: DeptInfo
  dates: string[]
  templates: ShiftTemplate[]
  stats: DepartmentDayStats[]
  employees: EmployeeWithContext[]
  processes: ProcessRow[]
  processLevelMap: Map<string, number>
  onSelectShift: (deptId: string, date: string, shiftTemplateId: string) => void
  onBack: () => void
  canEdit: boolean
}

// ─── Shift Slot Cell ─────────────────────────────────────────────────────────

function ShiftSlotCell({
  shiftName,
  required,
  directAssigned,
  status,
  assignedEmployees,
  processLevelMap,
  processes,
  onClick,
}: {
  shiftName: string
  required: number
  directAssigned: number
  status: 'understaffed' | 'staffed' | 'overstaffed'
  assignedEmployees: { id: string; name: string; employeeType: string; isOverhead: boolean }[]
  processLevelMap: Map<string, number>
  processes: ProcessRow[]
  onClick: () => void
}) {
  const statusColor =
    status === 'understaffed' ? 'border-red-200 bg-red-50/40'
    : status === 'overstaffed' ? 'border-blue-200 bg-blue-50/40'
    : 'border-emerald-200 bg-emerald-50/30'

  const statusDotColor =
    status === 'understaffed' ? 'bg-red-500'
    : status === 'overstaffed' ? 'bg-blue-400'
    : 'bg-emerald-500'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border p-2 text-left hover:shadow-md transition-all group ${statusColor}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <div className={`h-1.5 w-1.5 rounded-full ${statusDotColor}`} />
          <span className="text-[10px] font-semibold text-gray-600">{shiftName}</span>
        </div>
        <span className="text-[10px] font-bold tabular-nums text-gray-500">
          {directAssigned}/{required}
        </span>
      </div>

      {/* Employee dots — max 8, then +N */}
      <div className="flex items-center gap-1 flex-wrap">
        {assignedEmployees.slice(0, 8).map((emp) => {
          // Find best process level for this employee
          const maxLevel = processes.reduce((best, proc) => {
            const level = processLevelMap.get(`${emp.id}:${proc.id}`) ?? 0
            return Math.max(best, level)
          }, 0)

          const initials = emp.name
            .split(' ')
            .map((w) => w[0])
            .slice(0, 2)
            .join('')
            .toUpperCase()

          return (
            <div
              key={emp.id}
              className="relative flex h-6 w-6 items-center justify-center rounded-full text-[8px] font-bold text-white shrink-0"
              style={{
                backgroundColor: LEVEL_COLORS[maxLevel] ?? '#d1d5db',
                opacity: emp.isOverhead ? 0.5 : 1,
              }}
              title={`${emp.name} — ${LEVEL_LABELS[maxLevel]} (Level ${maxLevel})${emp.isOverhead ? ' (overhead)' : ''}`}
            >
              {initials}
              {emp.employeeType === 'temp' && (
                <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-orange-400 border border-white" />
              )}
            </div>
          )
        })}
        {assignedEmployees.length > 8 && (
          <span className="text-[9px] text-gray-400 font-medium">+{assignedEmployees.length - 8}</span>
        )}
        {/* Open slots as empty circles */}
        {Array.from({ length: Math.max(0, required - directAssigned) }).map((_, i) => (
          <div
            key={`open-${i}`}
            className="h-6 w-6 rounded-full border-2 border-dashed border-gray-300 shrink-0 opacity-40"
          />
        ))}
      </div>
    </button>
  )
}

// ─── Coverage Bar ────────────────────────────────────────────────────────────

function CoverageBar({ required, assigned }: { required: number; assigned: number }) {
  const pct = required > 0 ? Math.min(1, assigned / required) : 1
  const color = pct >= 1 ? '#10b981' : pct >= 0.7 ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-bold tabular-nums text-gray-500 w-8 text-right">
        {Math.round(pct * 100)}%
      </span>
    </div>
  )
}

// ─── Employee Roster Panel ───────────────────────────────────────────────────

function EmployeeRosterPanel({
  employees,
  processes,
  processLevelMap,
}: {
  employees: EmployeeWithContext[]
  processes: ProcessRow[]
  processLevelMap: Map<string, number>
}) {
  if (employees.length === 0) return null

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
        Team ({employees.length})
      </h3>
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
        {employees.map((emp) => {
          const initials = emp.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

          return (
            <div key={emp.id} className="flex items-center gap-2.5 py-1">
              <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-semibold text-gray-500 shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{emp.name}</p>
                <p className="text-[10px] text-gray-400">{emp.contractHours}u/w</p>
              </div>
              {/* Mini skill indicators for department processes */}
              <div className="flex items-center gap-0.5 shrink-0">
                {processes.slice(0, 6).map((proc) => {
                  const level = processLevelMap.get(`${emp.id}:${proc.id}`) ?? 0
                  return (
                    <div
                      key={proc.id}
                      className="h-3 w-3 rounded-sm"
                      style={{
                        backgroundColor: level > 0 ? LEVEL_COLORS[level] : '#e5e7eb',
                        opacity: level > 0 ? 0.7 : 0.3,
                      }}
                      title={`${proc.name}: ${LEVEL_LABELS[level]} (${level})`}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Department Focus View ──────────────────────────────────────────────

export function DepartmentFocusView({
  department,
  dates,
  templates,
  stats,
  employees,
  processes,
  processLevelMap,
  onSelectShift,
  onBack,
}: Props) {
  // Index stats by date
  const statsByDate = useMemo(() => {
    const map = new Map<string, DepartmentDayStats>()
    for (const s of stats) map.set(s.date, s)
    return map
  }, [stats])

  // Department-level KPIs
  const totalRequired = stats.reduce((s, e) => s + e.required, 0)
  const totalAssigned = stats.reduce((s, e) => s + e.directAssigned, 0)
  const overallCoverage = totalRequired > 0 ? totalAssigned / totalRequired : 1
  const criticalDays = stats.filter((s) => s.status === 'critical').length
  const understaffedShifts = stats.reduce(
    (count, s) => count + s.shiftBreakdown.filter((sh) => sh.status === 'understaffed').length,
    0,
  )

  // Detect week boundaries
  const weekStarts = useMemo(() => {
    const starts = new Set<string>()
    let lastWeek = -1
    for (const date of dates) {
      const d = new Date(date + 'T00:00:00')
      const day = d.getDay() === 0 ? 7 : d.getDay()
      if (day === 1 || lastWeek === -1) {
        starts.add(date)
        lastWeek = day
      }
    }
    return starts
  }, [dates])

  return (
    <div className="space-y-4">
      {/* Department header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {department.color && (
            <div className="h-4 w-4 rounded-full" style={{ backgroundColor: department.color }} />
          )}
          <div>
            <h2 className="text-lg font-bold text-gray-900">{department.name}</h2>
            <p className="text-xs text-gray-500">
              {templates.length} shift{templates.length !== 1 ? 's' : ''} &middot; {employees.length} medewerkers
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          &larr; Terug naar overzicht
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Dekking</p>
          <p className={`text-xl font-bold tabular-nums mt-0.5 ${overallCoverage >= 0.9 ? 'text-emerald-600' : overallCoverage >= 0.7 ? 'text-amber-600' : 'text-red-600'}`}>
            {Math.round(overallCoverage * 100)}%
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Bezetting</p>
          <p className="text-xl font-bold tabular-nums mt-0.5 text-gray-900">{totalAssigned}/{totalRequired}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Kritieke dagen</p>
          <p className={`text-xl font-bold tabular-nums mt-0.5 ${criticalDays > 0 ? 'text-red-600' : 'text-gray-400'}`}>{criticalDays}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Open shifts</p>
          <p className={`text-xl font-bold tabular-nums mt-0.5 ${understaffedShifts > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{understaffedShifts}</p>
        </div>
      </div>

      {/* Main grid: shifts × dates */}
      <div className="flex gap-4">
        {/* Grid area */}
        <div className="flex-1 min-w-0">
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="sticky left-0 z-10 bg-white px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400 w-24 min-w-[96px]">
                    Shift
                  </th>
                  {dates.map((date) => {
                    const label = formatDateLabel(date)
                    const isToday = date === new Date().toISOString().slice(0, 10)
                    const isWeekStart = weekStarts.has(date) && date !== dates[0]
                    return (
                      <th
                        key={date}
                        className={`px-1.5 py-2 text-center min-w-[100px] ${isWeekStart ? 'border-l-2 border-gray-200' : ''}`}
                      >
                        <p className={`text-[10px] font-medium ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>{label.day}</p>
                        <p className={`text-xs font-bold tabular-nums ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>{label.date}</p>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {templates.map((tpl, tplIdx) => (
                  <tr key={tpl.id} className={tplIdx > 0 ? 'border-t border-gray-100' : ''}>
                    {/* Shift label */}
                    <td className="sticky left-0 z-10 bg-white px-3 py-2.5 border-r border-gray-100">
                      <p className="text-xs font-semibold text-gray-700">{tpl.name}</p>
                      <p className="text-[10px] text-gray-400">{tpl.startTime} - {tpl.endTime}</p>
                    </td>
                    {/* Day cells */}
                    {dates.map((date) => {
                      const dayStat = statsByDate.get(date)
                      const shiftStat = dayStat?.shiftBreakdown.find((s) => s.shiftTemplateId === tpl.id)
                      const isWeekStart = weekStarts.has(date) && date !== dates[0]

                      if (!shiftStat) {
                        return <td key={date} className={`px-1.5 py-1.5 ${isWeekStart ? 'border-l-2 border-gray-200' : ''}`} />
                      }

                      return (
                        <td key={date} className={`px-1.5 py-1.5 ${isWeekStart ? 'border-l-2 border-gray-200' : ''}`}>
                          <ShiftSlotCell
                            shiftName={tpl.name}
                            required={shiftStat.required}
                            directAssigned={shiftStat.directAssigned}
                            status={shiftStat.status}
                            assignedEmployees={shiftStat.assignedEmployees}
                            processLevelMap={processLevelMap}
                            processes={processes}
                            onClick={() => onSelectShift(department.id, date, tpl.id)}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {/* Coverage row */}
                <tr className="border-t border-gray-200 bg-gray-50/50">
                  <td className="sticky left-0 z-10 bg-gray-50/50 px-3 py-2 border-r border-gray-100">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Totaal</p>
                  </td>
                  {dates.map((date) => {
                    const dayStat = statsByDate.get(date)
                    const isWeekStart = weekStarts.has(date) && date !== dates[0]
                    if (!dayStat) return <td key={date} className={isWeekStart ? 'border-l-2 border-gray-200' : ''} />
                    return (
                      <td key={date} className={`px-2 py-2 ${isWeekStart ? 'border-l-2 border-gray-200' : ''}`}>
                        <CoverageBar required={dayStat.required} assigned={dayStat.directAssigned} />
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Side panel: team roster */}
        <div className="shrink-0 w-64">
          <EmployeeRosterPanel
            employees={employees}
            processes={processes}
            processLevelMap={processLevelMap}
          />
        </div>
      </div>
    </div>
  )
}
