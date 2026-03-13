'use client'

import { useRef, useState, useTransition } from 'react'
import { createEmployeeAction } from '@/app/employees/actions'
import { Button } from '@/components/ui'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
const WEEKDAY_LABELS: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
}

interface NamedItem { id: string; name: string }

interface Props {
  departments?: NamedItem[]
  functions?: (NamedItem & { overhead: boolean })[]
}

export default function EmployeeForm({ departments = [], functions = [] }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [selectedDays, setSelectedDays] = useState<string[]>([])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await createEmployeeAction(formData)
      formRef.current?.reset()
      setSelectedDays([])
    })
  }

  return (
    <div className="ds-card p-6">
      <h2 className="text-base font-semibold text-[#0B0B0C] mb-4">Add employee</h2>
      <form ref={formRef} onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="ds-label" htmlFor="name">Name</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="ds-input"
            placeholder="Jane Doe"
          />
        </div>

        <div>
          <label className="ds-label" htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="ds-input"
            placeholder="jane@example.com"
          />
        </div>

        <div>
          <label className="ds-label" htmlFor="employeeType">Type</label>
          <select
            id="employeeType"
            name="employeeType"
            required
            defaultValue="internal"
            className="ds-input"
          >
            <option value="internal">Internal</option>
            <option value="temp">Temporary</option>
          </select>
        </div>

        <div>
          <label className="ds-label" htmlFor="contractHours">Contract hours / week</label>
          <input
            id="contractHours"
            name="contractHours"
            type="number"
            required
            min={0}
            max={168}
            step={0.5}
            defaultValue={40}
            className="ds-input"
          />
        </div>

        <div>
          <label className="ds-label" htmlFor="status">Status</label>
          <select
            id="status"
            name="status"
            required
            defaultValue="active"
            className="ds-input"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {departments.length > 0 && (
          <div>
            <label className="ds-label" htmlFor="mainDepartmentId">Main department</label>
            <select
              id="mainDepartmentId"
              name="mainDepartmentId"
              defaultValue=""
              className="ds-input"
            >
              <option value="">Unassigned department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        {functions.length > 0 && (
          <div>
            <label className="ds-label" htmlFor="functionId">Function</label>
            <select
              id="functionId"
              name="functionId"
              defaultValue=""
              className="ds-input"
            >
              <option value="">Unassigned function</option>
              {functions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}{f.overhead ? ' (overhead)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="sm:col-span-2">
          <label className="ds-label">Fixed working days</label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {WEEKDAYS.map((day) => {
              const active = selectedDays.includes(day)
              return (
                <label
                  key={day}
                  className={[
                    'inline-flex items-center cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors select-none',
                    active
                      ? 'bg-teal-100 text-teal-800 ring-1 ring-teal-400'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    name="fixedWorkingDays"
                    value={day}
                    checked={active}
                    onChange={(e) =>
                      setSelectedDays((prev) =>
                        e.target.checked ? [...prev, day] : prev.filter((d) => d !== day),
                      )
                    }
                    className="sr-only"
                  />
                  {WEEKDAY_LABELS[day]}
                </label>
              )
            })}
          </div>
        </div>

        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : 'Add employee'}
          </Button>
        </div>
      </form>
    </div>
  )
}
