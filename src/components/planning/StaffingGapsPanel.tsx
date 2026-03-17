'use client'

import { useState, useTransition } from 'react'
import type { StaffingEntry } from '@/lib/staffing'
import type { AutofillCandidate } from '@/lib/autofill'
import { autoFillShiftAction } from '@/app/planning/actions'
import AiAssistPanel from '@/components/planning/AiAssistPanel'
import { Tooltip, EmptyState } from '@/components/ui'

interface Props {
  entries: StaffingEntry[]
  readonly?: boolean
  departmentScope?: string[] | null
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function formatDisplayDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

// ---------------------------------------------------------------------------
// Per-shift auto-fill control
// ---------------------------------------------------------------------------

interface AutoFillState {
  status: 'idle' | 'pending' | 'done' | 'error'
  created: number
  remaining: number
  filled: AutofillCandidate[]
  error?: string
  requiredSkillName?: string
}

function AutoFillButton({
  entry,
  departmentScope,
}: {
  entry: StaffingEntry
  departmentScope?: string[] | null
}) {
  const [state, setState] = useState<AutoFillState>({
    status: 'idle',
    created: 0,
    remaining: entry.open,
    filled: [],
  })
  const [, startTransition] = useTransition()

  function handleFill() {
    setState({ status: 'pending', created: 0, remaining: entry.open, filled: [] })
    startTransition(async () => {
      const result = await autoFillShiftAction(
        entry.template.id,
        entry.date,
        entry.required,
        departmentScope,
      )
      if (result.error) {
        setState({ status: 'error', created: 0, remaining: entry.open, filled: [], error: result.error })
      } else {
        setState({
          status: 'done',
          created: result.created,
          remaining: result.remaining,
          filled: result.candidates,
          requiredSkillName: result.requiredSkillName,
        })
      }
    })
  }

  if (state.status === 'idle') {
    return (
      <button
        onClick={handleFill}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 shadow-sm hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100 transition-colors"
      >
        <svg className="w-3 h-3 text-gray-400" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Auto-fill
      </button>
    )
  }

  if (state.status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
        <svg className="w-3 h-3 animate-spin" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25" />
          <path d="M10.5 6a4.5 4.5 0 0 0-4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Filling…
      </span>
    )
  }

  if (state.status === 'error') {
    return (
      <span className="text-xs text-red-600">{state.error}</span>
    )
  }

