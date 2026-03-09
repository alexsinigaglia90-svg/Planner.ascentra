'use client'

import { useEffect, useState, useTransition } from 'react'
import type { Employee } from '@/lib/queries/employees'
import {
  copyEmployeeScheduleAction,
  copyWeekScheduleAction,
  repeatPatternAction,
  copyEmployeeWeekAction,
} from '@/app/planning/actions'

type Tab = 'employee' | 'week' | 'repeat' | 'empweek'

const TABS: { value: Tab; label: string }[] = [
  { value: 'employee', label: 'Copy employee' },
  { value: 'week', label: 'Copy week' },
  { value: 'repeat', label: 'Repeat pattern' },
  { value: 'empweek', label: 'Employee week' },
]

interface Props {
  employees: Employee[]
}

export default function BulkActionsPanel({ employees }: Props) {
  const [tab, setTab] = useState<Tab>('employee')
  const [result, setResult] = useState<{ count?: number; error?: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  // Clear feedback when switching tabs
  useEffect(() => {
    setResult(null)
  }, [tab])

  function handleSubmit(
    action: (fd: FormData) => Promise<{ count?: number; error?: string }>
  ) {
    return (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      setResult(null)
      const fd = new FormData(e.currentTarget)
      startTransition(async () => {
        setResult(await action(fd))
      })
    }
  }

  if (employees.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-6 text-center">
        <p className="text-sm font-medium text-gray-600">No employees added yet</p>
        <p className="mt-1 text-xs text-gray-400">Add employees to use bulk scheduling tools.</p>
      </div>
    )
  }

  const inputCls =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-600 focus:outline-none bg-white'
  const labelCls = 'block text-xs font-medium text-gray-700 mb-1.5'

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Tab strip */}
      <div className="flex border-b border-gray-200 px-5 pt-4 gap-5">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={[
              'pb-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap',
              tab === t.value
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-600',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-5 py-5">
        {/* ── Copy employee ── */}
        {tab === 'employee' && (
          <form onSubmit={handleSubmit(copyEmployeeScheduleAction)} className="space-y-4">
            <p className="text-xs text-gray-400 leading-relaxed">
              Copy all shifts assigned to one employee to another, within a date range. Existing
              assignments on the target employee are skipped.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>From employee</label>
                <select name="sourceEmployeeId" required defaultValue="" className={inputCls}>
                  <option value="" disabled>Select</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>To employee</label>
                <select name="targetEmployeeId" required defaultValue="" className={inputCls}>
                  <option value="" disabled>Select</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>From date</label>
                <input type="date" name="startDate" required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>To date</label>
                <input type="date" name="endDate" required className={inputCls} />
              </div>
            </div>

            <ActionFooter result={result} isPending={isPending} label="Copy schedule" />
          </form>
        )}

        {/* ── Copy week ── */}
        {tab === 'week' && (
          <form onSubmit={handleSubmit(copyWeekScheduleAction)} className="space-y-4">
            <p className="text-xs text-gray-400 leading-relaxed">
              Copy every assignment from one week to another. All dates are shifted by the same
              offset. Missing roster days are created automatically.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Source week starts</label>
                <input type="date" name="sourceWeekStart" required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Target week starts</label>
                <input type="date" name="targetWeekStart" required className={inputCls} />
              </div>
            </div>

            <ActionFooter result={result} isPending={isPending} label="Copy week" />
          </form>
        )}

        {/* ── Repeat pattern ── */}
        {tab === 'repeat' && (
          <form onSubmit={handleSubmit(repeatPatternAction)} className="space-y-4">
            <p className="text-xs text-gray-400 leading-relaxed">
              Take a date range&apos;s full schedule and repeat it forward N times, one week at a time.
              Useful for rolling out recurring patterns quickly.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Pattern start</label>
                <input type="date" name="startDate" required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Pattern end</label>
                <input type="date" name="endDate" required className={inputCls} />
              </div>
            </div>

            <div className="flex items-end gap-4">
              <div className="w-28">
                <label className={labelCls}>Repeat for</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    name="weeks"
                    min={1}
                    max={52}
                    defaultValue={1}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-600 focus:outline-none tabular-nums"
                  />
                  <span className="text-sm text-gray-500 whitespace-nowrap">weeks</span>
                </div>
              </div>
            </div>

            <ActionFooter result={result} isPending={isPending} label="Repeat pattern" />
          </form>
        )}

        {/* ── Employee week copy ── */}
        {tab === 'empweek' && (
          <form onSubmit={handleSubmit(copyEmployeeWeekAction)} className="space-y-4">
            <p className="text-xs text-gray-400 leading-relaxed">
              Copy one employee&apos;s assignments from a source week to a target week. Existing
              assignments in the target week are skipped.
            </p>

            <div>
              <label className={labelCls}>Employee</label>
              <select name="employeeId" required defaultValue="" className={inputCls}>
                <option value="" disabled>Select</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Source week starts</label>
                <input type="date" name="sourceWeekStart" required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Target week starts</label>
                <input type="date" name="targetWeekStart" required className={inputCls} />
              </div>
            </div>

            <ActionFooter result={result} isPending={isPending} label="Copy week" />
          </form>
        )}
      </div>
    </div>
  )
}

function ActionFooter({
  result,
  isPending,
  label,
}: {
  result: { count?: number; error?: string } | null
  isPending: boolean
  label: string
}) {
  return (
    <div className="flex items-center gap-4 pt-1">
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
      >
        {isPending ? 'Working…' : label}
      </button>
      {result && !result.error && (
        <span className="text-xs font-medium text-green-700">
          {result.count === 0
            ? 'No new assignments — all already existed.'
            : `${result.count} assignment${result.count === 1 ? '' : 's'} created.`}
        </span>
      )}
      {result?.error && (
        <span className="text-xs font-medium text-red-600">{result.error}</span>
      )}
    </div>
  )
}
