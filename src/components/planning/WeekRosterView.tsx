'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { ShiftTemplate } from '@prisma/client'
import type { DepartmentDayStats } from '@/lib/demand'
import type { ManpowerTarget, WeekdayName } from '@/lib/manpower'
import type { TeamWithSlots } from '@/lib/queries/teams'
import { getActiveShiftTemplateIdForTeam } from '@/lib/teams'
import { formatDateLabel } from './Planner2View'

// ─── Types ───────────────────────────────────────────────────────────────────

interface TeamInfo {
  id: string
  name: string
  color: string | null
  employeeCount: number
}

interface SlotData {
  date: string
  shiftTemplateId: string
  required: number
  assigned: number
  teams: TeamInfo[]
  status: 'critical' | 'warning' | 'good' | 'over' | 'no-demand'
}

interface Props {
  dates: string[]
  templates: ShiftTemplate[]
  deptDayStats: DepartmentDayStats[]
  demandTargetsMap?: Map<string, ManpowerTarget>
  teams: TeamWithSlots[]
  /** employeeId → teamId — used to count ploeg size */
  employeeTeamCounts: Map<string, number>  // teamId → headcount
  onSelectSlot: (date: string, shiftTemplateId: string) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseHHMM(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function weekdayFromDate(dateStr: string): WeekdayName {
  const names: WeekdayName[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return names[new Date(dateStr + 'T00:00:00').getDay()]
}

function coveragePct(required: number, assigned: number): number {
  if (required === 0) return 1
  return Math.min(1, assigned / required)
}

function slotStatus(required: number, assigned: number): SlotData['status'] {
  if (required === 0) return 'no-demand'
  const pct = assigned / required
  if (pct >= 1.05) return 'over'
  if (pct >= 0.9) return 'good'
  if (pct >= 0.7) return 'warning'
  return 'critical'
}

const STATUS_BG: Record<SlotData['status'], string> = {
  critical: 'bg-red-50 border-red-200',
  warning: 'bg-amber-50 border-amber-100',
  good: 'bg-emerald-50 border-emerald-200',
  over: 'bg-sky-50 border-sky-200',
  'no-demand': 'bg-gray-50 border-gray-100',
}

const STATUS_BAR: Record<SlotData['status'], string> = {
  critical: 'bg-red-400',
  warning: 'bg-amber-400',
  good: 'bg-emerald-400',
  over: 'bg-sky-400',
  'no-demand': 'bg-gray-200',
}

const STATUS_TEXT: Record<SlotData['status'], string> = {
  critical: 'text-red-600',
  warning: 'text-amber-600',
  good: 'text-emerald-600',
  over: 'text-sky-600',
  'no-demand': 'text-gray-400',
}

// ─── Week grouping ────────────────────────────────────────────────────────────

function groupByWeek(dates: string[]): { weekLabel: string; dates: string[] }[] {
  const groups: { weekLabel: string; dates: string[] }[] = []
  let current: string[] = []
  let currentWeek = ''

  for (const date of dates) {
    const d = new Date(date + 'T00:00:00')
    const monday = new Date(d)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    monday.setDate(d.getDate() + diff)
    const weekKey = monday.toISOString().slice(0, 10)

    if (weekKey !== currentWeek) {
      if (current.length > 0) groups.push({ weekLabel: formatWeekLabel(currentWeek), dates: current })
      currentWeek = weekKey
      current = []
    }
    current.push(date)
  }
  if (current.length > 0) groups.push({ weekLabel: formatWeekLabel(currentWeek), dates: current })
  return groups
}

function formatWeekLabel(monday: string): string {
  const d = new Date(monday + 'T00:00:00')
  const wk = getISOWeek(d)
  return `W${wk}`
}

function getISOWeek(d: Date): number {
  const date = new Date(d)
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function WeekRosterView({
  dates,
  templates,
  deptDayStats,
  demandTargetsMap,
  teams,
  employeeTeamCounts,
  onSelectSlot,
}: Props) {
  // Sort templates by start time
  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => parseHHMM(a.startTime) - parseHHMM(b.startTime)),
    [templates],
  )

  // Aggregate required + assigned per (shift, date) across all departments
  const shiftDayMap = useMemo(() => {
    const map = new Map<string, { required: number; assigned: number }>()
    for (const stat of deptDayStats) {
      for (const shift of stat.shiftBreakdown) {
        const key = `${stat.date}:${shift.shiftTemplateId}`
        const existing = map.get(key) ?? { required: 0, assigned: 0 }
        existing.required += shift.required
        existing.assigned += shift.directAssigned
        map.set(key, existing)
      }
    }
    // Override required with volume-driven targets when available
    if (demandTargetsMap) {
      for (const date of dates) {
        const weekday = weekdayFromDate(date)
        for (const tpl of templates) {
          const target = demandTargetsMap.get(tpl.id)
          const volumeFTE = target?.weekdayHeadcounts?.[weekday]
          if (volumeFTE !== undefined) {
            const key = `${date}:${tpl.id}`
            const existing = map.get(key) ?? { required: 0, assigned: 0 }
            existing.required = volumeFTE
            map.set(key, existing)
          }
        }
      }
    }
    return map
  }, [deptDayStats, demandTargetsMap, dates, templates])

  // Ploeg map: "date:shiftId" → TeamInfo[]
  const ploegMap = useMemo(() => {
    const map = new Map<string, TeamInfo[]>()
    for (const team of teams) {
      for (const date of dates) {
        const activeShiftId = getActiveShiftTemplateIdForTeam(team, date)
        if (!activeShiftId) continue
        const key = `${date}:${activeShiftId}`
        const existing = map.get(key) ?? []
        existing.push({
          id: team.id,
          name: team.name,
          color: team.color,
          employeeCount: employeeTeamCounts.get(team.id) ?? 0,
        })
        map.set(key, existing)
      }
    }
    return map
  }, [teams, dates, employeeTeamCounts])

  // Build slot data
  const slotMap = useMemo(() => {
    const map = new Map<string, SlotData>()
    for (const date of dates) {
      for (const tpl of sortedTemplates) {
        const key = `${date}:${tpl.id}`
        const agg = shiftDayMap.get(key) ?? { required: 0, assigned: 0 }
        const teams = ploegMap.get(key) ?? []
        map.set(key, {
          date,
          shiftTemplateId: tpl.id,
          required: agg.required,
          assigned: agg.assigned,
          teams,
          status: slotStatus(agg.required, agg.assigned),
        })
      }
    }
    return map
  }, [dates, sortedTemplates, shiftDayMap, ploegMap])

  // KPI summary
  const summary = useMemo(() => {
    let totalRequired = 0
    let totalAssigned = 0
    let critical = 0
    let warning = 0
    for (const slot of slotMap.values()) {
      if (slot.status === 'no-demand') continue
      totalRequired += slot.required
      totalAssigned += slot.assigned
      if (slot.status === 'critical') critical++
      if (slot.status === 'warning') warning++
    }
    return { totalRequired, totalAssigned, critical, warning }
  }, [slotMap])

  const weekGroups = useMemo(() => groupByWeek(dates), [dates])

  if (sortedTemplates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-gray-400">Geen shift templates geconfigureerd.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'FTE nodig', value: summary.totalRequired, sub: 'totaal gevraagd', color: 'text-gray-900' },
          { label: 'Ingevuld', value: summary.totalAssigned, sub: `${summary.totalRequired > 0 ? Math.round((summary.totalAssigned / summary.totalRequired) * 100) : 100}% dekking`, color: 'text-emerald-600' },
          { label: 'Kritiek', value: summary.critical, sub: 'shift-slots', color: summary.critical > 0 ? 'text-red-600' : 'text-gray-400' },
          { label: 'Waarschuwing', value: summary.warning, sub: 'shift-slots', color: summary.warning > 0 ? 'text-amber-600' : 'text-gray-400' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{kpi.label}</p>
            <p className={`text-xl font-bold tabular-nums mt-0.5 ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{kpi.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Roster grid */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs min-w-[640px]">
            <thead>
              {/* Week labels */}
              <tr className="border-b border-gray-100">
                <th className="w-28 px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-50" />
                {weekGroups.map((wg) => (
                  <th
                    key={wg.weekLabel}
                    colSpan={wg.dates.length}
                    className="px-2 py-1.5 text-[10px] font-bold text-gray-500 bg-gray-50 border-l border-gray-200 text-center"
                  >
                    {wg.weekLabel}
                  </th>
                ))}
              </tr>
              {/* Day labels */}
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="w-28 px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Shift
                </th>
                {dates.map((date, i) => {
                  const lbl = formatDateLabel(date)
                  const isFirstInWeek = i === 0 || new Date(date + 'T00:00:00').getDay() === 1
                  return (
                    <th
                      key={date}
                      className={`px-1 py-2 text-center ${isFirstInWeek && i > 0 ? 'border-l border-gray-200' : ''}`}
                    >
                      <span className="block font-semibold text-gray-500">{lbl.day}</span>
                      <span className="block font-bold text-gray-800 tabular-nums">{lbl.date}</span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedTemplates.map((tpl, tplIdx) => (
                <motion.tr
                  key={tpl.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: tplIdx * 0.04 }}
                  className="group"
                >
                  {/* Shift label */}
                  <td className="px-4 py-2 bg-gray-50 border-r border-gray-200">
                    <p className="font-semibold text-gray-900 truncate max-w-[80px]">{tpl.name}</p>
                    <p className="text-[10px] text-gray-400 tabular-nums">{tpl.startTime}–{tpl.endTime}</p>
                  </td>

                  {/* Slot cells */}
                  {dates.map((date, dateIdx) => {
                    const isFirstInWeek = dateIdx === 0 || new Date(date + 'T00:00:00').getDay() === 1
                    const slot = slotMap.get(`${date}:${tpl.id}`)
                    if (!slot) return <td key={date} className={`px-1 py-1.5 ${isFirstInWeek && dateIdx > 0 ? 'border-l border-gray-200' : ''}`} />

                    const pct = coveragePct(slot.required, slot.assigned)

                    return (
                      <td
                        key={date}
                        className={`px-1 py-1.5 ${isFirstInWeek && dateIdx > 0 ? 'border-l border-gray-200' : ''}`}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectSlot(date, tpl.id)}
                          className={`w-full rounded-lg border p-1.5 text-left transition-all duration-150 hover:shadow-sm hover:-translate-y-px cursor-pointer ${STATUS_BG[slot.status]}`}
                        >
                          {/* Ploeg badges */}
                          <div className="flex flex-wrap gap-0.5 mb-1 min-h-[14px]">
                            {slot.teams.map((team) => (
                              <span
                                key={team.id}
                                className="inline-block rounded px-1 py-0.5 text-[9px] font-bold text-white leading-none"
                                style={{ backgroundColor: team.color ?? '#6366f1' }}
                                title={`${team.name} (${team.employeeCount} pers.)`}
                              >
                                {team.name.replace(/^Ploeg\s*/i, '')}
                              </span>
                            ))}
                            {slot.teams.length === 0 && (
                              <span className="text-[9px] text-gray-300 italic">–</span>
                            )}
                          </div>

                          {/* FTE count */}
                          <div className={`text-[10px] font-bold tabular-nums leading-none ${STATUS_TEXT[slot.status]}`}>
                            {slot.assigned}
                            <span className="font-normal text-gray-400">/{slot.required}</span>
                          </div>

                          {/* Coverage bar */}
                          <div className="mt-1 h-0.5 rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${STATUS_BAR[slot.status]}`}
                              style={{ width: `${Math.min(100, pct * 100)}%` }}
                            />
                          </div>
                        </button>
                      </td>
                    )
                  })}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center gap-4">
          {([
            ['critical', 'Kritiek (< 70%)'],
            ['warning', 'Waarschuwing (70-90%)'],
            ['good', 'Gedekt (≥ 90%)'],
            ['over', 'Overstaffed'],
          ] as const).map(([status, label]) => (
            <div key={status} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-sm ${STATUS_BAR[status]}`} />
              <span className="text-[10px] text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
