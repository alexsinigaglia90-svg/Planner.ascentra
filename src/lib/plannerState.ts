/**
 * Planner settings (persisted) and filter (ephemeral) types.
 *
 * Settings survive page reloads via localStorage.
 * Filters reset each session — they are navigation-like, not preferences.
 */

import type { Density } from '@/components/planning/PlanningGrid'

// ── Settings ──────────────────────────────────────────────────────────────────

export type ViewMode = 'planner' | 'operations'

export interface PlannerSettings {
  density: Density
  /** Weeks visible at once in the grid (1–4). Controls windowDays = weekSpan * 7. */
  weekSpan: 1 | 2 | 3 | 4
  showWeekends: boolean
  showForecast: boolean
  showStaffingPanel: boolean
  showInsightsSummary: boolean
  /** Active top-level view. */
  viewMode: ViewMode
}

export const DEFAULT_SETTINGS: PlannerSettings = {
  density: 'balanced',
  weekSpan: 2,
  showWeekends: true,
  showForecast: true,
  showStaffingPanel: true,
  showInsightsSummary: true,
  viewMode: 'planner',
}

const SETTINGS_KEY = 'planner.settings.v1'

/** Read settings from localStorage. Falls back to defaults on any parse error. */
export function loadSettings(): PlannerSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_SETTINGS
}

/** Persist settings to localStorage. Silently swallows quota/security errors. */
export function saveSettings(s: PlannerSettings): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {}
}

// ── Filters ───────────────────────────────────────────────────────────────────

export type EmployeeTypeFilter = 'all' | 'internal' | 'temp'
export type WorkerClassFilter = 'all' | 'direct' | 'overhead'

export interface PlannerFilters {
  employeeType: EmployeeTypeFilter
  /** Single employee ID to show, or null for all. */
  employeeId: string | null
  /** Single shift template ID to show assignments for, or null for all. */
  templateId: string | null
  /** When true, narrow rows to employees on understaffed shifts. */
  understaffedOnly: boolean
  /** Narrow to employees/shifts belonging to this location. */
  locationId: string | null
  /** Narrow to employees/shifts belonging to this department. */
  departmentId: string | null
  /**
   * 'direct'   = show only direct-labour employees (overhead === false / null)
   * 'overhead' = show only overhead employees
   * 'all'      = no filter (default)
   */
  workerClass: WorkerClassFilter
}

export const DEFAULT_FILTERS: PlannerFilters = {
  employeeType: 'all',
  employeeId: null,
  templateId: null,
  understaffedOnly: false,
  locationId: null,
  departmentId: null,
  workerClass: 'all',
}

export function activeFilterCount(f: PlannerFilters): number {
  return (
    (f.employeeType !== 'all' ? 1 : 0) +
    (f.employeeId !== null ? 1 : 0) +
    (f.templateId !== null ? 1 : 0) +
    (f.understaffedOnly ? 1 : 0) +
    (f.locationId !== null ? 1 : 0) +
    (f.departmentId !== null ? 1 : 0) +
    (f.workerClass !== 'all' ? 1 : 0)
  )
}
