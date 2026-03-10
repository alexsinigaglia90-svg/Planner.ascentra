'use client'

import { useRef, useState, useTransition } from 'react'
import type { Employee } from '@/lib/queries/employees'
import type { ShiftTemplate } from '@/lib/queries/shiftTemplates'
import { createAssignmentAction } from '@/app/planning/actions'

interface Props {
  employees: Employee[]
  templates: ShiftTemplate[]
}

export default function AssignmentForm({ employees, templates }: Props) {
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
        formRef.current?.reset()
      }
    })
  }

  const disabled = isPending || employees.length === 0 || templates.length === 0

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Assign employee</h2>
      <form ref={formRef} onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="date">
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="employeeId">
            Employee
          </label>
          <select
            id="employeeId"
            name="employeeId"
            required
            defaultValue=""
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
          >
            <option value="" disabled>Select an employee</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="shiftTemplateId">
            Shift
          </label>
          <select
            id="shiftTemplateId"
            name="shiftTemplateId"
            required
            defaultValue=""
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
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
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="notes">
            Notes <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id="notes"
            name="notes"
            type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none"
            placeholder="e.g. first day back"
          />
        </div>

        {error && (
          <div className="sm:col-span-2 rounded-md bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {warning && (
          <div className="sm:col-span-2 rounded-md bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-sm font-medium text-amber-800">Rotation conflict</p>
            <p className="text-xs text-amber-700 mt-0.5">{warning}</p>
          </div>
        )}

        <div className="sm:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={disabled}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Saving…' : 'Assign'}
          </button>
        </div>
      </form>
    </div>
  )
}
