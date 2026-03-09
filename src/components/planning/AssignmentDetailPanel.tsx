'use client'

import { useState, useTransition, useEffect } from 'react'
import type { ShiftTemplate } from '@prisma/client'
import type { AssignmentWithRelations } from '@/lib/queries/assignments'
import type { AuditLog } from '@/lib/queries/auditLog'
import { deleteAssignmentAction, updateAssignmentAction } from '@/app/planning/actions'
import { getAssignmentHistoryAction } from '@/app/audit/actions'

interface Props {
  assignment: AssignmentWithRelations
  templates: ShiftTemplate[]
  onClose: () => void
  onDeleted: () => void
  onUpdated: () => void
  readonly?: boolean
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function AssignmentDetailPanel({ assignment, templates, onClose, onDeleted, onUpdated, readonly }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftTemplateId, setDraftTemplateId] = useState(assignment.shiftTemplateId)
  const [draftNotes, setDraftNotes] = useState(assignment.notes ?? '')
  const [editError, setEditError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [history, setHistory] = useState<AuditLog[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setHistory(null)
    setHistoryLoading(true)
    getAssignmentHistoryAction(assignment.id).then((logs) => {
      if (!cancelled) { setHistory(logs); setHistoryLoading(false) }
    }).catch(() => { if (!cancelled) setHistoryLoading(false) })
    return () => { cancelled = true }
  }, [assignment.id])

  const emp = assignment.employee
  const tpl = assignment.shiftTemplate
  const typeBadge =
    emp.employeeType === 'internal' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'

  const selectedTemplate = templates.find((t) => t.id === draftTemplateId) ?? tpl

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteAssignmentAction(assignment.id)
      if (result.error) {
        setEditError(result.error)
        setConfirming(false)
      } else {
        onDeleted()
      }
    })
  }

  function startEditing() {
    setDraftTemplateId(assignment.shiftTemplateId)
    setDraftNotes(assignment.notes ?? '')
    setEditError(null)
    setConfirming(false)
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
    setEditError(null)
  }

  function handleSave() {
    setEditError(null)
    startTransition(async () => {
      const result = await updateAssignmentAction(
        assignment.id,
        draftTemplateId,
        draftNotes.trim() || null
      )
      if (result.error) {
        setEditError(result.error)
      } else {
        setEditing(false)
        onUpdated()
      }
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1.5">
            Assignment
          </p>
          <h2 className="text-base font-semibold text-gray-900 leading-tight">{emp.name}</h2>
          <div className="mt-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${typeBadge}`}>
              {emp.employeeType}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="mt-0.5 shrink-0 rounded-md p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {!editing ? (
          /* ── View mode ── */
          <dl className="space-y-6">
            <div>
              <dt className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Date</dt>
              <dd className="text-sm text-gray-900">{formatDisplayDate(assignment.rosterDay.date)}</dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Shift</dt>
              <dd className="text-sm font-semibold text-gray-900">{tpl.name}</dd>
            </div>

            <div className="flex gap-8">
              <div>
                <dt className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Start</dt>
                <dd className="text-sm text-gray-900 tabular-nums font-medium">{tpl.startTime}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">End</dt>
                <dd className="text-sm text-gray-900 tabular-nums font-medium">{tpl.endTime}</dd>
              </div>
            </div>

            {assignment.notes && (
              <div>
                <dt className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Notes</dt>
                <dd className="text-sm text-gray-700 leading-relaxed">{assignment.notes}</dd>
              </div>
            )}

            {/* History */}
            <div>
              <dt className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">History</dt>
              {historyLoading && (
                <p className="text-xs text-gray-400">Loading&hellip;</p>
              )}
              {!historyLoading && history !== null && history.length === 0 && (
                <p className="text-xs text-gray-400">No changes recorded yet</p>
              )}
              {!historyLoading && history && history.length > 0 && (
                <div className="-mx-1 space-y-0.5">
                  {history.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 rounded px-2 py-1.5">
                      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
                      <div className="min-w-0">
                        <p className="text-xs text-gray-700 leading-snug">{log.summary}</p>
                        <p className="text-[11px] text-gray-400 tabular-nums mt-0.5">
                          {new Date(log.createdAt).toLocaleString('en-GB', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit', hour12: false,
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {readonly ? (
              <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                <svg className="w-3.5 h-3.5 shrink-0 text-gray-400" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <rect x="3" y="6" width="8" height="7" rx="1" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M5 6V4a2 2 0 0 1 4 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                <span className="text-xs text-gray-400">Read-only view</span>
              </div>
            ) : (
            <button
              type="button"
              onClick={startEditing}
              className="flex items-center gap-2.5 w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
            >
              <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Edit assignment
            </button>
            )}
          </dl>
        ) : (
          /* ── Edit mode ── */
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Date</p>
              <p className="text-sm text-gray-900">{formatDisplayDate(assignment.rosterDay.date)}</p>
            </div>

            <div>
              <label
                htmlFor="edit-template"
                className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5"
              >
                Shift
              </label>
              <select
                id="edit-template"
                value={draftTemplateId}
                onChange={(e) => setDraftTemplateId(e.target.value)}
                disabled={isPending}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors disabled:opacity-60"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.startTime}–{t.endTime})
                  </option>
                ))}
              </select>
              {draftTemplateId !== assignment.shiftTemplateId && selectedTemplate && (
                <p className="mt-1.5 text-xs text-gray-400 tabular-nums">
                  {selectedTemplate.startTime} – {selectedTemplate.endTime}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="edit-notes"
                className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5"
              >
                Notes
              </label>
              <textarea
                id="edit-notes"
                value={draftNotes}
                onChange={(e) => setDraftNotes(e.target.value)}
                rows={3}
                placeholder="Optional notes…"
                disabled={isPending}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors resize-none disabled:opacity-60"
              />
            </div>

            {editError && (
              <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
                {editError}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="flex-1 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors duration-150"
              >
                {isPending ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                disabled={isPending}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-colors duration-150"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete footer — hidden while editing or for viewers */}
      {!editing && !readonly && (
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/40">
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
            >
              Remove assignment
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">Remove this assignment?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Removing…' : 'Remove'}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={isPending}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