  // done
  if (state.created === 0 && state.remaining === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium count-up-enter">
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="#22C55E" opacity="0.15" />
          <path d="M5 8l2 2 4-4" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Already full
      </span>
    )
  }

  if (state.created === 0 && state.remaining > 0) {
    const slotsMsg = `${state.remaining} slot${state.remaining !== 1 ? 's' : ''} still open`
    return (
      <span className="text-xs text-gray-500 count-up-enter">
        {state.requiredSkillName
          ? `No staff with \u201c${state.requiredSkillName}\u201d available \u2014 ${slotsMsg}`
          : `No eligible candidates \u2014 ${slotsMsg}`}
      </span>
    )
  }

  return (
    <div className="inline-flex flex-col gap-0.5 count-up-enter">
      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="#22C55E" opacity="0.15" />
          <path d="M5 8l2 2 4-4" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {state.created} assigned
        {state.remaining > 0 && (
          <span className="font-normal text-gray-500 ml-1">· {state.remaining} open</span>
        )}
      </span>
      {state.filled.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {state.filled.map(({ employee, reason }) => (
            <span
              key={employee.id}
              className={[
                'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                reason === 'internal'
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-orange-50 text-orange-700',
              ].join(' ')}
            >
              {employee.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function StaffingGapsPanel({ entries, readonly, departmentScope }: Props) {
  const gaps = entries.filter((e) => e.status !== 'staffed')

  if (entries.length === 0) {
    return (
      <EmptyState
        compact
        title="Nog geen data beschikbaar"
        description="Deze statistiek wordt zichtbaar zodra er planningdata beschikbaar is."
      />
    )
  }

  if (gaps.length === 0) {
    return (
      <div className="rounded-xl border border-green-100 bg-green-50 px-5 py-4 text-sm text-green-700">
        All {entries.length} shift/day combinations are fully staffed this period.
      </div>
    )
  }

  // Collect ordered unique dates
  const seenDates = new Set<string>()
  const orderedDates: string[] = []
  for (const e of gaps) {
    if (!seenDates.has(e.date)) { seenDates.add(e.date); orderedDates.push(e.date) }
  }

  const understaffedCount = gaps.filter((e) => e.status === 'understaffed').length
  const overstaffedCount = gaps.filter((e) => e.status === 'overstaffed').length

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
          Shift gaps — {orderedDates.length} day{orderedDates.length !== 1 ? 's' : ''} affected
        </span>
        <div className="flex items-center gap-2">
          {understaffedCount > 0 && (
            <Tooltip text="Diensten met te weinig ingepland personeel ten opzichte van de vereiste bezetting.">
            <span className="rounded-full border border-red-100 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
              {understaffedCount} understaffed
            </span>
            </Tooltip>
          )}
          {overstaffedCount > 0 && (
            <Tooltip text="Diensten met meer personeel ingepland dan vereist.">
            <span className="rounded-full border border-amber-100 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              {overstaffedCount} overstaffed
            </span>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Rows grouped by date */}
      <div className="divide-y divide-gray-100">
        {orderedDates.map((date) => {
          const dateEntries = gaps.filter((e) => e.date === date)
          return (
            <div key={date} className="px-5 py-4">
              {/* Date label */}
              <div className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {formatDisplayDate(date)}
              </div>

              <div className="space-y-4">
                {dateEntries.map((entry) => (
                  <div key={entry.template.id}>
                    {/* Shift row */}
                    <div className="flex items-center gap-3 min-w-0 flex-wrap">
                      {entry.status === 'understaffed' ? (
                        <span className="shrink-0 rounded-md border border-red-100 bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-700">
                          Under
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-md border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                          Over
                        </span>
                      )}

                      <span className="text-sm font-medium text-gray-900">
                        {entry.template.name}
                      </span>

                      <span className="text-xs text-gray-400 tabular-nums">
                        {entry.template.startTime}–{entry.template.endTime}
                      </span>

                      <div className="ml-auto flex items-center gap-3 text-xs tabular-nums shrink-0">
                        <span className="text-gray-500">
                          {entry.assigned}/{entry.required} assigned
                        </span>
                        {entry.status === 'understaffed' && (
                          <span className="font-semibold text-red-600">
                            {entry.open} open
                          </span>
                        )}
                        {entry.status === 'overstaffed' && (
                          <span className="font-semibold text-amber-600">
                            +{entry.assigned - entry.required} over
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Understaffed: candidate list + auto-fill */}
                    {entry.status === 'understaffed' && (
                      <div className="mt-2 ml-2 pl-3 border-l-2 border-gray-100 space-y-2">
                        {/* Suggested candidates */}
                        {entry.candidates.length > 0 ? (
                          <div>
                            <div className="mb-1.5 text-xs text-gray-400">
                              Available to assign:
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {entry.candidates.slice(0, 7).map((c) => (
                                <span
                                  key={c.id}
                                  className={[
                                    'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                                    c.employeeType === 'internal'
                                      ? 'bg-blue-50 text-blue-700'
                                      : 'bg-orange-50 text-orange-700',
                                  ].join(' ')}
                                >
                                  {c.name}
                                </span>
                              ))}
                              {entry.candidates.length > 7 && (
                                <span className="self-center text-xs text-gray-400">
                                  +{entry.candidates.length - 7} more
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-red-500">
                            No unassigned employees available for this date.
                          </span>
                        )}

                        {/* Auto-fill button — hidden for viewers */}
                        {!readonly && entry.candidates.length > 0 && (
                          <div className="pt-0.5">
                            <AutoFillButton entry={entry} departmentScope={departmentScope} />
                          </div>
                        )}

                        {/* AI Assist — expandable recommendation panel */}
                        <AiAssistPanel
                          entry={entry}
                          readonly={readonly ?? false}
                          departmentScope={departmentScope}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

