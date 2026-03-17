'use client'

import { useState, useCallback, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { AuditLog } from '@prisma/client'
import type { AuditActor } from '@/lib/queries/auditLog'
import AuditDetailPanel from './AuditDetailPanel'

// ---------------------------------------------------------------------------
// Display maps
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  create_assignment: 'Created',
  update_assignment: 'Updated',
  delete_assignment: 'Deleted',
  move_assignment: 'Moved',
  copy_assignment: 'Copied',
  copy_day: 'Copy Day',
  copy_week: 'Copy Week',
  copy_employee_week: 'Emp. Week',
  copy_employee_schedule: 'Emp. Schedule',
  repeat_pattern: 'Repeat',
  autofill: 'Auto-fill',
  'plan-wizard': 'Plan Wizard',
  update_requirement: 'Requirement',
  invite_user: 'Invited',
  update_member_role: 'Role Change',
  update_user_status: 'Status Change',
  remove_member: 'Removed',
  generate_invite_link: 'Invite Link',
  generate_reset_link: 'Reset Link',
  reset_password: 'Password Reset',
  ai_action: 'AI Action',
}

const ACTION_COLOURS: Record<string, { dot: string; badge: string }> = {
  create_assignment:       { dot: 'bg-emerald-400', badge: 'ds-badge ds-badge-success' },
  update_assignment:       { dot: 'bg-blue-400',    badge: 'ds-badge ds-badge-primary' },
  delete_assignment:       { dot: 'bg-red-400',     badge: 'ds-badge ds-badge-error' },
  move_assignment:         { dot: 'bg-violet-400',  badge: 'ds-badge bg-violet-50 text-violet-700' },
  copy_assignment:         { dot: 'bg-sky-400',     badge: 'ds-badge bg-sky-50 text-sky-700' },
  copy_day:                { dot: 'bg-indigo-400',  badge: 'ds-badge bg-indigo-50 text-indigo-700' },
  copy_week:               { dot: 'bg-indigo-400',  badge: 'ds-badge bg-indigo-50 text-indigo-700' },
  copy_employee_week:      { dot: 'bg-indigo-400',  badge: 'ds-badge bg-indigo-50 text-indigo-700' },
  copy_employee_schedule:  { dot: 'bg-indigo-400',  badge: 'ds-badge bg-indigo-50 text-indigo-700' },
  repeat_pattern:          { dot: 'bg-purple-400',  badge: 'ds-badge bg-purple-50 text-purple-700' },
  autofill:                { dot: 'bg-teal-400',    badge: 'ds-badge bg-teal-50 text-teal-700' },
  'plan-wizard':           { dot: 'bg-teal-400',    badge: 'ds-badge bg-teal-50 text-teal-700' },
  update_requirement:      { dot: 'bg-amber-400',   badge: 'ds-badge ds-badge-warning' },
  invite_user:             { dot: 'bg-emerald-400', badge: 'ds-badge ds-badge-success' },
  update_member_role:      { dot: 'bg-blue-400',    badge: 'ds-badge ds-badge-primary' },
  update_user_status:      { dot: 'bg-amber-400',   badge: 'ds-badge ds-badge-warning' },
  remove_member:           { dot: 'bg-red-400',     badge: 'ds-badge ds-badge-error' },
  generate_invite_link:    { dot: 'bg-sky-400',     badge: 'ds-badge bg-sky-50 text-sky-700' },
  generate_reset_link:     { dot: 'bg-amber-400',   badge: 'ds-badge ds-badge-warning' },
  reset_password:          { dot: 'bg-amber-400',   badge: 'ds-badge ds-badge-warning' },
  ai_action:               { dot: 'bg-violet-400',  badge: 'ds-badge bg-violet-50 text-violet-700' },
}

const ENTITY_LABELS: Record<string, string> = {
  assignment: 'Assignment',
  requirement: 'Requirement',
  bulk: 'Bulk',
  user: 'User',
}

const DEFAULT_COLOUR = { dot: 'bg-gray-400', badge: 'ds-badge ds-badge-neutral' }

// ---------------------------------------------------------------------------
// Relative time
// ---------------------------------------------------------------------------

