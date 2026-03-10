'use client'

import { useRef, useState, useTransition } from 'react'
import type { Employee } from '@/lib/queries/employees'
import type { ShiftTemplate } from '@/lib/queries/shiftTemplates'
import { createAssignmentAction } from '@/app/planning/actions'

interface Props {
  employee: Employee
  date: string
  templates: ShiftTemplate[]
  onClose: () => void
  onSuccess: () => void
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function QuickAddPanel({ employee, date, templates, onClose, onSuccess }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setWarning(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createAssignmentAction(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        if (result?.warning) setWarning(result.warning)
        onSuccess()
      }
    })
  }

  const typeBadge =
    employee.employeeType === 'internal' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1.5">
            Assign shift
          </p>
          <h2 className="text-base font-semibold text-gray-900 leading-tight">{employee.name}</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${typeBadge}`}>
              {employee.employeeType}
            </span>
            <span className="text-sm text-gray-500">{formatDisplayDate(date)}</span>
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

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {templates.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-5 text-center">
            <p className="text-sm font-medium text-gray-600">All shifts assigned</p>
            <p className="text-xs text-gray-400 mt-1">
              Every available shift template is already assigned to this employee on this day.
            </p>
            <button
              onClick={onClose}
              className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
            <input type="hidden" name="employeeId" value={employee.id} />
            <input type="hidden" name="date" value={date} />

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {warning && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                <p className="text-sm font-medium text-amber-800">Rotation conflict</p>
                <p className="text-xs text-amber-700 mt-0.5">{warning}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5" htmlFor="qa-shift">
                Shift
              </label>
              <select
                id="qa-shift"
                name="shiftTemplateId"
                required
                defaultValue=""
                onChange={() => setError(null)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors"
              >
                <option value="" disabled>Select a shift</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.startTime}–{t.endTime})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5" htmlFor="qa-notes">
                Notes{' '}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="qa-notes"
                name="notes"
                rows={3}
                placeholder="Any notes for this assignment…"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors resize-none"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors duration-150 disabled:opacity-50"
              >
                {isPending ? 'Saving…' : 'Add assignment'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors duration-150"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
