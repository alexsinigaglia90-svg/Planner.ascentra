'use client'

import { useRef, useEffect } from 'react'
import type { Density } from '@/components/planning/PlanningGrid'
import type { PlannerSettings } from '@/lib/plannerState'
import PlannerSettingsPanel from '@/components/planning/PlannerSettingsPanel'

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
  { value: 'focus',    label: 'Focus',    title: 'Spacious, detail-first' },
  { value: 'balanced', label: 'Balanced', title: 'Default working mode' },
  { value: 'power',    label: 'Power',    title: 'Dense, many employees' },
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
    <div className="flex items-center gap-2.5 flex-wrap">
      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1">
        <button
          onClick={onPrev}
          aria-label="Previous period"
          className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:text-gray-800 hover:border-gray-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button
          onClick={onToday}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-colors"
        >
          Today
        </button>

        <button
          onClick={onNext}
          aria-label="Next period"
          className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:text-gray-800 hover:border-gray-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* ── Period label + calendar date-jump ──────────────────────────────── */}
      {/* Wrapping with <label> makes the hidden date input clickable from the icon */}
      <label className="relative flex items-center gap-1.5 cursor-pointer group select-none ml-0.5">
        <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
          {formatPeriod(windowStart, settings.weekSpan)}
        </span>
        <svg
          className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0"
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

      {/* Spacer */}
      <div className="flex-1 min-w-[1rem]" />

      {/* ── Week span ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50/60 p-0.5">
        {WEEK_SPANS.map((ws) => (
          <button
            key={ws.value}
            onClick={() => onSettingsChange({ ...settings, weekSpan: ws.value })}
            className={[
              'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
              settings.weekSpan === ws.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-400 hover:text-gray-700',
            ].join(' ')}
          >
            {ws.label}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-gray-200 shrink-0" />

      {/* ── Density ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50/60 p-0.5">
        {DENSITY_MODES.map((mode) => (
          <button
            key={mode.value}
            onClick={() => onSettingsChange({ ...settings, density: mode.value as Density })}
            title={mode.title}
            className={[
              'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
              settings.density === mode.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-400 hover:text-gray-700',
            ].join(' ')}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-gray-200 shrink-0" />

      {/* ── Filters toggle ─────────────────────────────────────────────────── */}
      <button
        onClick={onToggleFilters}
        aria-expanded={filtersExpanded}
        className={[
          'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
          filtersExpanded || filterCount > 0
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300',
        ].join(' ')}
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M1 3h12M3 7h8M5 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        Filters
        {filterCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[1rem] h-4 rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white">
            {filterCount}
          </span>
        )}
      </button>

      {/* ── Settings ───────────────────────────────────────────────────────── */}
      <div className="relative" ref={settingsRef}>
        <button
          onClick={onToggleSettings}
          aria-label="Planner settings"
          aria-expanded={settingsOpen}
          className={[
            'rounded-lg border p-1.5 transition-colors',
            settingsOpen
              ? 'border-gray-300 bg-gray-100 text-gray-700'
              : 'border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300',
          ].join(' ')}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3" />
            <path
              d="M7 1.5v1M7 11.5v1M1.5 7h1M11.5 7h1M3.2 3.2l.7.7M10.1 10.1l.7.7M10.1 3.9l-.7.7M3.9 10.1l-.7.7"
              stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
            />
          </svg>
        </button>

        {settingsOpen && (
          <PlannerSettingsPanel settings={settings} onChange={onSettingsChange} />
        )}
      </div>
    </div>
  )
}
