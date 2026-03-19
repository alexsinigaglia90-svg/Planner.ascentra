'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ShiftTemplate, ShiftRequirement } from '@prisma/client'
import type { AssignmentWithRelations } from '@/lib/queries/assignments'
import type { EmployeeWithContext } from '@/lib/queries/employees'
import type { ProcessRow, EmployeeProcessScoreRow } from '@/lib/queries/processes'
import type { ManpowerTarget } from '@/lib/manpower'
import type { TeamWithSlots } from '@/lib/queries/teams'
import {
  computeDepartmentDayStats,
  computeDepartmentSummaries,
} from '@/lib/demand'
import { BirdsEyeView } from './BirdsEyeView'
import { DepartmentFocusView } from './DepartmentFocusView'
import { ShiftDetailPanel } from './ShiftDetailPanel'
import { WeekRosterView } from './WeekRosterView'
import { AutoplanWizard, type AutoplanScope } from './AutoplanWizard'
import { DagplanView } from './DagplanView'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ZoomLevel = 'birds-eye' | 'week-roster' | 'department' | 'shift-detail' | 'slot-detail' | 'dagplan'

export interface ZoomState {
  level: ZoomLevel
  departmentId?: string
  date?: string
  shiftTemplateId?: string
}

interface DeptInfo {
  id: string
  name: string
  color?: string | null
}

interface Props {
  assignments: AssignmentWithRelations[]
  employees: EmployeeWithContext[]
  templates: ShiftTemplate[]
  requirements: ShiftRequirement[]
  departments: DeptInfo[]
  processes: ProcessRow[]
  processScores: EmployeeProcessScoreRow[]
  canEdit: boolean
  /** Volume-driven demand targets from forecast engine (highest priority) */
  demandTargetsMap?: Map<string, ManpowerTarget>
  /** Teams with rotation slots — used by WeekRosterView for ploeg context */
  teams?: TeamWithSlots[]
  /** teamId → headcount — used by WeekRosterView */
  employeeTeamCounts?: Map<string, number>
}

// ─── Date helpers ────────────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.getFullYear(), d.getMonth(), diff)
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

function generateDates(startDate: string, weeks: number): string[] {
  const dates: string[] = []
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(startDate, i)
    // Skip weekends for display (keep data for all days)
    const dayOfWeek = new Date(d + 'T00:00:00').getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      dates.push(d)
    }
  }
  return dates
}

const WEEKDAY_SHORT: Record<number, string> = {
  1: 'Ma', 2: 'Di', 3: 'Wo', 4: 'Do', 5: 'Vr',
}

const MONTH_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

