'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import type { AuditLog } from '@prisma/client'
import type { AuditActor } from '@/lib/queries/auditLog'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FilterOption {
  value: string
  label: string
}

export interface CurrentFilters {
  from?: string
  to?: string
  userId?: string
  actionType?: string
  entityType?: string
  view?: string
  page?: string
}

interface Props {
  current: CurrentFilters
  actors: AuditActor[]
  actionTypes: FilterOption[]
  entityTypes: FilterOption[]
  logs: AuditLog[]
  view: 'table' | 'timeline'
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getPresetRange(preset: string): { from: string; to: string } {
  const now = new Date()
  const today = toDateStr(now)

  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case '7d': {
      const d = new Date(now)
      d.setDate(d.getDate() - 6)
      return { from: toDateStr(d), to: today }
    }
    case 'week': {
      const monday = new Date(now)
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
      return { from: toDateStr(monday), to: today }
    }
    case 'month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: toDateStr(first), to: today }
    }
    default:
      return { from: today, to: today }
  }
}

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

function exportCsv(logs: AuditLog[]) {
  const header = 'Timestamp,Action,Entity,Summary,User ID\n'
  const rows = logs.map((l) => {
    const ts = new Date(l.createdAt).toISOString()
    const summary = `"${(l.summary ?? '').replace(/"/g, '""')}"`
    return `${ts},${l.actionType},${l.entityType},${summary},${l.userId}`
  })
  const csv = header + rows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-log-${toDateStr(new Date())}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AuditFiltersBar({
  current,
  actors,
  actionTypes,
  entityTypes,
  logs,
  view,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const navigate = useCallback(
    (overrides: Record<string, string>) => {
      const merged: Record<string, string> = {}
      for (const [k, v] of Object.entries({ ...current, ...overrides })) {
        if (v) merged[k] = v
      }
      // Reset page when filters change (not when page itself changes)
      if (!('page' in overrides)) delete merged.page
      const params = new URLSearchParams(merged)
      startTransition(() => router.push(`${pathname}?${params.toString()}`))
    },
    [current, pathname, router],
  )

  const update = useCallback(
    (key: string, value: string) => navigate({ [key]: value }),
    [navigate],
  )

  const applyPreset = useCallback(
    (preset: string) => {
      const range = getPresetRange(preset)
      navigate({ from: range.from, to: range.to })
    },
    [navigate],
  )

  const clear = useCallback(
    () => startTransition(() => router.push(pathname)),
    [pathname, router],
  )

  const toggleView = useCallback(
    () => update('view', view === 'table' ? 'timeline' : 'table'),
    [update, view],
  )

  const hasFilters = !!(current.from || current.to || current.userId || current.actionType || current.entityType)

  const selectCls =
    'ds-input h-9 text-[13px] min-w-[140px] cursor-pointer'
  const dateCls =
    'ds-input h-9 text-[13px] w-[140px] cursor-pointer'

  // Determine active preset
  const presets = [
    { key: 'today', label: 'Today' },
    { key: '7d', label: 'Last 7 days' },
    { key: 'week', label: 'This week' },
    { key: 'month', label: 'This month' },
  ]
  const activePreset = presets.find((p) => {
    const r = getPresetRange(p.key)
    return current.from === r.from && current.to === r.to
  })?.key

  return (
    <div className="ds-card p-5 space-y-4">
      {/* Row 1: Filters */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Date range */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">From</label>
          <input
            type="date"
            value={current.from ?? ''}
            onChange={(e) => update('from', e.target.value)}
            className={dateCls}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">To</label>
          <input
            type="date"
            value={current.to ?? ''}
            onChange={(e) => update('to', e.target.value)}
            className={dateCls}
          />
        </div>

        {/* User */}
        {actors.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">User</label>
            <select
              value={current.userId ?? ''}
              onChange={(e) => update('userId', e.target.value)}
              className={selectCls}
            >
              <option value="">All users</option>
              {actors.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Action type */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Action</label>
          <select
            value={current.actionType ?? ''}
            onChange={(e) => update('actionType', e.target.value)}
            className={selectCls}
          >
            <option value="">All actions</option>
            {actionTypes.map((at) => (
              <option key={at.value} value={at.value}>{at.label}</option>
            ))}
          </select>
        </div>

        {/* Entity type */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Entity</label>
          <select
            value={current.entityType ?? ''}
            onChange={(e) => update('entityType', e.target.value)}
            className={selectCls}
          >
            <option value="">All entities</option>
            {entityTypes.map((et) => (
              <option key={et.value} value={et.value}>{et.label}</option>
            ))}
          </select>
        </div>

        {/* Clear */}
        {hasFilters && (
          <button
            onClick={clear}
            className="ds-btn ds-btn-ghost ds-btn-sm text-gray-500"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
            Clear
          </button>
        )}
      </div>

      {/* Row 2: Quick presets + View toggle + Export */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-gray-100">
        {/* Quick presets */}
        <div className="flex items-center gap-2 pt-3">
          {presets.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`ds-filter-chip ${activePreset === p.key ? 'ds-filter-chip-active' : ''}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* View toggle + Export */}
        <div className="flex items-center gap-2 pt-3">
          <button
            onClick={toggleView}
            className="ds-btn ds-btn-secondary ds-btn-sm"
            title={view === 'table' ? 'Switch to timeline view' : 'Switch to table view'}
          >
            {view === 'table' ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <circle cx="12" cy="4" r="1.5" fill="currentColor" />
                  <circle cx="12" cy="10" r="1.5" fill="currentColor" />
                  <circle cx="12" cy="16" r="1.5" fill="currentColor" />
                </svg>
                Timeline
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18" />
                </svg>
                Table
              </>
            )}
          </button>

          <button
            onClick={() => exportCsv(logs)}
            className="ds-btn ds-btn-secondary ds-btn-sm"
            title="Export current view as CSV"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Loading indicator */}
      {isPending && (
        <div className="h-0.5 bg-[var(--color-primary)]/20 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-[var(--color-primary)] rounded-full animate-[shimmer_1s_ease-in-out_infinite]" />
        </div>
      )}
    </div>
  )
}
