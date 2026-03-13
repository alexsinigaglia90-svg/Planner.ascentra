'use client'

/**
 * AiAssistPanel — AI-Assisted Scheduling UI (v1)
 *
 * Renders inline inside StaffingGapsPanel for each understaffed shift.
 * Lazily fetches scored candidates on expand (no waterfall on page load).
 *
 * Scoring is done server-side by the recommendation engine (src/lib/scoring.ts).
 * Every factor is surfaced as an explicit reason or warning tag — no black box.
 *
 * Role behavior:
 *   admin / planner → can assign candidates and trigger smart fill
 *   viewer          → can see recommendations but action buttons are hidden
 */

import { useState, useTransition } from 'react'
import type { StaffingEntry } from '@/lib/staffing'
import type { RecommendationResult, ScoredCandidate, CandidateTier } from '@/lib/scoring'
import {
  getShiftRecommendationsAction,
  assignCandidateAction,
  autoFillShiftAction,
} from '@/app/planning/actions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  entry: StaffingEntry
  readonly: boolean
  departmentScope?: string[] | null
}

type PanelStatus =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'loaded'; result: RecommendationResult }
  | { phase: 'error'; message: string }

// ─── Tier badge ───────────────────────────────────────────────────────────────

const TIER_STYLES: Record<CandidateTier, { dot: string; label: string; badge: string }> = {
  excellent: {
    dot:   'bg-emerald-500',
    label: 'Excellent',
    badge: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  },
  good: {
    dot:   'bg-blue-400',
    label: 'Good',
    badge: 'border-blue-100 bg-blue-50 text-blue-700',
  },
  fair: {
    dot:   'bg-amber-400',
    label: 'Fair',
    badge: 'border-amber-100 bg-amber-50 text-amber-700',
  },
  fallback: {
    dot:   'bg-gray-300',
    label: 'Fallback',
    badge: 'border-gray-100 bg-gray-50 text-gray-500',
  },
}