export function formatDateLabel(dateStr: string): { day: string; date: string; month: string } {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay() === 0 ? 7 : d.getDay()
  return {
    day: WEEKDAY_SHORT[dow] ?? '',
    date: String(d.getDate()),
    month: MONTH_SHORT[d.getMonth()],
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Planner2View({
  assignments,
  employees,
  templates,
  requirements,
  demandTargetsMap,
  departments,
  processes,
  processScores,
  canEdit,
  teams = [],
  employeeTeamCounts = new Map(),
}: Props) {
  // Zoom state — default to week-roster (shift × day, demand-driven primary view)
  const [zoom, setZoom] = useState<ZoomState>({ level: 'week-roster' })

  // Wizard state
  const [wizardScope, setWizardScope] = useState<AutoplanScope | null>(null)

  // Date navigation — 6 weeks from current Monday
  const [weekOffset, setWeekOffset] = useState(0)
  const today = new Date()
  const baseMonday = getMonday(today)
  const startDate = formatDate(
    new Date(baseMonday.getFullYear(), baseMonday.getMonth(), baseMonday.getDate() + weekOffset * 7),
  )
  const weeks = 6
  const dates = useMemo(() => generateDates(startDate, weeks), [startDate, weeks])

  // Build requirements map
  const requirementsMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of requirements) {
      map.set(r.shiftTemplateId, r.requiredHeadcount)
    }
    return map
  }, [requirements])

  // Build process level lookup: `${employeeId}:${processId}` → level
  const processLevelMap = useMemo(
    () => new Map(processScores.map((s) => [`${s.employeeId}:${s.processId}`, s.level])),
    [processScores],
  )

  // Compute department × day stats
  const deptDayStats = useMemo(
    () =>
      computeDepartmentDayStats({
        dates,
        departments,
        templates,
        assignments,
        employees,
        requirementsMap,
        demandTargetsMap,
      }),
    [dates, departments, templates, assignments, employees, requirementsMap, demandTargetsMap],
  )

  // Department summaries
  const deptSummaries = useMemo(
    () => computeDepartmentSummaries(deptDayStats, departments),
    [deptDayStats, departments],
  )

  // ── Navigation ─────────────────────────────────────────────────────────────

  const zoomToDepartment = useCallback((departmentId: string) => {
    setZoom({ level: 'department', departmentId })
  }, [])

  const zoomToShiftDetail = useCallback((departmentId: string, date: string, shiftTemplateId: string) => {
    setZoom({ level: 'shift-detail', departmentId, date, shiftTemplateId })
  }, [])

  // From WeekRosterView: slot detail without dept context (shift-centric)
  const zoomToSlot = useCallback((date: string, shiftTemplateId: string) => {
    setZoom({ level: 'slot-detail', date, shiftTemplateId })
  }, [])

  const zoomToDagplan = useCallback((date: string) => {
    setZoom({ level: 'dagplan', date })
  }, [])

  const zoomOut = useCallback(() => {
    if (zoom.level === 'slot-detail') {
      setZoom({ level: 'week-roster' })
    } else if (zoom.level === 'shift-detail') {
      if (zoom.departmentId) {
        setZoom({ level: 'department', departmentId: zoom.departmentId })
      } else {
        setZoom({ level: 'week-roster' })
      }
    } else if (zoom.level === 'department') {
      setZoom({ level: 'week-roster' })
    } else if (zoom.level === 'dagplan') {
      setZoom({ level: 'week-roster' })
    } else {
      setZoom({ level: 'week-roster' })
    }
  }, [zoom])

  const goToToday = useCallback(() => setWeekOffset(0), [])
  const goPrev = useCallback(() => setWeekOffset((w) => w - 1), [])
  const goNext = useCallback(() => setWeekOffset((w) => w + 1), [])

  const openWizard = useCallback(() => {
    const deptIds = zoom.departmentId ? [zoom.departmentId] : departments.map((d) => d.id)
    // Include __unassigned__ for shifts without a department
    if (!zoom.departmentId && templates.some((t) => !t.departmentId)) deptIds.push('__unassigned__')
    const scope: AutoplanScope = {
      departmentIds: deptIds,
      shiftTemplateIds: zoom.shiftTemplateId ? [zoom.shiftTemplateId] :
        zoom.departmentId ? templates.filter((t) => t.departmentId === zoom.departmentId).map((t) => t.id) :
        templates.map((t) => t.id),
      fromZoomLevel: zoom.level === 'dagplan' ? 'week-roster'
        : zoom.level === 'birds-eye' ? 'birds-eye'
        : zoom.level,
    }
    setWizardScope(scope)
  }, [zoom, departments, templates])

  // ── Current context ────────────────────────────────────────────────────────

  const currentDept = departments.find((d) => d.id === zoom.departmentId)
  const currentDeptTemplates = useMemo(
    () => templates.filter((t) => t.departmentId === zoom.departmentId),
    [templates, zoom.departmentId],
  )
  const currentDeptEmployees = useMemo(
    () => employees.filter((e) => e.department?.id === zoom.departmentId && e.status === 'active'),
    [employees, zoom.departmentId],
  )
  const currentDeptStats = useMemo(
    () => deptDayStats.filter((s) => s.departmentId === zoom.departmentId),
    [deptDayStats, zoom.departmentId],
  )

  // ── Breadcrumb ─────────────────────────────────────────────────────────────

  const startLabel = (() => {
    const d = new Date(startDate + 'T00:00:00')
    return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`
  })()
  const endDate = addDays(startDate, weeks * 7 - 3) // Friday of last week
  const endLabel = (() => {
    const d = new Date(endDate + 'T00:00:00')
    return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
  })()

  return (
    <div className="space-y-4">
      {/* ── Top bar: breadcrumb + date navigation ─────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setZoom({ level: 'birds-eye' })}
            className={`font-semibold transition-colors ${
              zoom.level === 'birds-eye' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Overzicht
          </button>
          {zoom.level !== 'birds-eye' && currentDept && (
            <>
              <span className="text-gray-300">/</span>
              <button
                type="button"
                onClick={() => setZoom({ level: 'department', departmentId: zoom.departmentId })}
                className={`font-semibold transition-colors ${
                  zoom.level === 'department' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {currentDept.name}
              </button>
            </>
          )}
          {zoom.level === 'shift-detail' && zoom.date && (
            <>
              <span className="text-gray-300">/</span>
              <span className="font-semibold text-gray-900">
                {formatDateLabel(zoom.date).day} {formatDateLabel(zoom.date).date} {formatDateLabel(zoom.date).month}
                {zoom.shiftTemplateId && (() => {
                  const tpl = templates.find((t) => t.id === zoom.shiftTemplateId)
                  return tpl ? ` — ${tpl.name}` : ''
                })()}
              </span>
            </>
          )}
        </div>

        {/* Date navigation + Autoplan */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => zoomToDagplan(new Date().toISOString().slice(0, 10))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Dagplan
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={openWizard}
              className="rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 transition-colors flex items-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              Autoplan
            </button>
          )}
          <button
            type="button"
            onClick={goToToday}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Vandaag
          </button>
          <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
            <button type="button" onClick={goPrev} className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-50 transition-colors">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <span className="px-3 py-1.5 text-xs font-medium text-gray-700 border-x border-gray-200 tabular-nums whitespace-nowrap">
              {startLabel} — {endLabel}
            </span>
            <button type="button" onClick={goNext} className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-50 transition-colors">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Zoom content ──────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {/* Primary view: shift × day roster with ploeg context */}
        {zoom.level === 'week-roster' && (
          <motion.div
            key="week-roster"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <WeekRosterView
              dates={dates}
              templates={templates}
              deptDayStats={deptDayStats}
              demandTargetsMap={demandTargetsMap}
              teams={teams}
              employeeTeamCounts={employeeTeamCounts}
              onSelectSlot={zoomToSlot}
            />
          </motion.div>
        )}

        {/* Legacy: department-centric bird's eye (kept for backwards nav) */}
        {zoom.level === 'birds-eye' && (
          <motion.div
            key="birds-eye"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <BirdsEyeView
              dates={dates}
              departments={departments}
              deptDayStats={deptDayStats}
              deptSummaries={deptSummaries}
              onSelectDepartment={zoomToDepartment}
              onSelectCell={(deptId) => zoomToDepartment(deptId)}
            />
          </motion.div>
        )}

        {zoom.level === 'department' && zoom.departmentId && (
          <motion.div
            key={`dept-${zoom.departmentId}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <DepartmentFocusView
              department={currentDept!}
              dates={dates}
              templates={currentDeptTemplates}
              stats={currentDeptStats}
              employees={currentDeptEmployees}
              processes={processes}
              processLevelMap={processLevelMap}
              onSelectShift={zoomToShiftDetail}
              onBack={zoomOut}
              canEdit={canEdit}
            />
          </motion.div>
        )}

        {zoom.level === 'shift-detail' && zoom.departmentId && zoom.date && zoom.shiftTemplateId && (
          <motion.div
            key={`detail-${zoom.departmentId}-${zoom.date}-${zoom.shiftTemplateId}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <ShiftDetailPanel
              department={currentDept!}
              date={zoom.date}
              shiftTemplate={templates.find((t) => t.id === zoom.shiftTemplateId)!}
              assignments={assignments}
              employees={employees}
              processes={processes}
              processLevelMap={processLevelMap}
              requirementsMap={requirementsMap}
              demandTargetsMap={demandTargetsMap}
              onBack={zoomOut}
              canEdit={canEdit}
            />
          </motion.div>
        )}

        {/* Slot detail from WeekRosterView — no department context, ploeg-aware */}
        {zoom.level === 'slot-detail' && zoom.date && zoom.shiftTemplateId && (
          <motion.div
            key={`slot-${zoom.date}-${zoom.shiftTemplateId}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <ShiftDetailPanel
              date={zoom.date}
              shiftTemplate={templates.find((t) => t.id === zoom.shiftTemplateId)!}
              assignments={assignments}
              employees={employees}
              processes={processes}
              processLevelMap={processLevelMap}
              requirementsMap={requirementsMap}
              demandTargetsMap={demandTargetsMap}
              teams={teams}
              onBack={zoomOut}
              canEdit={canEdit}
            />
          </motion.div>
        )}

        {zoom.level === 'dagplan' && zoom.date && (
          <motion.div
            key={`dagplan-${zoom.date}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <DagplanView
              date={zoom.date}
              shifts={templates}
              assignments={assignments}
              employees={employees}
              processes={processes}
              processLevelMap={processLevelMap}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Autoplan Wizard ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {wizardScope && (
          <AutoplanWizard
            departments={departments}
            templates={templates}
            employees={employees}
            processes={processes}
            processLevelMap={processLevelMap}
            deptDayStats={deptDayStats}
            dates={dates}
            scope={wizardScope}
            onClose={() => setWizardScope(null)}
            onComplete={() => setWizardScope(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
