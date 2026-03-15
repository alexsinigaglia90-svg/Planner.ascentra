'use client'

import { useMemo, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AssignmentWithRelations } from '@/lib/queries/assignments'
import type { ShiftRequirement } from '@/lib/queries/shiftRequirements'
import type { Location, Department } from '@/lib/queries/locations'
import {
  computeOpsSnapshot,
  type OpsSnapshot,
  type OpsDaySummary,
  type OpsShiftSlot,
  type OpsIssue,
} from '@/lib/ops'
import { syncEscalationNotificationsAction } from '@/app/planning/actions'
import { Tooltip } from '@/components/ui'
import { BorderBeam } from '@/components/ui/border-beam'
import { OPS_KPI_TOOLTIPS } from '@/components/planning/opsKpiTooltips'

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function pct(n: number): string { return `${Math.round(n * 100)}%` }

// ── Sub-components ──────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const color = status === 'critical' ? 'bg-red-500' : status === 'understaffed' ? 'bg-amber-400' : status === 'overstaffed' ? 'bg-blue-400' : 'bg-emerald-500'
  return <span className={`inline-block w-2 h-2 rounded-full ${color} ${status === 'critical' ? 'animate-pulse' : ''}`} />
}

function KpiCard({ label, value, sub, variant, tooltip }: {
  label: string; value: string | number; sub?: string
  variant?: 'neutral' | 'bad' | 'warn' | 'good' | 'info'
  tooltip?: string
}) {
  const accents = {
    neutral: { accent: 'border-l-gray-300', text: 'text-gray-900' },
    bad:     { accent: 'border-l-red-500', text: 'text-red-600' },
    warn:    { accent: 'border-l-amber-500', text: 'text-amber-600' },
    good:    { accent: 'border-l-emerald-500', text: 'text-emerald-600' },
    info:    { accent: 'border-l-blue-500', text: 'text-blue-600' },
  }
  const a = accents[variant ?? 'neutral']
  const content = (
    <div className={`rounded-xl border border-gray-100 border-l-[3px] ${a.accent} bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow`}>
      <div className={`text-2xl font-bold tabular-nums ${a.text}`}>{value}</div>
      <div className="text-[11px] font-medium text-gray-400 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-300 mt-0.5">{sub}</div>}
    </div>
  )
  return tooltip ? <Tooltip text={tooltip}>{content}</Tooltip> : content
}

function FillBar({ rate, status }: { rate: number; status: OpsShiftSlot['status'] }) {
  const bg = status === 'critical' ? 'bg-red-500' : status === 'understaffed' ? 'bg-amber-400' : status === 'overstaffed' ? 'bg-blue-400' : 'bg-emerald-500'
  return (
    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
      <div className={`h-full rounded-full ${bg} transition-all duration-500`} style={{ width: `${Math.min(rate, 1) * 100}%` }} />
    </div>
  )
}

function ShiftSlotRow({ slot }: { slot: OpsShiftSlot }) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50/60 transition-colors group">
      <StatusDot status={slot.status} />
      <span className="text-[11px] text-gray-400 tabular-nums w-20 shrink-0">{slot.template.startTime}–{slot.template.endTime}</span>
      <span className="text-sm font-medium text-gray-700 truncate flex-1">{slot.template.name}</span>
      <div className="w-24 shrink-0"><FillBar rate={slot.fillRate} status={slot.status} /></div>
      <span className={`text-xs font-bold tabular-nums shrink-0 ${slot.status === 'critical' || slot.status === 'understaffed' ? 'text-red-500' : 'text-gray-500'}`}>
        {slot.directAssigned}/{slot.required}
      </span>
      {slot.skillMismatch && (
        <span className="text-[9px] font-bold bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full uppercase">Skill</span>
      )}
      {slot.tempFraction > 0.5 && (
        <span className="text-[9px] font-bold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full uppercase">Temp</span>
      )}
    </div>
  )
}

