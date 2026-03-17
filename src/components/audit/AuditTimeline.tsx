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
  create_assignment: 'Created assignment',
  update_assignment: 'Updated assignment',
  delete_assignment: 'Deleted assignment',
  move_assignment: 'Moved assignment',
  copy_assignment: 'Copied assignment',
  copy_day: 'Copied day',
  copy_week: 'Copied week',
  copy_employee_week: 'Copied employee week',
  copy_employee_schedule: 'Copied employee schedule',
  repeat_pattern: 'Repeated pattern',
  autofill: 'Auto-filled shifts',
  'plan-wizard': 'Plan wizard executed',
  update_requirement: 'Updated requirement',
  invite_user: 'Invited user',
  update_member_role: 'Changed member role',
  update_user_status: 'Changed user status',
  remove_member: 'Removed member',
  generate_invite_link: 'Generated invite link',
  generate_reset_link: 'Generated reset link',
  reset_password: 'Password was reset',
  ai_action: 'AI action performed',
}

const DOT_COLOURS: Record<string, string> = {
  create_assignment: 'bg-emerald-400 shadow-emerald-400/40',
  update_assignment: 'bg-blue-400 shadow-blue-400/40',
  delete_assignment: 'bg-red-400 shadow-red-400/40',
  move_assignment: 'bg-violet-400 shadow-violet-400/40',
  copy_assignment: 'bg-sky-400 shadow-sky-400/40',
  copy_day: 'bg-indigo-400 shadow-indigo-400/40',
  copy_week: 'bg-indigo-400 shadow-indigo-400/40',
  copy_employee_week: 'bg-indigo-400 shadow-indigo-400/40',
  copy_employee_schedule: 'bg-indigo-400 shadow-indigo-400/40',
  repeat_pattern: 'bg-purple-400 shadow-purple-400/40',
  autofill: 'bg-teal-400 shadow-teal-400/40',
  'plan-wizard': 'bg-teal-400 shadow-teal-400/40',
  update_requirement: 'bg-amber-400 shadow-amber-400/40',
  invite_user: 'bg-emerald-400 shadow-emerald-400/40',
  update_member_role: 'bg-blue-400 shadow-blue-400/40',
  update_user_status: 'bg-amber-400 shadow-amber-400/40',
  remove_member: 'bg-red-400 shadow-red-400/40',
  generate_invite_link: 'bg-sky-400 shadow-sky-400/40',
  generate_reset_link: 'bg-amber-400 shadow-amber-400/40',
  reset_password: 'bg-amber-400 shadow-amber-400/40',
  ai_action: 'bg-violet-400 shadow-violet-400/40',
}

const DEFAULT_DOT = 'bg-gray-400 shadow-gray-400/40'

// ---------------------------------------------------------------------------
// Group logs by day
// ---------------------------------------------------------------------------

interface DayGroup {
  label: string
  date: string
  logs: AuditLog[]
}

function groupByDay(logs: AuditLog[]): DayGroup[] {
  const groups = new Map<string, AuditLog[]>()

  for (const log of logs) {
    const d = new Date(log.createdAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const arr = groups.get(key)
    if (arr) arr.push(log)
    else groups.set(key, [log])
  }

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

  return Array.from(groups.entries()).map(([date, logs]) => ({
    date,
    label:
      date === todayStr ? 'Today' :
      date === yesterdayStr ? 'Yesterday' :
      new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
    logs,
  }))
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false,
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
}

export default function AuditTimeline({ logs, actors, total, page, totalPages }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const actorMap = new Map(actors.map((a) => [a.id, a]))
  const groups = groupByDay(logs)

  const goToPage = useCallback(
    (p: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', String(p))
      startTransition(() => router.push(`${pathname}?${params.toString()}`))
    },
    [router, pathname, searchParams],
  )

  if (logs.length === 0) {
    return (
      <div className="ds-card flex flex-col items-center justify-center py-16 px-8">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="10" />
          </svg>
        </div>
        <p className="ds-empty-title text-gray-600">No audit entries found</p>
        <p className="ds-empty-description text-gray-400 mt-1">Try adjusting your filters or date range</p>
      </div>
    )
  }

  return (
    <div className="ds-card overflow-hidden">
      <div className="p-6">
        {groups.map((group, gi) => (
          <div key={group.date} className={gi > 0 ? 'mt-8' : ''}>
            {/* Day header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-2">
                {group.label}
              </span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            {/* Timeline entries */}
            <div className="relative pl-8">
              {/* Vertical line */}
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-200" />

              <div className="space-y-1">
                {group.logs.map((log) => {
                  const dotColour = DOT_COLOURS[log.actionType] ?? DEFAULT_DOT
                  const actor = actorMap.get(log.userId)
                  const isOpen = expanded === log.id

                  return (
                    <div key={log.id}>
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : log.id)}
                        className={`w-full text-left relative flex items-start gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-gray-50/80 ${isOpen ? 'bg-gray-50/80' : ''}`}
                      >
                        {/* Dot */}
                        <span
                          className={`absolute left-[-21px] top-[18px] w-3 h-3 rounded-full shadow-sm ${dotColour}`}
                        />

                        {/* Time */}
                        <span className="text-xs text-gray-400 tabular-nums pt-0.5 w-12 shrink-0">
                          {formatTime(log.createdAt)}
                        </span>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] text-gray-800 leading-snug">
                            <span className="font-medium">
                              {ACTION_LABELS[log.actionType] ?? log.actionType}
                            </span>
                          </p>
                          <p className="text-[13px] text-gray-500 leading-snug mt-0.5 truncate">
                            {log.summary}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-1">
                            by {actor?.name ?? log.userId}
                            {log.entityType === 'bulk' && (
                              <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-medium">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 3H8l-2 4h12L16 3z" />
                                </svg>
                                bulk
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Chevron */}
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`text-gray-300 shrink-0 mt-1 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>

                      {/* Expanded detail */}
                      {isOpen && (
                        <div className="ml-16 mr-4 mb-3 rounded-xl overflow-hidden border border-gray-200">
                          <AuditDetailPanel log={log} userName={actor?.name} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination footer */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/40 flex items-center justify-between">
          <p className="text-xs text-gray-400 tabular-nums">
            Showing {(page - 1) * 30 + 1}–{Math.min(page * 30, total)} of {total}
          </p>

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

            <span className="text-xs text-gray-500 px-2 tabular-nums">
              Page {page} of {totalPages}
            </span>

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
        </div>
      )}
    </div>
  )
}
