'use client'

import { useRef, useTransition } from 'react'
import { createShiftTemplateAction } from '@/app/shifts/actions'

export default function ShiftTemplateForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await createShiftTemplateAction(formData)
      formRef.current?.reset()
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Add shift template</h2>
      <form ref={formRef} onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none"
            placeholder="e.g. Morning shift"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="startTime">
            Start time
          </label>
          <input
            id="startTime"
            name="startTime"
            type="time"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="endTime">
            End time
          </label>
          <input
            id="endTime"
            name="endTime"
            type="time"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="requiredEmployees">
            Required staff
          </label>
          <input
            id="requiredEmployees"
            name="requiredEmployees"
            type="number"
            required
            min={1}
            defaultValue={1}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div className="sm:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Saving…' : 'Add template'}
          </button>
        </div>
      </form>
    </div>
  )
}
