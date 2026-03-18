'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import type { EmployeeForPlanning } from '@/lib/queries/employees'
import { isOverheadEmployee } from '@/lib/queries/employees'
import type { AssignmentWithRelations } from '@/lib/queries/assignments'
import type { ShiftTemplate } from '@/lib/queries/shiftTemplates'
import type { ShiftRequirement } from '@/lib/queries/shiftRequirements'
import type { AppRole } from '@/lib/auth/context'
import type { DepartmentWithChildren } from '@/lib/queries/locations'
import PlanningGrid from '@/components/planning/PlanningGrid'
import AssignmentForm from '@/components/planning/AssignmentForm'
import QuickAddPanel from '@/components/planning/QuickAddPanel'
import AssignmentDetailPanel from '@/components/planning/AssignmentDetailPanel'
import BulkActionsPanel from '@/components/planning/BulkActionsPanel'
import StaffingGapsPanel from '@/components/planning/StaffingGapsPanel'
import InsightsSummary from '@/components/planning/InsightsSummary'
import StaffingTrendTable from '@/components/planning/StaffingTrendTable'
import ForecastPanel from '@/components/planning/ForecastPanel'
import PlannerControlBar from '@/components/planning/PlannerControlBar'
import PlannerFiltersBar from '@/components/planning/PlannerFiltersBar'
import ShiftStaffingMatrix from '@/components/planning/ShiftStaffingMatrix'
import { analyzeStaffing, type StaffingStatus } from '@/lib/staffing'
import { computeMetrics } from '@/lib/analytics'
import { computeCompliance } from '@/lib/compliance'
import WeeklyCompliancePanel from '@/components/planning/WeeklyCompliancePanel'
import { computeWeekdayPatterns, generateForecast } from '@/lib/forecasting'
import {
  loadSettings, saveSettings, DEFAULT_SETTINGS,
  DEFAULT_FILTERS, activeFilterCount,
  type PlannerSettings, type PlannerFilters, type ViewMode,
} from '@/lib/plannerState'
import { moveAssignmentAction, copyAssignmentAction, deleteAllAssignmentsAction } from '@/app/planning/actions'
import OperationsView from '@/components/planning/OperationsView'
import { EmptyState, useToast, GuidanceHint } from '@/components/ui'
import { ExpandableTabs } from '@/components/ui/expandable-tabs'
import { CalendarRange, Users, TrendingUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import PlanWizard from '@/components/planning/PlanWizard'

// ── Date helpers (client-side, timezone-safe) ────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function currentMonday(): string {
  return getMondayOfWeek(todayStr())
}

function generateDates(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i))
}

// ── Types ────────────────────────────────────────────────────────────────────

type PanelState =
  | { type: 'none' }
  | { type: 'quickAdd'; employee: EmployeeForPlanning; date: string; availableTemplates: ShiftTemplate[] }
  | { type: 'detail'; assignment: AssignmentWithRelations }

type NamedItem = { id: string; name: string }