function DayCard({ day, prominent }: { day: OpsDaySummary; prominent: boolean }) {
  const hasCritical = day.criticalSlots > 0
  const hasWarning = day.understaffedSlots > 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={[
        'rounded-2xl border overflow-hidden transition-shadow',
        prominent ? 'shadow-[0_2px_12px_rgba(0,0,0,0.06)]' : 'shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
        hasCritical ? 'border-red-200 bg-red-50/30' : hasWarning ? 'border-amber-200 bg-amber-50/20' : 'border-gray-200 bg-white',
      ].join(' ')}
    >
      {/* Day header */}
      <div className={`px-4 py-3 border-b ${hasCritical ? 'border-red-100 bg-red-50/40' : hasWarning ? 'border-amber-100 bg-amber-50/30' : 'border-gray-100 bg-gray-50/40'}`}>
        <div className="flex items-center justify-between">
          <div>
            <span className={`text-sm font-bold ${day.isToday ? 'text-blue-600' : 'text-gray-900'}`}>{day.label}</span>
            <span className="text-xs text-gray-400 ml-2">{formatShortDate(day.date)}</span>
          </div>
          <div className="flex items-center gap-2">
            {day.criticalSlots > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700">
                <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />{day.criticalSlots} critical
              </span>
            )}
            <span className="text-xs font-bold tabular-nums text-gray-500">{day.totalAssigned}/{day.totalRequired}</span>
          </div>
        </div>
      </div>
      {/* Shift slots */}
      <div className="divide-y divide-gray-100/60">
        {day.slots.map((slot) => <ShiftSlotRow key={`${slot.date}-${slot.template.id}`} slot={slot} />)}
      </div>
    </motion.div>
  )
}

function EscalationCard({ issue }: { issue: OpsIssue }) {
  const isCritical = issue.severity === 'critical'
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${isCritical ? 'border-red-200 bg-red-50/40' : 'border-amber-200 bg-amber-50/30'}`}>
      <div className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 mt-0.5 ${isCritical ? 'bg-red-100' : 'bg-amber-100'}`}>
        {isCritical ? (
          <svg className="w-3.5 h-3.5 text-red-600" viewBox="0 0 14 14" fill="none"><path d="M7 1l6 11H1L7 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M7 5.5v2.5M7 10h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-amber-600" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3" /><path d="M7 4v3.5M7 10h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${isCritical ? 'text-red-800' : 'text-amber-800'}`}>{issue.title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{issue.detail}</p>
      </div>
      <span className="text-[10px] text-gray-400 shrink-0 mt-1">{formatShortDate(issue.date)}</span>
    </div>
  )
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-2 rounded-full bg-gray-100 overflow-hidden flex-1">
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${w}%` }} />
    </div>
  )
}

// ── Analytics Section ────────────────────────────────────────────────────────

