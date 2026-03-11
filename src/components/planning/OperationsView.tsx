'use client'

import { useMemo, useEffect } from 'react'
import type { Employee } from '@/lib/queries/employees'
import type { AssignmentWithRelations } from '@/lib/queries/assignments'
import type { ShiftTemplate } from '@/lib/queries/shiftTemplates'
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

type NamedItem = { id: string; name: string }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatCoverage(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

// ---------------------------------------------------------------------------
// Severity badge
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: OpsIssue['severity'] }) {
  if (severity === 'critical') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 uppercase tracking-wide shrink-0">
        <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
        Critical
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 uppercase tracking-wide shrink-0">
      Warn
    </span>
  )
}

// ---------------------------------------------------------------------------
// Fill-rate bar
// ---------------------------------------------------------------------------

function FillBar({ rate, status }: { rate: number; status: OpsShiftSlot['status'] }) {
  const bg =
    status === 'critical' ? 'bg-red-500' :
    status === 'understaffed' ? 'bg-amber-400' :
    status === 'overstaffed' ? 'bg-blue-400' : 'bg-green-500'
  return (
    <div className="h-1 w-16 rounded-full bg-gray-100 overflow-hidden shrink-0">
      <div
        className={`h-full rounded-full transition-all ${bg}`}
        style={{ width: `${Math.min(rate * 100, 100)}%` }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shift slot row inside a day card
// ---------------------------------------------------------------------------

function SlotRow({ slot }: { slot: OpsShiftSlot }) {
  const statusColor =
    slot.status === 'critical' ? 'text-red-600' :
    slot.status === 'understaffed' ? 'text-amber-600' :
    slot.status === 'overstaffed' ? 'text-blue-600' : 'text-green-600'

  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
      {/* Time range */}
      <span className="text-xs text-gray-400 font-mono w-24 shrink-0">
        {slot.template.startTime}–{slot.template.endTime}
      </span>

      {/* Template name */}
      <span className="text-xs font-medium text-gray-800 flex-1 truncate">
        {slot.template.name}
      </span>

      {/* Fill bar */}
      <FillBar rate={slot.fillRate} status={slot.status} />

      {/* Count */}
      <span className={`text-xs font-semibold tabular-nums ${statusColor} w-12 text-right shrink-0`}>
        {slot.assigned}/{slot.required}
      </span>

      {/* Indicators */}
      <div className="flex items-center gap-1 w-16 justify-end shrink-0">
        {slot.skillMismatch && (
          <span title={`Skill required: ${slot.requiredSkillName ?? 'unknown'}`} className="text-[10px] rounded bg-purple-50 border border-purple-100 px-1 text-purple-600 font-medium">
            SKILL
          </span>
        )}
        {slot.tempFraction > 0.5 && slot.assigned > 0 && (
          <span title={`${Math.round(slot.tempFraction * 100)}% temp`} className="text-[10px] rounded bg-orange-50 border border-orange-100 px-1 text-orange-600 font-medium">
            TEMP
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Day status pip
// ---------------------------------------------------------------------------

function DayStatusPip({ day }: { day: OpsDaySummary }) {
  const color =
    day.criticalSlots > 0 ? 'bg-red-500' :
    day.understaffedSlots > 0 ? 'bg-amber-400' :
    day.overstaffedSlots > 0 ? 'bg-blue-400' : 'bg-green-400'
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${color}`} />
}

// ---------------------------------------------------------------------------
// Day card (focus view — today + tomorrow)
// ---------------------------------------------------------------------------

function DayCard({ day, prominent }: { day: OpsDaySummary; prominent: boolean }) {
  const borderColor =
    day.criticalSlots > 0 ? 'border-red-200 bg-red-50/30' :
    day.understaffedSlots > 0 ? 'border-amber-200 bg-amber-50/20' :
    'border-gray-200 bg-white'

  const labelColor =
    day.isToday ? 'text-gray-900' : 'text-gray-500'

  return (
    <div className={`rounded-xl border ${borderColor} ${prominent ? '' : 'opacity-90'}`}>
      {/* Day header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${labelColor}`}>{day.label}</span>
          <span className="text-xs text-gray-400">{formatDate(day.date)}</span>
        </div>
        <div className="flex items-center gap-2">
          {day.allStaffed ? (
            <span className="text-xs rounded-full border border-green-100 bg-green-50 px-2 py-0.5 text-green-700 font-medium">
              All staffed
            </span>
          ) : (
            <>
              {day.criticalSlots > 0 && (
                <span className="text-xs rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-red-700 font-medium">
                  {day.criticalSlots} critical
                </span>
              )}
              {day.understaffedSlots > 0 && (
                <span className="text-xs rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-amber-700 font-medium">
                  {day.understaffedSlots} short
                </span>
              )}
              {day.overstaffedSlots > 0 && (
                <span className="text-xs rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-blue-600 font-medium">
                  {day.overstaffedSlots} over
                </span>
              )}
            </>
          )}
          <span className="text-xs text-gray-400 tabular-nums">
            {day.totalAssigned}/{day.totalRequired}
          </span>
        </div>
      </div>

      {/* Slots */}
      {day.slots.length > 0 ? (
        <div className="px-4">
          {day.slots.map((slot) => (
            <SlotRow key={slot.template.id} slot={slot} />
          ))}
        </div>
      ) : (
        <div className="px-4 py-4">
          <p className="text-xs text-gray-400">No shift templates. Add shifts in the Shifts page.</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Week strip — compact 7-day overview
// ---------------------------------------------------------------------------

function WeekStrip({ days }: { days: OpsDaySummary[] }) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((day) => {
        const bg =
          day.criticalSlots > 0 ? 'bg-red-50 border-red-200' :
          day.understaffedSlots > 0 ? 'bg-amber-50 border-amber-200' :
          day.overstaffedSlots > 0 ? 'bg-blue-50 border-blue-100' :
          'bg-gray-50 border-gray-100'

        const isWeekend = (() => {
          const wd = new Date(day.date + 'T00:00:00').getDay()
          return wd === 0 || wd === 6
        })()

        return (
          <div
            key={day.date}
            className={`rounded-lg border p-2 text-center ${bg} ${isWeekend ? 'opacity-60' : ''}`}
          >
            <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">
              {day.label.slice(0, 3)}
            </div>
            <div className="flex justify-center mt-1">
              <DayStatusPip day={day} />
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5 tabular-nums">
              {day.totalOpen > 0 ? (
                <span className="text-red-600 font-medium">−{day.totalOpen}</span>
              ) : (
                <span className="text-green-600">✓</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Escalation list
// ---------------------------------------------------------------------------

function EscalationList({ issues }: { issues: OpsIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-green-100 bg-green-50 px-4 py-3">
        <span className="text-green-500 text-base">✓</span>
        <p className="text-sm font-medium text-green-800">No critical issues in the next 48 hours</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {issues.map((issue, i) => (
        <div
          key={i}
          className={[
            'flex items-start gap-3 px-4 py-3',
            i < issues.length - 1 ? 'border-b border-gray-50' : '',
            issue.severity === 'critical' ? 'bg-red-50/50' : '',
          ].join(' ')}
        >
          <SeverityBadge severity={issue.severity} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-900 leading-tight">{issue.title}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{issue.detail}</p>
          </div>
          <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">{issue.date === new Date().toISOString().slice(0, 10) ? 'Today' : formatDate(issue.date)}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stat tile
// ---------------------------------------------------------------------------

function StatTile({
  label,
  value,
  sub,
  variant = 'neutral',
}: {
  label: string
  value: string | number
  sub?: string
  variant?: 'neutral' | 'bad' | 'warn' | 'good' | 'info'
}) {
  const colors = {
    neutral: 'bg-gray-50 border-gray-200',
    bad:     'bg-red-50 border-red-100',
    warn:    'bg-amber-50 border-amber-100',
    good:    'bg-green-50 border-green-100',
    info:    'bg-sky-50 border-sky-100',
  }
  const valueColors = {
    neutral: 'text-gray-900',
    bad:     'text-red-700',
    warn:    'text-amber-700',
    good:    'text-green-700',
    info:    'text-sky-700',
  }

  return (
    <div className={`rounded-xl border px-4 py-3 ${colors[variant]}`}>
      <div className={`text-xl font-bold tabular-nums leading-none ${valueColors[variant]}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Site / Dept breakdown row
// ---------------------------------------------------------------------------

function SiteRow({ row }: { row: { name: string; assignedCount: number; requiredCount: number; open: number; status: 'ok' | 'warn' | 'critical' } }) {
  const fillRate = row.requiredCount > 0 ? row.assignedCount / row.requiredCount : 1
  const barColor =
    row.status === 'critical' ? 'bg-red-500' :
    row.status === 'warn' ? 'bg-amber-400' : 'bg-green-500'

  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs font-medium text-gray-700 flex-1 truncate">{row.name}</span>
      {row.requiredCount > 0 ? (
        <>
          <div className="h-1.5 w-20 rounded-full bg-gray-100 overflow-hidden shrink-0">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(fillRate * 100, 100)}%` }} />
          </div>
          <span className="text-xs text-gray-500 tabular-nums w-14 text-right shrink-0">
            {row.assignedCount}/{row.requiredCount}
          </span>
        </>
      ) : (
        <span className="text-xs text-gray-400 tabular-nums">{row.assignedCount} active</span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main OperationsView
// ---------------------------------------------------------------------------

type OpsEmployee = {
  id: string
  name: string
  employeeType: string
  contractHours: number
  status: string
  locationId: string | null
  departmentId: string | null
  skills?: { skillId: string; skill: { id: string; name: string } }[]
}

type OpsShiftTemplate = {
  id: string
  name: string
  startTime: string
  endTime: string
  requiredEmployees: number
  requiredSkillId: string | null
  requiredSkill?: { id: string; name: string } | null
  locationId: string | null
  departmentId: string | null
}

interface Props {
  employees: OpsEmployee[]
  assignments: AssignmentWithRelations[]
  templates: OpsShiftTemplate[]
  requirements: ShiftRequirement[]
  locations: Location[]
  departments: Department[]
}

export default function OperationsView({
  employees,
  assignments,
  templates,
  requirements,
  locations,
  departments,
}: Props) {
  const requirementsMap = useMemo(
    () => new Map(requirements.map((r) => [r.shiftTemplateId, r.requiredHeadcount])),
    [requirements],
  )

  const snap: OpsSnapshot = useMemo(
    () =>
      computeOpsSnapshot({
        employees: employees as Parameters<typeof computeOpsSnapshot>[0]['employees'],
        templates: templates as Parameters<typeof computeOpsSnapshot>[0]['templates'],
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

  const todayShiftlessMsg =
    templates.length === 0
      ? 'No shift templates defined. Add shifts in the Shifts page.'
      : null

  // Sync active escalations to the notification DB on every Operations view mount.
  // The action deduplicates with a 4-hour window so this is safe to call on every open.
  useEffect(() => {
    void syncEscalationNotificationsAction()
  }, [])

  return (
    <div className="space-y-6">

      {/* ── Header strip ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">Operations</p>
          <p className="text-sm text-gray-600 mt-0.5">
            {new Date(snap.asOf + 'T00:00:00').toLocaleDateString('en-GB', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* ── KPI strip ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
        <StatTile
          label="Open positions"
          value={snap.week.totalOpen}
          sub="this week"
          variant={snap.week.totalOpen > 0 ? 'bad' : 'good'}
        />
        <StatTile
          label="Critical slots"
          value={snap.week.criticalInstances}
          sub="this week"
          variant={snap.week.criticalInstances > 0 ? 'bad' : 'good'}
        />
        <StatTile
          label="Understaffed"
          value={snap.week.understaffedInstances}
          sub="shift-days"
          variant={snap.week.understaffedInstances > 0 ? 'warn' : 'good'}
        />
        <StatTile
          label="Coverage"
          value={formatCoverage(snap.week.coverageRate)}
          sub="of required"
          variant={snap.week.coverageRate < 0.8 ? 'bad' : snap.week.coverageRate < 1 ? 'warn' : 'good'}
        />
        <StatTile
          label="Temp ratio"
          value={`${Math.round(snap.week.tempRatio * 100)}%`}
          sub="of this week"
          variant={snap.week.tempRatio > 0.4 ? 'warn' : 'neutral'}
        />
        <StatTile
          label="Over-contract"
          value={snap.week.overContractEmployees}
          sub="employees"
          variant={snap.week.overContractEmployees > 0 ? 'warn' : 'good'}
        />
        {snap.week.overheadAssignments > 0 && (
          <StatTile
            label="Overhead"
            value={snap.week.overheadAssignments}
            sub="assigned this week"
            variant="neutral"
          />
        )}
      </div>

      {/* ── Main grid: focus days + escalations ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left — Today + tomorrow + day after */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Focus days</h2>

          {todayShiftlessMsg ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-8 text-center">
              <p className="text-sm text-gray-500">{todayShiftlessMsg}</p>
            </div>
          ) : (
            <>
              {snap.today && <DayCard day={snap.today} prominent={true} />}
              {snap.tomorrow && <DayCard day={snap.tomorrow} prominent={false} />}
              {snap.dayAfterTomorrow && (
                <DayCard day={snap.dayAfterTomorrow} prominent={false} />
              )}
            </>
          )}
        </div>

        {/* Right — Escalations */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
            Escalations
            {snap.escalations.length > 0 && (
              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-600 font-semibold">
                {snap.escalations.length}
              </span>
            )}
          </h2>
          <EscalationList issues={snap.escalations} />

          {/* Over-contract detail */}
          {snap.overContractEmployees.length > 0 && (
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
              <p className="text-xs font-semibold text-amber-800 mb-2">Over contract hours</p>
              <div className="space-y-1.5">
                {snap.overContractEmployees.map((e) => (
                  <div key={e.id} className="flex items-center justify-between">
                    <span className="text-xs text-gray-700">{e.name}</span>
                    <span className="text-xs text-amber-700 font-semibold tabular-nums">
                      {e.plannedHours} h <span className="text-gray-400 font-normal">/ {e.contractHours} h</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Week strip ────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Week at a glance</h2>
          <span className="text-xs text-gray-400">
            {formatDate(snap.week.weekStart)} – {formatDate(snap.week.weekEnd)}
          </span>
        </div>
        <WeekStrip days={snap.weekDays} />
      </div>

      {/* ── Site + Dept breakdowns (only when data exists) ─────────────── */}
      {(snap.siteBreakdown.length > 0 || snap.deptBreakdown.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {snap.siteBreakdown.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                By location <span className="text-gray-300 font-normal ml-1">today + tomorrow</span>
              </h2>
              {snap.siteBreakdown.map((row) => (
                <SiteRow
                  key={row.locationId}
                  row={{ name: row.locationName, assignedCount: row.assignedCount, requiredCount: row.requiredCount, open: row.open, status: row.status }}
                />
              ))}
            </div>
          )}

          {snap.deptBreakdown.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                By department <span className="text-gray-300 font-normal ml-1">today + tomorrow</span>
              </h2>
              {snap.deptBreakdown.map((row) => (
                <SiteRow
                  key={row.departmentId}
                  row={{ name: row.departmentName, assignedCount: row.assignedCount, requiredCount: row.requiredCount, open: row.open, status: row.status }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── High-temp shifts flag ──────────────────────────────────────── */}
      {snap.highTempShifts.length > 0 && (
        <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4">
          <p className="text-xs font-semibold text-orange-800 mb-2">High temp dependency — today</p>
          <div className="space-y-1.5">
            {snap.highTempShifts.map((s, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs text-gray-700">{s.templateName}</span>
                <span className="text-xs font-semibold text-orange-700 tabular-nums">
                  {Math.round(s.tempFraction * 100)}% temp
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