function TierBadge({ tier, score }: { tier: CandidateTier; score: number }) {
  const s = TIER_STYLES[tier]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums ${s.badge}`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label} · {score}
    </span>
  )
}

// ─── Reason/warning pills ─────────────────────────────────────────────────────

function ReasonPill({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-gray-50 border border-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
      {text}
    </span>
  )
}

function WarningPill({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
      {text}
    </span>
  )
}

// ─── Single candidate row ─────────────────────────────────────────────────────

function CandidateRow({
  candidate,
  onAssign,
  assigning,
  assigned,
  readonly,
}: {
  candidate: ScoredCandidate
  onAssign: (employeeId: string) => void
  assigning: boolean
  assigned: boolean
  readonly: boolean
}) {
  const { employee, score, tier, reasons, warnings } = candidate

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      {/* Name + type */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 truncate">
            {employee.name}
          </span>
          <span
            className={[
              'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
              employee.employeeType === 'internal'
                ? 'bg-blue-50 border border-blue-100 text-blue-600'
                : 'bg-orange-50 border border-orange-100 text-orange-600',
            ].join(' ')}
          >
            {employee.employeeType === 'internal' ? 'Internal' : 'Temp'}
          </span>
          <TierBadge tier={tier} score={score} />
        </div>
        {/* Reason + warning pills */}
        {(reasons.length > 0 || warnings.length > 0) && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {reasons.map((r) => <ReasonPill key={r} text={r} />)}
            {warnings.map((w) => <WarningPill key={w} text={w} />)}
          </div>
        )}
      </div>

      {/* Assign button */}
      {!readonly && (
        <div className="shrink-0 pt-0.5">
          {assigned ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Assigned
            </span>
          ) : (
            <button
              onClick={() => onAssign(employee.id)}
              disabled={assigning}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-600 shadow-sm hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              {assigning ? (
                <>
                  <svg className="w-2.5 h-2.5 animate-spin" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25" />
                    <path d="M8.5 5a3.5 3.5 0 0 0-3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Assigning
                </>
              ) : 'Assign'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AiAssistPanel({ entry, readonly, departmentScope }: Props) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<PanelStatus>({ phase: 'idle' })
  const [, startTransition] = useTransition()

  // Per-candidate assignment state: employeeId → 'assigning' | 'done'
  const [assignStates, setAssignStates] = useState<Record<string, 'assigning' | 'done'>>({})

  // Smart-fill state
  const [fillState, setFillState] = useState<
    'idle' | 'filling' | 'done' | 'error'
  >('idle')
  const [fillResult, setFillResult] = useState<{ created: number; remaining: number } | null>(null)

  function handleToggle() {
    const nextOpen = !open
    setOpen(nextOpen)

    if (nextOpen && status.phase === 'idle') {
      setStatus({ phase: 'loading' })
      startTransition(async () => {
        const { result, error } = await getShiftRecommendationsAction(
          entry.template.id,
          entry.date,
        )
        if (error || !result) {
          setStatus({ phase: 'error', message: error ?? 'Unknown error' })
        } else {
          setStatus({ phase: 'loaded', result })
        }
      })
    }
  }

  function handleAssign(employeeId: string) {
    setAssignStates((prev) => ({ ...prev, [employeeId]: 'assigning' }))
    startTransition(async () => {
      const { error } = await assignCandidateAction(
        employeeId,
        entry.template.id,
        entry.date,
      )
      setAssignStates((prev) => ({
        ...prev,
        [employeeId]: error ? 'assigning' : 'done',  // keep 'assigning' look if error
      }))
      if (error) {
        // Surface inline but don't crash the panel
        console.warn('assignCandidateAction error:', error)
      }
    })
  }

  function handleSmartFill() {
    setFillState('filling')
    startTransition(async () => {
      const res = await autoFillShiftAction(
        entry.template.id,
        entry.date,
        entry.required,
        departmentScope,
      )
      if (res.error) {
        setFillState('error')
      } else {
        setFillState('done')
        setFillResult({ created: res.created, remaining: res.remaining })
      }
    })
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="mt-2">
      {/* Toggle button */}
      <button
        onClick={handleToggle}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
        aria-expanded={open}
      >
        {/* Sparkle icon */}
        <svg
          className="w-3.5 h-3.5 shrink-0"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M7 1.5 L7.6 4.9 L11 5.5 L7.6 6.1 L7 9.5 L6.4 6.1 L3 5.5 L6.4 4.9Z"
            fill="currentColor"
            opacity="0.9"
          />
          <path
            d="M11.5 9 L11.8 10.7 L13.5 11 L11.8 11.3 L11.5 13 L11.2 11.3 L9.5 11 L11.2 10.7Z"
            fill="currentColor"
            opacity="0.5"
          />
          <path
            d="M3 1.5 L3.2 2.8 L4.5 3 L3.2 3.2 L3 4.5 L2.8 3.2 L1.5 3 L2.8 2.8Z"
            fill="currentColor"
            opacity="0.5"
          />
        </svg>
        AI Assist
        {status.phase === 'loading' && (
          <svg className="w-3 h-3 animate-spin ml-0.5" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25" />
            <path d="M8.5 5a3.5 3.5 0 0 0-3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
        {status.phase !== 'loading' && (
          <svg
            className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
          >
            <path d="M2.5 4l2.5 2.5L7.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/30 overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-indigo-100/60 bg-white/60">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
              Recommendations
            </span>
            {status.phase === 'loaded' && (
              <span className="text-[10px] text-gray-400">
                {status.result.scored.length > 0
                  ? `${Math.min(status.result.scored.length, 5)} of ${status.result.scored.length} candidates`
                  : 'No eligible candidates'}
              </span>
            )}
            <div className="ml-auto text-[10px] font-medium text-red-500">
              {entry.open} open slot{entry.open !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="px-3 py-2">
            {/* Loading */}
            {status.phase === 'loading' && (
              <div className="space-y-2 py-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="h-3 w-32 rounded bg-gray-200" />
                    <div className="h-3 w-16 rounded bg-gray-100" />
                    <div className="h-3 w-24 rounded bg-gray-100" />
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {status.phase === 'error' && (
              <p className="text-xs text-red-500 py-1">{status.message}</p>
            )}

            {/* No candidates */}
            {status.phase === 'loaded' && status.result.scored.length === 0 && (
              <p className="text-xs text-gray-400 py-1">
                No eligible candidates found for this shift.
                {status.result.context.requiredSkillName
                  ? ` Requires skill: ${status.result.context.requiredSkillName}.`
                  : ''}
              </p>
            )}

            {/* Candidate rows */}
            {status.phase === 'loaded' && status.result.scored.length > 0 && (
              <>
                <div className="divide-y divide-gray-50">
                  {status.result.scored.slice(0, 5).map((c) => (
                    <CandidateRow
                      key={c.employee.id}
                      candidate={c}
                      onAssign={handleAssign}
                      assigning={assignStates[c.employee.id] === 'assigning'}
                      assigned={assignStates[c.employee.id] === 'done'}
                      readonly={readonly}
                    />
                  ))}
                </div>

                {/* Action strip */}
                {!readonly && (
                  <div className="mt-2 pt-2 border-t border-indigo-100/60 flex items-center gap-2 flex-wrap">
                    {/* Smart fill */}
                    {fillState === 'idle' && entry.open > 0 && (
                      <button
                        onClick={handleSmartFill}
                        className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Smart fill {entry.open > 1 ? `(${entry.open} slots)` : ''}
                      </button>
                    )}
                    {fillState === 'filling' && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                        <svg className="w-3 h-3 animate-spin" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                          <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25" />
                          <path d="M8.5 5a3.5 3.5 0 0 0-3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        Filling…
                      </span>
                    )}
                    {fillState === 'done' && fillResult && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {fillResult.created} assigned
                        {fillResult.remaining > 0 && (
                          <span className="font-normal text-gray-400 ml-1">
                            · {fillResult.remaining} still open
                          </span>
                        )}
                      </span>
                    )}
                    {fillState === 'error' && (
                      <span className="text-xs text-red-500">Fill failed — please try again.</span>
                    )}

                    {/* Reload button after fill to refresh recommendations */}
                    {(fillState === 'done' || Object.values(assignStates).some(v => v === 'done')) && (
                      <button
                        onClick={() => {
                          setStatus({ phase: 'loading' })
                          setAssignStates({})
                          setFillState('idle')
                          setFillResult(null)
                          startTransition(async () => {
                            const { result, error } = await getShiftRecommendationsAction(
                              entry.template.id,
                              entry.date,
                            )
                            if (error || !result) {
                              setStatus({ phase: 'error', message: error ?? 'Unknown error' })
                            } else {
                              setStatus({ phase: 'loaded', result })
                            }
                          })
                        }}
                        className="ml-auto text-[11px] text-gray-400 hover:text-gray-500 underline underline-offset-2 transition-colors"
                      >
                        Refresh
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