function relativeTime(date: Date): string {
  const now = Date.now()
  const diff = now - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function exactTime(date: Date): string {
  return new Date(date).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  logs: AuditLog[]
  actors: AuditActor[]
  total: number
  page: number
  totalPages: number
  compact?: boolean
}

export default function AuditLogTable({ logs, actors, total, page, totalPages, compact = false }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const actorMap = new Map(actors.map((a) => [a.id, a]))

  const goToPage = useCallback(
    (p: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', String(p))
      startTransition(() => router.push(`${pathname}?${params.toString()}`))
    },
    [router, pathname, searchParams],
  )

  const toggleRow = useCallback((id: string) => {
    setExpanded((prev) => (prev === id ? null : id))
  }, [])

  if (logs.length === 0) {
    return (
      <div className="ds-card flex flex-col items-center justify-center py-16 px-8">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>
        <p className="ds-empty-title text-gray-600">No audit entries found</p>
        <p className="ds-empty-description text-gray-400 mt-1">Try adjusting your filters or date range</p>
      </div>
    )
  }

  // ── Compact mode (used embedded elsewhere) ──
  if (compact) {
    return (
      <div className="space-y-1">
        {logs.map((log) => {
          const colour = ACTION_COLOURS[log.actionType] ?? DEFAULT_COLOUR
          return (
            <div
              key={log.id}
              className="flex items-start gap-3 rounded-lg px-3 py-2.5 text-xs hover:bg-gray-50 transition-colors"
            >
              <span className={`shrink-0 mt-1 w-2 h-2 rounded-full ${colour.dot}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`${colour.badge} text-[10px]`}>
                    {ACTION_LABELS[log.actionType] ?? log.actionType}
                  </span>
                  <span className="text-gray-400 tabular-nums">{relativeTime(log.createdAt)}</span>
                </div>
                <p className="text-gray-700 leading-snug truncate mt-0.5">{log.summary}</p>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Full table ──
  return (
    <div className="ds-table-wrap">
      <div className="overflow-x-auto">
        <table className="ds-table">
          <thead className="ds-table-head">
            <tr>
              <th className="ds-table-th w-12" />
              <th className="ds-table-th w-32">Time</th>
              <th className="ds-table-th w-28">Action</th>
              <th className="ds-table-th w-24">Entity</th>
              <th className="ds-table-th">Summary</th>
              <th className="ds-table-th w-40">User</th>
              <th className="ds-table-th w-10" />
            </tr>
          </thead>
          <tbody className="ds-table-body">
            {logs.map((log) => {
              const colour = ACTION_COLOURS[log.actionType] ?? DEFAULT_COLOUR
              const actor = actorMap.get(log.userId)
              const isOpen = expanded === log.id

              return (
                <Fragment key={log.id}>
                  <tr
                    className={`ds-table-row cursor-pointer ${isOpen ? 'bg-gray-50/80' : ''}`}
                    onClick={() => toggleRow(log.id)}
                  >
                    {/* Timeline dot */}
                    <td className="ds-table-td text-center">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${colour.dot}`} />
                    </td>

                    {/* Timestamp */}
                    <td className="ds-table-td ds-table-td-meta tabular-nums whitespace-nowrap" title={exactTime(log.createdAt)}>
                      {relativeTime(log.createdAt)}
                    </td>

                    {/* Action badge */}
                    <td className="ds-table-td">
                      <span className={`${colour.badge} text-[11px] whitespace-nowrap`}>
                        {ACTION_LABELS[log.actionType] ?? log.actionType}
                      </span>
                    </td>

                    {/* Entity type */}
                    <td className="ds-table-td ds-table-td-secondary whitespace-nowrap">
                      {ENTITY_LABELS[log.entityType] ?? log.entityType}
                    </td>

                    {/* Summary */}
                    <td className="ds-table-td ds-table-td-primary max-w-md truncate">
                      {log.summary}
                    </td>

                    {/* User */}
                    <td className="ds-table-td">
                      <div className="flex items-center gap-2">
                        <span className="ds-avatar-sm text-[11px] shrink-0">
                          {(actor?.name ?? '?').charAt(0).toUpperCase()}
                        </span>
                        <span className="ds-table-td-secondary truncate">
                          {actor?.name ?? log.userId}
                        </span>
                      </div>
                    </td>

                    {/* Expand chevron */}
                    <td className="ds-table-td text-center">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`text-gray-300 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </td>
                  </tr>

                  {/* Expandable detail row */}
                  {isOpen && (
                    <tr>
                      <td colSpan={7} className="p-0">
                        <AuditDetailPanel log={log} userName={actor?.name} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/40 flex items-center justify-between">
        <p className="text-xs text-gray-400 tabular-nums">
          {total === 0
            ? 'No entries'
            : `Showing ${(page - 1) * 30 + 1}–${Math.min(page * 30, total)} of ${total}`}
        </p>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1 || isPending}
              className="ds-btn ds-btn-ghost ds-btn-sm disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {generatePageNumbers(page, totalPages).map((p, i) =>
              p === '...' ? (
                <span key={`dots-${i}`} className="px-1 text-xs text-gray-400">...</span>
              ) : (
                <button
                  key={p}
                  onClick={() => goToPage(p as number)}
                  disabled={isPending}
                  className={`min-w-[32px] h-8 rounded-lg text-xs font-medium transition-colors ${
                    p === page
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {p}
                </button>
              ),
            )}

            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages || isPending}
              className="ds-btn ds-btn-ghost ds-btn-sm disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { Fragment } from 'react'

function generatePageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | '...')[] = [1]

  if (current > 3) pages.push('...')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)

  if (current < total - 2) pages.push('...')

  pages.push(total)
  return pages
}
