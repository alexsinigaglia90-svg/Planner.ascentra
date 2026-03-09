'use client'

import { useRef, useTransition } from 'react'
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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await createAssignmentAction(formData)
      formRef.current?.reset()
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
