'use client'

import { useRef, useState, useTransition } from 'react'
import type { RosterDay } from '@/lib/queries/rosterDays'
import { copyDayAction } from '@/app/planning/actions'

export default function CopyDayForm({ rosterDays }: { rosterDays: RosterDay[] }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await copyDayAction(formData)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        formRef.current?.reset()
        setTimeout(() => setSuccess(false), 3000)
      }
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-1">Copy day</h2>
      <p className="text-xs text-gray-500 mb-4">Copy all assignments from one day to another.</p>
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="sourceDate">
            Copy from
          </label>
          <input
            id="sourceDate"
            name="sourceDate"
            type="date"
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div className="text-gray-400 pb-2 text-sm select-none">→</div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="targetDate">
            Copy to
          </label>
          <input
            id="targetDate"
            name="targetDate"
            type="date"
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={isPending || rosterDays.length === 0}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Copying…' : 'Copy'}
        </button>
      </form>
      {error && (
        <p className="mt-3 text-xs font-medium text-red-600">{error}</p>
      )}
      {success && (
        <p className="mt-3 text-xs font-medium text-green-700">Day copied successfully.</p>
      )}
    </div>
  )
}
