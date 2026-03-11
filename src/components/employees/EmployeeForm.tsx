'use client'

import { useRef, useTransition } from 'react'
import { createEmployeeAction } from '@/app/employees/actions'

interface NamedItem { id: string; name: string }

interface Props {
  departments?: NamedItem[]
  functions?: (NamedItem & { overhead: boolean })[]
}

export default function EmployeeForm({ departments = [], functions = [] }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await createEmployeeAction(formData)
      formRef.current?.reset()
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Add employee</h2>
      <form ref={formRef} onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none"
            placeholder="Jane Doe"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none"
            placeholder="jane@example.com"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="employeeType">
            Type
          </label>
          <select
            id="employeeType"
            name="employeeType"
            required
            defaultValue="internal"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
          >
            <option value="internal">Internal</option>
            <option value="temp">Temporary</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="contractHours">
            Contract hours / week
          </label>
          <input
            id="contractHours"
            name="contractHours"
            type="number"
            required
            min={0}
            max={168}
            step={0.5}
            defaultValue={40}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            required
            defaultValue="active"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {departments.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="mainDepartmentId">
              Main department
            </label>
            <select
              id="mainDepartmentId"
              name="mainDepartmentId"
              defaultValue=""
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
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
            <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="functionId">
              Function
            </label>
            <select
              id="functionId"
              name="functionId"
              defaultValue=""
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
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

        <div className="sm:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Saving…' : 'Add employee'}
          </button>
        </div>
      </form>
    </div>
  )
}
