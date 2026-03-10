'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import type { Employee } from '@/lib/queries/employees'
import type { AssignmentWithRelations } from '@/lib/queries/assignments'
import type { ShiftTemplate } from '@/lib/queries/shiftTemplates'
import type { ShiftRequirement } from '@/lib/queries/shiftRequirements'
import type { AppRole } from '@/lib/auth/context'
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
import { moveAssignmentAction, copyAssignmentAction } from '@/app/planning/actions'
import OperationsView from '@/components/planning/OperationsView'
import PlannerCommandBar from './PlannerCommandBar'
import PlannerWorkforceRail from './PlannerWorkforceRail'
import PlannerTimelineCanvas from './PlannerTimelineCanvas'

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
  | { type: 'quickAdd'; employee: Employee; date: string; availableTemplates: ShiftTemplate[] }
  | { type: 'detail'; assignment: AssignmentWithRelations }

type NamedItem = { id: string; name: string }

interface Props {
  employees: Employee[]
  assignments: AssignmentWithRelations[]
  templates: ShiftTemplate[]
  requirements: ShiftRequirement[]
  locations: NamedItem[]
  departments: NamedItem[]
  role: AppRole
  rotationViolationIds?: Set<string>
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PlanningView({ employees, assignments, templates, requirements, locations, departments, role, rotationViolationIds }: Props) {
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

  // ── Staffing analysis (full, unfiltered — drives grid decorations) ────────
  const requirementsMap = useMemo(
    () => new Map(requirements.map((r) => [r.shiftTemplateId, r.requiredHeadcount])),
    [requirements],
  )

  const staffingEntries = useMemo(
    () =>
      templates.length > 0
        ? analyzeStaffing({ dates, assignments, templates, employees, requirementsMap })
        : [],
    [dates, assignments, templates, employees, requirementsMap],
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

  // Step 1: type + individual employee filter
  const filteredEmployees = useMemo(
    () =>
      employees.filter((e) => {
        if (filters.employeeType !== 'all' && e.employeeType !== filters.employeeType) return false
        if (filters.employeeId !== null && e.id !== filters.employeeId) return false
        if (filters.locationId !== null && (e as { locationId?: string | null }).locationId !== filters.locationId) return false
        if (filters.departmentId !== null && (e as { departmentId?: string | null }).departmentId !== filters.departmentId) return false
        return true
      }),
    [employees, filters.employeeType, filters.employeeId, filters.locationId, filters.departmentId],
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
  function handleCellClick(employee: Employee, date: string) {
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

  function handleAssignmentMove(assignmentId: string, targetEmployeeId: string, targetDate: string) {
    if (readonly) return
    setDragError(null)
    startTransition(async () => {
      const result = await moveAssignmentAction(assignmentId, targetDate, targetEmployeeId)
      if (result.error) {
        setDragError(result.error)
        setTimeout(() => setDragError(null), 4000)
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
    <div className="flex flex-col h-full min-h-screen bg-gray-50">
      {/* Command bar (top sticky) */}
      <PlannerCommandBar>
        {/* View-mode toggle, filter bar, insights summary, etc. */}
        {/* Move existing controls here, preserve logic */}
        {/* ...existing code for controls... */}
      </PlannerCommandBar>

      <div className="flex flex-row flex-1">
        {/* Workforce rail (left sticky) */}
        <PlannerWorkforceRail>
          {/* Render employee names, team/ploeg indicators */}
          {/* ...existing code for employee column... */}
        </PlannerWorkforceRail>

        {/* Timeline canvas (main scrollable area) */}
        <PlannerTimelineCanvas>
          {/* Render planning grid, shift cards, etc. */}
          {/* ...existing code for grid... */}
        </PlannerTimelineCanvas>
      </div>

      {/* ...existing code for side panel, modals, etc. */}
    </div>
  )
}