interface Props {
  employees: EmployeeForPlanning[]
  assignments: AssignmentWithRelations[]
  templates: ShiftTemplate[]
  requirements: ShiftRequirement[]
  locations: NamedItem[]
  departments: DepartmentWithChildren[]
  role: AppRole
  rotationViolationIds?: Set<string>
  employeeTeamMap?: Map<string, { name: string; color: string | null }>
  /** Processes for the Plan Wizard training mode */
  processes?: { id: string; name: string; departmentId: string | null; active: boolean }[]
  /** Demand-driven ManpowerTargets from volume forecasts (computed server-side) */
  demandTargetsMap?: Map<string, import('@/lib/manpower').ManpowerTarget>
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PlanningView({ employees, assignments, templates, requirements, locations, departments, role, rotationViolationIds, employeeTeamMap, processes = [], demandTargetsMap }: Props) {
  const readonly = role === 'viewer'
  // ── State ─────────────────────────────────────────────────────────────────
  // Initialize with DEFAULT_SETTINGS so the server snapshot always matches the
  // first client render. After mount, overwrite with stored user preferences.
  const [settings, setSettings] = useState<PlannerSettings>(DEFAULT_SETTINGS)
  const [settingsHydrated, setSettingsHydrated] = useState(false)
  const [filters, setFilters] = useState<PlannerFilters>(DEFAULT_FILTERS)
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [windowStart, setWindowStart] = useState<string>(currentMonday)
  const [panel, setPanel] = useState<PanelState>({ type: 'none' })
  const [plannerTab, setPlannerTab] = useState<'schedule' | 'staffing' | 'forecast'>('schedule')
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [planWizardOpen, setPlanWizardOpen] = useState(false)
  const [dragError, setDragError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Load persisted settings after mount (hydration-safe — avoids server/client mismatch
  // caused by localStorage being unavailable during server render).
  useEffect(() => {
    setSettings(loadSettings())
    setSettingsHydrated(true)
  }, [])

  // Persist settings whenever they change, but only after the stored settings
  // have been loaded — prevents overwriting localStorage with defaults on mount.
  useEffect(() => {
    if (settingsHydrated) saveSettings(settings)
  }, [settings, settingsHydrated])

  const panelOpen = panel.type !== 'none'
  const selectedAssignmentId = panel.type === 'detail' ? panel.assignment.id : null

  // ── Date range ────────────────────────────────────────────────────────────
  const windowDays = settings.weekSpan * 7

  const allDates = useMemo(
    () => generateDates(windowStart, windowDays),
    [windowStart, windowDays],
  )

  const dates = useMemo(
    () =>
      settings.showWeekends
        ? allDates
        : allDates.filter((d) => {
            const wd = new Date(d + 'T00:00:00').getDay()
            return wd !== 0 && wd !== 6
          }),
    [allDates, settings.showWeekends],
  )

  // ── Department hierarchy helpers ─────────────────────────────────────────

  // Flat list with '└ ' prefix for children — used only by the filter bar select.
  const departmentsFlat = useMemo(
    () =>
      departments.flatMap((d) => [
        { id: d.id, name: d.name },
        ...d.children.map((c) => ({ id: c.id, name: `\u00a0\u00a0\u2514 ${c.name}` })),
      ]),
    [departments],
  )

  // Clean name map (no prefix) — used for chip labels.
  const allDeptNames = useMemo(
    () =>
      new Map(
        departments.flatMap((d) => [[d.id, d.name], ...d.children.map((c) => [c.id, c.name] as [string, string])]),
      ),
    [departments],
  )

  // Parent-id → Set<child-id> — used to widen the dept filter to include subdepts.
  const childDeptIds = useMemo(
    () => new Map(departments.map((d) => [d.id, new Set(d.children.map((c) => c.id))])),
    [departments],
  )

  // Dept scope for autofill: null = no filter; otherwise [deptId, ...childIds] or [deptId].
  const activeDeptScope = useMemo((): string[] | null => {
    if (!filters.departmentId) return null
    const children = childDeptIds.get(filters.departmentId)
    return children && children.size > 0
      ? [filters.departmentId, ...Array.from(children)]
      : [filters.departmentId]
  }, [filters.departmentId, childDeptIds])

  // ── Staffing analysis (full, unfiltered — drives grid decorations) ────────
  const requirementsMap = useMemo(
    () => new Map(requirements.map((r) => [r.shiftTemplateId, r.requiredHeadcount])),
    [requirements],
  )

  const staffingEntries = useMemo(
    () =>
      templates.length > 0
        ? analyzeStaffing({ dates, assignments, templates, employees, requirementsMap, targetsMap: demandTargetsMap })
        : [],
    [dates, assignments, templates, employees, requirementsMap, demandTargetsMap],
  )

  const dateStatusMap = useMemo(() => {
    const map = new Map<string, StaffingStatus>()
    for (const entry of staffingEntries) {
      const current = map.get(entry.date)
      if (
        !current ||
        entry.status === 'understaffed' ||
        (entry.status === 'overstaffed' && current === 'staffed')
      ) {
        map.set(entry.date, entry.status)
      }
    }
    return map
  }, [staffingEntries])

  // Computed over the full date window using raw (unfiltered) assignments so that
  // contract hours are always accurate regardless of active grid filters.
  const complianceData = useMemo(
    () => computeCompliance({ dates: allDates, employees, assignments, templates }),
    [allDates, employees, assignments, templates],
  )

  const employeeNamesMap = useMemo(
    () => new Map(employees.map((e) => [e.id, e.name])),
    [employees],
  )

  const understaffedCount = useMemo(
    () => staffingEntries.filter((e) => e.status === 'understaffed').length,
    [staffingEntries],
  )
  const overstaffedCount = useMemo(
    () => staffingEntries.filter((e) => e.status === 'overstaffed').length,
    [staffingEntries],
  )

  // ── Filter application ────────────────────────────────────────────────────

  // Does the roster contain any overhead employees?
  const hasOverhead = useMemo(() => employees.some(isOverheadEmployee), [employees])

  // Step 1: type + individual employee filter
  const filteredEmployees = useMemo(
    () =>
      employees.filter((e) => {
        if (filters.employeeType !== 'all' && e.employeeType !== filters.employeeType) return false
        if (filters.employeeId !== null && e.id !== filters.employeeId) return false
        if (filters.locationId !== null && (e as { locationId?: string | null }).locationId !== filters.locationId) return false
        if (filters.departmentId !== null) {
          const empDept = (e as { departmentId?: string | null }).departmentId ?? null
          // Exact match covers both top-level and child dept selections.
          // Additionally, if the selected ID is a parent dept, include employees
          // assigned to any of its immediate child departments.
          const isDirectMatch = empDept === filters.departmentId
          const isChildMatch = childDeptIds.get(filters.departmentId)?.has(empDept ?? '') ?? false
          if (!isDirectMatch && !isChildMatch) return false
        }
        if (filters.workerClass === 'direct' && isOverheadEmployee(e)) return false
        if (filters.workerClass === 'overhead' && !isOverheadEmployee(e)) return false
        return true
      }),
    [employees, filters.employeeType, filters.employeeId, filters.locationId, filters.departmentId, filters.workerClass, childDeptIds],
  )

  // Step 2: understaffed-only filter — narrow to employees assigned on understaffed slots
  const effectiveEmployees = useMemo(() => {
    if (!filters.understaffedOnly) return filteredEmployees
    const understaffedKeys = new Set(
      staffingEntries
        .filter((e) => e.status === 'understaffed')
        .map((e) => `${e.date}:${e.template.id}`),
    )
    const onUnderstaffed = new Set(
      assignments
        .filter((a) => understaffedKeys.has(`${a.rosterDay.date}:${a.shiftTemplateId}`))
        .map((a) => a.employeeId),
    )
    const result = filteredEmployees.filter((e) => onUnderstaffed.has(e.id))
    // Fallback to full filtered set if no one is assigned to understaffed slots yet
    return result.length > 0 ? result : filteredEmployees
  }, [filteredEmployees, filters.understaffedOnly, staffingEntries, assignments])

  // Step 3: template filter on assignments (affects what's shown in cells)
  const effectiveAssignments = useMemo(
    () =>
      filters.templateId
        ? assignments.filter((a) => a.shiftTemplateId === filters.templateId)
        : assignments,
    [assignments, filters.templateId],
  )

  // ── Analytics (on effective data — reflects what's visible) ──────────────
  const metrics = useMemo(
    () =>
      computeMetrics({
        dates,
        assignments: effectiveAssignments,
        templates,
        employees: effectiveEmployees,
      }),
    [dates, effectiveAssignments, templates, effectiveEmployees],
  )

  // ── Forecasting v1: weekday-pattern baseline ──────────────────────────────
  const today = useMemo(() => todayStr(), [])

  // Build patterns from ALL historical assignments for maximum signal
  const weekdayPatterns = useMemo(
    () => computeWeekdayPatterns({ assignments, templates, employees, today }),
    [assignments, templates, employees, today],
  )

  const forecast = useMemo(() => {
    const futureDates = dates.filter((d) => d > today)
    return generateForecast({ futureDates, patterns: weekdayPatterns, templates })
  }, [dates, weekdayPatterns, templates, today])

  const forecastMaxSample = useMemo(
    () => Math.max(0, ...forecast.entries.map((e) => e.sampleSize)),
    [forecast.entries],
  )

  // ── Navigation ────────────────────────────────────────────────────────────
  function prevPeriod() { setWindowStart((s) => addDays(s, -windowDays)) }
  function nextPeriod() { setWindowStart((s) => addDays(s, windowDays)) }
  function goToday() { setWindowStart(currentMonday()) }
  function jumpToDate(isoDate: string) { setWindowStart(getMondayOfWeek(isoDate)) }

  // ── Event handlers ────────────────────────────────────────────────────────
  function handleCellClick(employee: EmployeeForPlanning, date: string) {
    if (readonly) return
    const assignedIds = new Set(
      assignments
        .filter((a) => a.employeeId === employee.id && a.rosterDay.date === date)
        .map((a) => a.shiftTemplateId),
    )
    const availableTemplates = templates.filter((t) => !assignedIds.has(t.id))
    setPanel({ type: 'quickAdd', employee, date, availableTemplates })
  }

  function handleAssignmentClick(assignment: AssignmentWithRelations) {
    setPanel({ type: 'detail', assignment })
  }

  const { success: toastSuccess, error: toastError } = useToast()

  function handleAssignmentMove(assignmentId: string, targetEmployeeId: string, targetDate: string) {
    if (readonly) return
    setDragError(null)
    startTransition(async () => {
      const result = await moveAssignmentAction(assignmentId, targetDate, targetEmployeeId)
      if (result.error) {
        setDragError(result.error)
        setTimeout(() => setDragError(null), 4000)
      } else {
        toastSuccess('Dienst verplaatst')
      }
    })
  }

  function handleAssignmentCopy(assignmentId: string, targetEmployeeId: string, targetDate: string) {
    if (readonly) return
    setDragError(null)
    startTransition(async () => {
      const result = await copyAssignmentAction(assignmentId, targetDate, targetEmployeeId)
      if (result.error) {
        setDragError(result.error)
        setTimeout(() => setDragError(null), 4000)
      } else {
        toastSuccess('Dienst gekopieerd')
      }
    })
  }

  function closePanel() { setPanel({ type: 'none' }) }

  const filterCount = activeFilterCount(filters)
  const viewMode: ViewMode = settings.viewMode ?? 'planner'

  function setViewMode(mode: ViewMode) {
    setSettings((s) => ({ ...s, viewMode: mode }))
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── View-mode toggle ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
        <div className="planner-seg">
          <button
            onClick={() => setViewMode('planner')}
            className={['planner-seg-btn', viewMode === 'planner' ? 'planner-seg-btn-active' : ''].join(' ')}
          >
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
              <rect x="7" y="1" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
              <rect x="1" y="7" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
              <rect x="7" y="7" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            Planner
          </button>
          <button
            onClick={() => setViewMode('operations')}
            className={['planner-seg-btn', viewMode === 'operations' ? 'planner-seg-btn-active' : ''].join(' ')}
          >
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.2" />
              <path d="M6 1v1.5M6 9.5V11M1 6h1.5M9.5 6H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Operations
          </button>
        </div>

        {/* Plan Wizard trigger */}
        {!readonly && (
          <button
            onClick={() => setPlanWizardOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#4F6BFF] to-[#6C83FF] text-white px-4 py-2 text-xs font-semibold shadow-[0_2px_8px_rgba(79,107,255,0.3)] hover:shadow-[0_4px_14px_rgba(79,107,255,0.4)] hover:-translate-y-0.5 transition-all duration-200"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 7h10M7 2v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Plan Wizard
          </button>
        )}
        </div>
      </div>

      {/* Plan Wizard modal */}
      <PlanWizard
        open={planWizardOpen}
        onClose={() => setPlanWizardOpen(false)}
        departments={departments}
        templates={templates.map((t) => ({ id: t.id, name: t.name, startTime: t.startTime, endTime: t.endTime, departmentId: t.departmentId ?? null }))}
        employees={employees.map((e) => ({
          id: e.id, name: e.name, employeeType: e.employeeType,
          departmentId: (e as { departmentId?: string | null }).departmentId ?? null,
          contractHours: e.contractHours,
          processScores: ((e as { processScores?: { processId: string; level: number }[] }).processScores) ?? [],
        }))}
        processes={processes}
      />

      {/* Guidance hint — planner overview */}
      {viewMode === 'planner' && (
        <GuidanceHint
          title="Planneroverzicht"
          description="Gebruik filters om de juiste medewerkers te tonen en genereer daarna een planning voor de geselecteerde periode."
          dismissLabel="Begrepen"
          storageKey="planner-guidance-v1"
        />
      )}

      {/* Operations view — early return */}
      {viewMode === 'operations' && (
        <div className="motion-reveal" key={viewMode}>
        <OperationsView
          employees={employees as Parameters<typeof OperationsView>[0]['employees']}
          assignments={assignments}
          templates={templates as Parameters<typeof OperationsView>[0]['templates']}
          requirements={requirements}
          locations={locations as Parameters<typeof OperationsView>[0]['locations']}
          departments={departments as Parameters<typeof OperationsView>[0]['departments']}
        />
        </div>
      )}

      {viewMode === 'planner' && (<>
      <div className={`planner-cockpit motion-reveal${settings.themeMode === 'light' ? ' planner-light' : ''}`} key={viewMode}>

      {/* Read-only viewer banner */}
      {readonly && (
        <div className="flex items-center gap-2.5 rounded-lg px-4 py-2.5 text-sm mb-1" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
          <svg className="w-4 h-4 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 5v.5M8 8v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>You have viewer access. Schedule data is read-only.</span>
        </div>
      )}

      {/* Drag error toast */}
      <div
        role="alert"
        aria-live="polite"
        className={[
          'overflow-hidden transition-all duration-300 ease-out',
          dragError ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0 pointer-events-none',
        ].join(' ')}
      >
        <div className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.25)', color: 'rgba(252,165,165,0.95)' }}>
          <svg className="w-4 h-4 shrink-0" style={{ color: 'rgba(252,165,165,0.7)' }} viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="flex-1 leading-snug">{dragError}</span>
          <button
            onClick={() => setDragError(null)}
            className="shrink-0 rounded p-0.5 transition-colors"
            style={{ color: 'rgba(252,165,165,0.5)' }}
            aria-label="Dismiss"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* DEV/TEST ONLY — Delete All button */}
      {!readonly && (
        <div className="flex justify-end">
          <button
            className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 active:bg-red-800"
            onClick={async () => {
              if (!confirm('⚠️ Delete ALL assignments for this org? This cannot be undone.')) return
              const res = await deleteAllAssignmentsAction()
              if (res.error) { toastError(res.error) }
              else { toastSuccess(`Deleted ${res.count ?? 0} assignments`) }
            }}
          >
            [DEV] Delete All Assignments
          </button>
        </div>
      )}

      {/* Control bar */}
      <PlannerControlBar
        windowStart={windowStart}
        settings={settings}
        settingsOpen={settingsOpen}
        filterCount={filterCount}
        filtersExpanded={filtersExpanded}
        onPrev={prevPeriod}
        onNext={nextPeriod}
        onToday={goToday}
        onJumpToDate={jumpToDate}
        onSettingsChange={setSettings}
        onToggleSettings={() => setSettingsOpen((v) => !v)}
        onToggleFilters={() => setFiltersExpanded((v) => !v)}
      />

      {/* Filter bar (slide-in) */}
      <div
        className={[
          'overflow-hidden transition-all duration-200',
          filtersExpanded ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0 pointer-events-none',
        ].join(' ')}
      >
        <div className="planner-filter-bar">
          <PlannerFiltersBar
            employees={employees}
            templates={templates}
            locations={locations}
            departments={departmentsFlat}
            filters={filters}
            onChange={setFilters}
            hasUnderstaffed={understaffedCount > 0}
            hasOverhead={hasOverhead}
          />
        </div>
      </div>

      {/* Active filter chips (when bar is collapsed) */}
      {filterCount > 0 && !filtersExpanded && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {filters.employeeType !== 'all' && (
            <span className="planner-chip">
              {filters.employeeType === 'internal' ? 'Internal only' : 'Temp only'}
              <button onClick={() => setFilters((f) => ({ ...f, employeeType: 'all' }))} aria-label="Remove filter" className="planner-chip-dismiss">
                <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
              </button>
            </span>
          )}
          {filters.employeeId && (
            <span className="planner-chip">
              {employees.find((e) => e.id === filters.employeeId)?.name ?? 'Employee'}
              <button onClick={() => setFilters((f) => ({ ...f, employeeId: null }))} aria-label="Remove filter" className="planner-chip-dismiss">
                <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
              </button>
            </span>
          )}
          {filters.templateId && (
            <span className="planner-chip">
              {templates.find((t) => t.id === filters.templateId)?.name ?? 'Shift'}
              <button onClick={() => setFilters((f) => ({ ...f, templateId: null }))} aria-label="Remove filter" className="planner-chip-dismiss">
                <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
              </button>
            </span>
          )}
          {filters.understaffedOnly && (
            <span className="planner-chip planner-chip-red">
              Understaffed only
              <button onClick={() => setFilters((f) => ({ ...f, understaffedOnly: false }))} aria-label="Remove filter" className="planner-chip-dismiss">
                <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
              </button>
            </span>
          )}
          {filters.locationId && (
            <span className="planner-chip planner-chip-sky">
              {locations.find((l) => l.id === filters.locationId)?.name ?? 'Location'}
              <button onClick={() => setFilters((f) => ({ ...f, locationId: null }))} aria-label="Remove filter" className="planner-chip-dismiss">
                <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
              </button>
            </span>
          )}
          {filters.departmentId && (
            <span className="planner-chip planner-chip-amber">
              {allDeptNames.get(filters.departmentId) ?? 'Department'}
              <button onClick={() => setFilters((f) => ({ ...f, departmentId: null }))} aria-label="Remove filter" className="planner-chip-dismiss">
                <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
              </button>
            </span>
          )}
          {filters.workerClass !== 'all' && (
            <span className="planner-chip planner-chip-violet">
              {filters.workerClass === 'direct' ? 'Direct labour' : 'Overhead only'}
              <button onClick={() => setFilters((f) => ({ ...f, workerClass: 'all' }))} aria-label="Remove filter" className="planner-chip-dismiss">
                <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
              </button>
            </span>
          )}
        </div>
      )}

      {/* Insights summary bar */}
      {settings.showInsightsSummary && employees.length > 0 && templates.length > 0 && (
        <InsightsSummary metrics={metrics} />
      )}

      {/* ── Grid + inline detail panel (split layout) ────────────── */}
      <div className="flex gap-0 items-stretch">
        {/* Grid — bounded height with internal scroll */}
        <div className="flex-1 min-w-0">
          {employees.length === 0 ? (
            <EmptyState
              surface="dark"
              icon="users"
              title="Geen medewerkers"
              description="Voeg minimaal één medewerker toe om te beginnen met plannen."
            />
          ) : templates.length === 0 ? (
            <EmptyState
              surface="dark"
              icon="shifts"
              title="Geen shift templates"
              description="Maak eerst een shift template voordat je medewerkers kunt inplannen."
            />
          ) : effectiveEmployees.length === 0 ? (
            <EmptyState
              surface="dark"
              icon="filter"
              title="Geen medewerkers gevonden"
              description="Geen medewerkers voldoen aan de actieve filters."
              secondaryAction={{ label: 'Filters wissen', onClick: () => setFilters(DEFAULT_FILTERS) }}
            />
          ) : (
            <div className="planner-grid-bounded">
              <PlanningGrid
                employees={effectiveEmployees}
                dates={dates}
                assignments={effectiveAssignments}
                density={settings.density}
                selectedAssignmentId={selectedAssignmentId}
                readonly={readonly}
                onCellClick={handleCellClick}
                onAssignmentClick={handleAssignmentClick}
                onAssignmentMove={handleAssignmentMove}
                onAssignmentCopy={handleAssignmentCopy}
                staffingMap={dateStatusMap}
                complianceData={complianceData}
                rotationViolationIds={rotationViolationIds}
                employeeTeamMap={employeeTeamMap}
                themeMode={settings.themeMode}
              />
            </div>
          )}
        </div>

        {/* Inline detail sidebar — spring animation */}
        <div
          className="overflow-hidden flex-shrink-0"
          style={{
            width: panelOpen ? 320 : 0,
            marginLeft: panelOpen ? 12 : 0,
            opacity: panelOpen ? 1 : 0,
            transform: panelOpen ? 'translateX(0)' : 'translateX(24px)',
            transition: panelOpen
              ? 'width 300ms cubic-bezier(0.22,1,0.36,1), margin-left 300ms cubic-bezier(0.22,1,0.36,1), opacity 200ms ease 50ms, transform 300ms cubic-bezier(0.22,1,0.36,1)'
              : 'width 200ms ease-in, margin-left 200ms ease-in, opacity 150ms ease, transform 200ms ease-in',
          }}
        >
          {panelOpen && (
            <div
              className="w-80 h-full max-h-[calc(100vh-240px)] overflow-y-auto rounded-xl border bg-white/95 backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
              style={{ borderColor: 'rgba(0,0,0,0.08)' }}
            >
              {panel.type === 'quickAdd' && (
                <QuickAddPanel
                  employee={panel.employee}
                  date={panel.date}
                  templates={panel.availableTemplates}
                  onClose={closePanel}
                  onSuccess={() => { toastSuccess('Dienst ingepland'); closePanel() }}
                />
              )}
              {panel.type === 'detail' && (
                <AssignmentDetailPanel
                  assignment={panel.assignment}
                  templates={templates}
                  readonly={readonly}
                  onClose={closePanel}
                  onDeleted={closePanel}
                  onUpdated={closePanel}
                />
              )}
            </div>
          )}
        </div>
      </div>

      </div>{/* end .planner-cockpit */}

      {/* ── Tabbed navigation ──────────────────────────────────────────── */}
      {employees.length > 0 && templates.length > 0 && (
        <div className="space-y-4">

          {/* Tab bar — ExpandableTabs */}
          <div className="flex items-center gap-3">
            <ExpandableTabs
              tabs={[
                {
                  title: 'Schedule',
                  icon: CalendarRange,
                },
                {
                  title: 'Staffing',
                  icon: Users,
                  badge: understaffedCount > 0 ? (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[10px] font-bold leading-none bg-red-500 text-white">{understaffedCount}</span>
                  ) : overstaffedCount > 0 ? (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[10px] font-bold leading-none bg-amber-500 text-white">{overstaffedCount}</span>
                  ) : staffingEntries.length > 0 ? (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[10px] font-bold leading-none bg-emerald-500 text-white">{'\u2713'}</span>
                  ) : undefined,
                },
                { type: 'separator' as const },
                {
                  title: 'Forecast',
                  icon: TrendingUp,
                  badge: forecast.entries.length > 0 ? (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[10px] font-bold leading-none bg-indigo-500 text-white">
                      {Math.round(forecast.entries.length / Math.max(1, templates.length))}d
                    </span>
                  ) : undefined,
                },
              ]}
              selected={plannerTab === 'schedule' ? 0 : plannerTab === 'staffing' ? 1 : 3}
              onChange={(idx) => {
                if (idx === 0) setPlannerTab('schedule')
                else if (idx === 1) setPlannerTab('staffing')
                else if (idx === 3) setPlannerTab('forecast')
              }}
              activeColor="text-[#4F6BFF]"
            />

            {/* Spacer */}
            <div className="flex-1" />

            {/* Bulk scheduling button — planners only */}
            {!readonly && (
              <button
                onClick={() => setBulkModalOpen((v) => !v)}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  bulkModalOpen
                    ? 'bg-[#4F6BFF] text-white'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
                ].join(' ')}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M2 3h10M2 7h10M2 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  <path d="M11 1l2 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Bulk
              </button>
            )}
          </div>

          {/* ── Tab: Schedule ──────────────────────────────────────────── */}
          {plannerTab === 'schedule' && (
            <div className="space-y-4">
              {/* Compliance panel */}
              <WeeklyCompliancePanel weekly={complianceData.weekly} employeeNames={employeeNamesMap} />

              {/* Manual entry — inline compact form */}
              {!readonly && (
                <div className="ds-card p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick assignment</p>
                  <AssignmentForm employees={employees} templates={templates} />
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Staffing ─────────────────────────────────────────── */}
          {plannerTab === 'staffing' && (
            <div className="space-y-5">
              {/* Shift staffing matrix */}
              {templates.length > 0 && dates.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Shift staffing matrix</h3>
                  <ShiftStaffingMatrix
                    dates={dates}
                    templates={templates}
                    staffingEntries={staffingEntries}
                  />
                </div>
              )}

              {/* Staffing gaps with auto-fill */}
              {staffingEntries.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Gaps & candidates</h3>
                  <StaffingGapsPanel entries={staffingEntries} readonly={readonly} departmentScope={activeDeptScope} />
                </div>
              )}

              {/* Compliance */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contract hours compliance</h3>
                <WeeklyCompliancePanel weekly={complianceData.weekly} employeeNames={employeeNamesMap} />
              </div>
            </div>
          )}

          {/* ── Tab: Forecast ─────────────────────────────────────────── */}
          {plannerTab === 'forecast' && (
            <div className="space-y-5">
              {/* Forecast panel */}
              {forecast.entries.length > 0 ? (
                <ForecastPanel forecast={forecast} maxSample={forecastMaxSample} />
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-400">No forecast data available yet.</p>
                  <p className="text-xs text-gray-300 mt-1">Forecasts appear once future dates are in the current window.</p>
                </div>
              )}

              {/* Daily breakdown / trend */}
              {metrics.byDay.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Daily trend</h3>
                  <StaffingTrendTable metrics={metrics} />
                </div>
              )}
            </div>
          )}

          {/* ── Bulk scheduling modal ─────────────────────────────────── */}
          <AnimatePresence>
            {bulkModalOpen && !readonly && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
                  onClick={() => setBulkModalOpen(false)}
                  aria-hidden="true"
                />
                <motion.div
                  initial={{ opacity: 0, y: 60, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 40, scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[520px] max-w-[95vw]"
                >
                  <div
                    className="rounded-2xl border border-gray-200 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.18)] p-5"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-gray-900">Bulk Scheduling</h3>
                      <button
                        onClick={() => setBulkModalOpen(false)}
                        className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        aria-label="Close"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                          <path d="M10 4L4 10M4 4l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                    <BulkActionsPanel employees={employees} />
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}

      </>)}
    </div>
  )
}