function AnalyticsSection({ snap }: { snap: OpsSnapshot }) {
  // Per-template stats for the week
  const templateStats = useMemo(() => {
    const map = new Map<string, { name: string; totalRequired: number; totalAssigned: number; criticalDays: number; totalSlots: number }>()
    for (const day of snap.weekDays) {
      for (const slot of day.slots) {
        const existing = map.get(slot.template.id) ?? { name: slot.template.name, totalRequired: 0, totalAssigned: 0, criticalDays: 0, totalSlots: 0 }
        existing.totalRequired += slot.required
        existing.totalAssigned += slot.directAssigned
        existing.totalSlots++
        if (slot.status === 'critical') existing.criticalDays++
        map.set(slot.template.id, existing)
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.totalAssigned / Math.max(1, a.totalRequired)) - (b.totalAssigned / Math.max(1, b.totalRequired)))
  }, [snap.weekDays])

  // Daily demand pattern
  const dailyPattern = useMemo(() => {
    return snap.weekDays.map((day) => ({
      label: new Date(day.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' }),
      required: day.totalRequired,
      assigned: day.totalAssigned,
      open: day.totalOpen,
      coverage: day.totalRequired > 0 ? day.totalAssigned / day.totalRequired : 0,
    }))
  }, [snap.weekDays])

  const maxDemand = Math.max(1, ...dailyPattern.map((d) => d.required))

  // Workforce composition
  const totalInternal = Math.round(snap.week.internalRatio * (snap.week.totalAssigned || 1))
  const totalTemp = snap.week.totalAssigned - totalInternal

  return (
    <div className="space-y-6">
      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Analytics</h2>

      {/* Row 1: Coverage gauge + Staff mix + Efficiency */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Coverage gauge */}
        <div className="relative rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <BorderBeam size={120} duration={8} colorFrom="#4F6BFF" colorTo="#22C55E" borderWidth={1.5} />
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Weekly Coverage</p>
          <div className="flex items-center justify-center">
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#F3F4F6" strokeWidth="3" />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={snap.week.coverageRate >= 0.9 ? '#22C55E' : snap.week.coverageRate >= 0.7 ? '#F59E0B' : '#EF4444'}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${Math.round(snap.week.coverageRate * 100)}, 100`}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-gray-900 tabular-nums">{pct(snap.week.coverageRate)}</span>
                <span className="text-[10px] text-gray-400">coverage</span>
              </div>
            </div>
          </div>
        </div>

        {/* Staff mix */}
        <div className="relative rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <BorderBeam size={120} duration={10} colorFrom="#3B82F6" colorTo="#F97316" borderWidth={1.5} delay={3} />
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Staff Mix</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm text-gray-700">Internal</span>
              </div>
              <span className="text-sm font-bold tabular-nums text-gray-900">{totalInternal}</span>
            </div>
            <div className="h-3 rounded-full bg-gray-100 overflow-hidden flex">
              <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.round(snap.week.internalRatio * 100)}%` }} />
              <div className="h-full bg-orange-400 transition-all duration-500" style={{ width: `${Math.round(snap.week.tempRatio * 100)}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-400" />
                <span className="text-sm text-gray-700">Temp</span>
              </div>
              <span className="text-sm font-bold tabular-nums text-gray-900">{totalTemp}</span>
            </div>
            <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-100">
              {pct(snap.week.internalRatio)} internal / {pct(snap.week.tempRatio)} temp this week
            </p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="relative rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <BorderBeam size={120} duration={12} colorFrom="#8B5CF6" colorTo="#EC4899" borderWidth={1.5} delay={6} />
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Quick Stats</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Total shifts this week</span>
              <span className="text-sm font-bold tabular-nums">{snap.week.totalRequired}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Filled positions</span>
              <span className="text-sm font-bold tabular-nums text-emerald-600">{snap.week.totalAssigned}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Open positions</span>
              <span className="text-sm font-bold tabular-nums text-red-500">{snap.week.totalOpen}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Over-contract employees</span>
              <span className={`text-sm font-bold tabular-nums ${snap.week.overContractEmployees > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{snap.week.overContractEmployees}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Active escalations</span>
              <span className={`text-sm font-bold tabular-nums ${snap.escalations.length > 0 ? 'text-red-500' : 'text-gray-400'}`}>{snap.escalations.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Daily demand chart */}
      <div className="relative rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <BorderBeam size={250} duration={20} colorFrom="#4F6BFF" colorTo="#22C55E" borderWidth={1} delay={2} />
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Daily Demand vs Supply</p>
          <p className="text-[10px] text-gray-300">{snap.week.weekStart} - {snap.week.weekEnd}</p>
        </div>
        <div className="flex items-end gap-2 h-32">
          {dailyPattern.map((day, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex gap-0.5 items-end h-24">
                {/* Required bar */}
                <div className="flex-1 rounded-t-md bg-gray-200 transition-all duration-500" style={{ height: `${(day.required / maxDemand) * 100}%` }} />
                {/* Assigned bar */}
                <div
                  className={`flex-1 rounded-t-md transition-all duration-500 ${day.coverage >= 1 ? 'bg-emerald-400' : day.coverage >= 0.7 ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ height: `${(day.assigned / maxDemand) * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-400 font-medium">{day.label}</span>
              {day.open > 0 && <span className="text-[9px] font-bold text-red-400">-{day.open}</span>}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-gray-200" /><span className="text-[10px] text-gray-400">Required</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /><span className="text-[10px] text-gray-400">Assigned</span></div>
        </div>
      </div>

      {/* Row 3: Per-template efficiency */}
      {templateStats.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Shift Template Efficiency</p>
          <div className="space-y-2.5">
            {templateStats.map((t) => {
              const coverage = t.totalRequired > 0 ? t.totalAssigned / t.totalRequired : 0
              return (
                <div key={t.name} className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 w-36 truncate shrink-0">{t.name}</span>
                  <ProgressBar value={t.totalAssigned} max={t.totalRequired} color={coverage >= 0.9 ? 'bg-emerald-400' : coverage >= 0.6 ? 'bg-amber-400' : 'bg-red-400'} />
                  <span className={`text-xs font-bold tabular-nums w-10 text-right shrink-0 ${coverage >= 0.9 ? 'text-emerald-600' : coverage >= 0.6 ? 'text-amber-600' : 'text-red-500'}`}>
                    {pct(coverage)}
                  </span>
                  {t.criticalDays > 0 && (
                    <span className="text-[9px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full shrink-0">{t.criticalDays} crit</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Ops tab state ────────────────────────────────────────────────────────────

type OpsTab = 'overview' | 'analytics'

// ── Types ────────────────────────────────────────────────────────────────────

type OpsEmployee = Parameters<typeof computeOpsSnapshot>[0]['employees'][number]
type OpsShiftTemplate = Parameters<typeof computeOpsSnapshot>[0]['templates'][number]

interface Props {
  employees: OpsEmployee[]
  assignments: AssignmentWithRelations[]
  templates: OpsShiftTemplate[]
  requirements: ShiftRequirement[]
  locations: Location[]
  departments: Department[]
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function OperationsView({ employees, assignments, templates, requirements, locations, departments }: Props) {
  const [tab, setTab] = useState<OpsTab>('overview')

  const requirementsMap = useMemo(
    () => new Map(requirements.map((r) => [r.shiftTemplateId, r.requiredHeadcount])),
    [requirements],
  )

  const snap: OpsSnapshot = useMemo(
    () => computeOpsSnapshot({
      employees,
      templates,
      assignments: assignments.map((a) => ({
        employeeId: a.employeeId,
        shiftTemplateId: a.shiftTemplateId,
        rosterDay: { date: a.rosterDay.date },
      })),
      requirementsMap,
      locations,
      departments,
    }),
    [employees, templates, assignments, requirementsMap, locations, departments],
  )

  useEffect(() => { void syncEscalationNotificationsAction() }, [])

  const criticalCount = snap.escalations.filter((e) => e.severity === 'critical').length

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Operations</span>
            {criticalCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />{criticalCount} critical
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />All clear
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900">{formatDate(snap.asOf)}</h1>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-0.5 bg-gray-100 rounded-xl p-0.5">
          {(['overview', 'analytics'] as OpsTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                tab === t ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {t === 'overview' ? 'Overview' : 'Analytics'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Overview tab ───────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-6">

          {/* KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard label="Open positions" value={snap.week.totalOpen} sub="this week" variant={snap.week.totalOpen > 0 ? 'bad' : 'good'} tooltip={OPS_KPI_TOOLTIPS['Open positions']} />
            <KpiCard label="Critical slots" value={snap.week.criticalInstances} sub="this week" variant={snap.week.criticalInstances > 0 ? 'bad' : 'good'} tooltip={OPS_KPI_TOOLTIPS['Critical slots']} />
            <KpiCard label="Understaffed" value={snap.week.understaffedInstances} sub="shift-days" variant={snap.week.understaffedInstances > 0 ? 'warn' : 'good'} tooltip={OPS_KPI_TOOLTIPS['Understaffed']} />
            <KpiCard label="Coverage" value={pct(snap.week.coverageRate)} sub="of required" variant={snap.week.coverageRate < 0.8 ? 'bad' : snap.week.coverageRate < 1 ? 'warn' : 'good'} tooltip={OPS_KPI_TOOLTIPS['Coverage']} />
            <KpiCard label="Temp ratio" value={pct(snap.week.tempRatio)} sub="this week" variant={snap.week.tempRatio > 0.3 ? 'warn' : 'neutral'} tooltip={OPS_KPI_TOOLTIPS['Temp ratio']} />
            <KpiCard label="Over-contract" value={snap.week.overContractEmployees} sub="employees" variant={snap.week.overContractEmployees > 0 ? 'warn' : 'good'} tooltip={OPS_KPI_TOOLTIPS['Over-contract']} />
          </div>

          {/* Focus Days + Escalations */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Focus days */}
            <div className="lg:col-span-2 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Focus Days</h2>
              {templates.length === 0 ? (
                <p className="text-sm text-gray-400 py-4">No shift templates defined.</p>
              ) : (
                <div className="space-y-3">
                  {snap.today && <DayCard day={snap.today} prominent />}
                  {snap.tomorrow && <DayCard day={snap.tomorrow} prominent={false} />}
                  {snap.dayAfterTomorrow && <DayCard day={snap.dayAfterTomorrow} prominent={false} />}
                </div>
              )}
            </div>

            {/* Escalations */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Escalations</h2>
                {snap.escalations.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold">{snap.escalations.length}</span>
                )}
              </div>
              {snap.escalations.length === 0 ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/40 px-4 py-4">
                  <svg className="w-5 h-5 text-emerald-500" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" fill="#22C55E" opacity="0.15" /><path d="M6 10.5l2.5 2.5L14 8" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span className="text-sm font-medium text-emerald-700">No active escalations</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {snap.escalations.slice(0, 6).map((issue, i) => <EscalationCard key={i} issue={issue} />)}
                  {snap.escalations.length > 6 && (
                    <p className="text-[11px] text-gray-400 text-center py-1">+{snap.escalations.length - 6} more</p>
                  )}
                </div>
              )}

              {/* Over-contract detail */}
              {snap.overContractEmployees.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4 mt-3">
                  <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-2">Over-contract</p>
                  <div className="space-y-1.5">
                    {snap.overContractEmployees.map((emp) => (
                      <div key={emp.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 truncate">{emp.name}</span>
                        <span className="text-amber-700 font-bold tabular-nums shrink-0">{emp.plannedHours}h / {emp.contractHours}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Week at a Glance */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Week at a Glance</h2>
              <span className="text-[10px] text-gray-300">{snap.week.weekStart} – {snap.week.weekEnd}</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {snap.weekDays.map((day) => {
                const isWeekend = [0, 6].includes(new Date(day.date + 'T00:00:00').getDay())
                return (
                  <div
                    key={day.date}
                    className={[
                      'rounded-xl border p-3 text-center transition-colors',
                      day.criticalSlots > 0 ? 'border-red-200 bg-red-50/50' :
                      day.understaffedSlots > 0 ? 'border-amber-200 bg-amber-50/40' :
                      day.allStaffed ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 bg-gray-50/40',
                      isWeekend ? 'opacity-60' : '',
                    ].join(' ')}
                  >
                    <p className="text-[10px] font-bold uppercase text-gray-400 mb-1">
                      {new Date(day.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' })}
                    </p>
                    <StatusDot status={day.criticalSlots > 0 ? 'critical' : day.understaffedSlots > 0 ? 'understaffed' : day.allStaffed ? 'staffed' : 'understaffed'} />
                    {day.totalOpen > 0 ? (
                      <p className="text-xs font-bold text-red-500 mt-1 tabular-nums">-{day.totalOpen}</p>
                    ) : (
                      <p className="text-xs font-bold text-emerald-500 mt-1">{'\u2713'}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* By Location + Department */}
          {(snap.siteBreakdown.length > 0 || snap.deptBreakdown.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {snap.siteBreakdown.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">By Location <span className="text-gray-300 normal-case">today + tomorrow</span></p>
                  <div className="space-y-2.5">
                    {snap.siteBreakdown.map((row) => (
                      <div key={row.locationId} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 w-28 truncate shrink-0">{row.locationName}</span>
                        <ProgressBar value={row.assignedCount} max={row.requiredCount} color={row.status === 'ok' ? 'bg-emerald-400' : row.status === 'warn' ? 'bg-amber-400' : 'bg-red-400'} />
                        <span className="text-xs font-bold tabular-nums text-gray-500 shrink-0">{row.assignedCount}/{row.requiredCount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {snap.deptBreakdown.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">By Department <span className="text-gray-300 normal-case">today + tomorrow</span></p>
                  <div className="space-y-2.5">
                    {snap.deptBreakdown.map((row) => (
                      <div key={row.departmentId} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 w-28 truncate shrink-0">{row.departmentName}</span>
                        <ProgressBar value={row.assignedCount} max={row.requiredCount} color={row.status === 'ok' ? 'bg-emerald-400' : row.status === 'warn' ? 'bg-amber-400' : 'bg-red-400'} />
                        <span className="text-xs font-bold tabular-nums text-gray-500 shrink-0">{row.assignedCount}/{row.requiredCount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* High Temp Dependency */}
          {snap.highTempShifts.length > 0 && (
            <div className="rounded-2xl border border-orange-200 bg-orange-50/30 p-5">
              <p className="text-[11px] font-bold text-orange-700 uppercase tracking-wider mb-2">High Temp Dependency — Today</p>
              <div className="space-y-1.5">
                {snap.highTempShifts.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700">{s.templateName}</span>
                    <span className="text-orange-600 font-bold tabular-nums">{Math.round(s.tempFraction * 100)}% temp</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Analytics tab ──────────────────────────────────────────────── */}
      {tab === 'analytics' && (
        <AnimatePresence mode="wait">
          <motion.div
            key="analytics"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <AnalyticsSection snap={snap} />
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}
