'use client'

import { useRef, useEffect } from 'react'
import type { Density } from '@/components/planning/PlanningGrid'
import type { PlannerSettings } from '@/lib/plannerState'
import PlannerSettingsPanel from '@/components/planning/PlannerSettingsPanel'
import { Tooltip } from '@/components/ui'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  windowStart: string
  settings: PlannerSettings
  settingsOpen: boolean
  filterCount: number
  filtersExpanded: boolean
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  /** Called with an ISO date string (YYYY-MM-DD); caller jumps to the Monday of that week. */
  onJumpToDate: (isoDate: string) => void
  onSettingsChange: (s: PlannerSettings) => void
  onToggleSettings: () => void
  onToggleFilters: () => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DENSITY_MODES: { value: Density; label: string; title: string }[] = [
  { value: 'focus',    label: 'Focus',    title: 'Compacte planning met minimale rijhoogte.' },
  { value: 'balanced', label: 'Balanced', title: 'Gebalanceerde dichtheid tussen overzicht en detail.' },
  { value: 'power',    label: 'Power',    title: 'Maximale detailweergave voor complexe planning.' },
]

const WEEK_SPANS: { value: 1 | 2 | 3 | 4; label: string }[] = [
  { value: 1, label: '1w' },
  { value: 2, label: '2w' },
  { value: 3, label: '3w' },
  { value: 4, label: '4w' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPeriod(windowStart: string, weekSpan: number): string {
  const s = new Date(windowStart + 'T00:00:00')
  const e = new Date(windowStart + 'T00:00:00')
  e.setDate(e.getDate() + weekSpan * 7 - 1)
  return `${s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PlannerControlBar({
  windowStart,
  settings,
  settingsOpen,
  filterCount,
  filtersExpanded,
  onPrev,
  onNext,
  onToday,
  onJumpToDate,
  onSettingsChange,
  onToggleSettings,
  onToggleFilters,
}: Props) {
  const settingsRef = useRef<HTMLDivElement>(null)

  // Close settings popover when clicking outside
  useEffect(() => {
    if (!settingsOpen) return
    function handleMouseDown(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        onToggleSettings()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [settingsOpen, onToggleSettings])

  return (
    <div className="planner-toolbar">
      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onPrev}
          aria-label="Previous period"
          className="planner-btn planner-btn-icon"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button
          onClick={onToday}
          className="planner-btn"
        >
          Today
        </button>

        <button
          onClick={onNext}
          aria-label="Next period"
          className="planner-btn planner-btn-icon"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* ── Period label + calendar date-jump ──────────────────────────────── */}
      <Tooltip text="Spring direct naar een specifieke datum.">
      <label className="relative flex items-center gap-1.5 cursor-pointer group select-none ml-1 shrink-0">
        <span className="text-sm font-medium text-white/75 group-hover:text-white/95 transition-colors whitespace-nowrap">
          {formatPeriod(windowStart, settings.weekSpan)}
        </span>
        <svg
          className="w-3.5 h-3.5 text-white/25 group-hover:text-white/50 transition-colors shrink-0"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
        >
          <rect x="1" y="2.5" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M4.5 1v2M9.5 1v2M1 6h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <input
          type="date"
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          value={windowStart}
          onChange={(e) => { if (e.target.value) onJumpToDate(e.target.value) }}
          aria-label="Jump to week"
        />
      </label>
      </Tooltip>

      {/* Spacer */}
      <div className="flex-1 min-w-2" />

      {/* ── Week span ──────────────────────────────────────────────────────── */}
      <div className="planner-seg">
        {WEEK_SPANS.map((ws) => (
          <Tooltip key={ws.value} text="Bepaalt hoeveel weken tegelijk zichtbaar zijn.">
            <button
              onClick={() => onSettingsChange({ ...settings, weekSpan: ws.value })}
              className={[
                'planner-seg-btn',
                settings.weekSpan === ws.value ? 'planner-seg-btn-active' : '',
              ].join(' ')}
            >
              {ws.label}
            </button>
          </Tooltip>
        ))}
      </div>

      <div className="planner-divider" />

      {/* ── Density ────────────────────────────────────────────────────────── */}
      <div className="planner-seg">
        {DENSITY_MODES.map((mode) => (
          <Tooltip key={mode.value} text={mode.title}>
            <button
              onClick={() => onSettingsChange({ ...settings, density: mode.value as Density })}
              className={[
                'planner-seg-btn',
                settings.density === mode.value ? 'planner-seg-btn-active' : '',
              ].join(' ')}
            >
              {mode.label}
            </button>
          </Tooltip>
        ))}
      </div>

      <div className="planner-divider" />

      {/* ── Filters toggle ─────────────────────────────────────────────────── */}
      <button
        onClick={onToggleFilters}
        aria-expanded={filtersExpanded}
        className={[
          'planner-btn',
          filtersExpanded || filterCount > 0 ? 'planner-btn-active' : '',
        ].join(' ')}
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M1 3h12M3 7h8M5 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        Filters
        {filterCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-[#4F6BFF] px-1 text-[10px] font-bold text-white">
            {filterCount}
          </span>
        )}
      </button>

      {/* ── Settings ───────────────────────────────────────────────────────── */}
      <div className="relative" ref={settingsRef}>
        <Tooltip text="Planner instellingen openen.">
        <button
          onClick={onToggleSettings}
          aria-label="Planner settings"
          aria-expanded={settingsOpen}
          className={[
            'planner-btn planner-btn-icon',
            settingsOpen ? 'planner-btn-active' : '',
          ].join(' ')}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3" />
            <path
              d="M7 1.5v1M7 11.5v1M1.5 7h1M11.5 7h1M3.2 3.2l.7.7M10.1 10.1l.7.7M10.1 3.9l-.7.7M3.9 10.1l-.7.7"
              stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
            />
          </svg>
        </button>        </Tooltip>
        {settingsOpen && (
          <PlannerSettingsPanel settings={settings} onChange={onSettingsChange} />
        )}
      </div>
    </div>
  )
}
