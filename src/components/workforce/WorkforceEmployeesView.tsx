'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { EmployeeWithContext } from '@/lib/queries/employees'
import type { TeamSummary } from '@/lib/queries/teams'
import type { Department } from '@/lib/queries/locations'
import type { EmployeeFunction } from '@/lib/queries/functions'
import {
  createWorkforceEmployeeAction,
  setWorkforceEmployeeTeamAction,
  setWorkforceEmployeeFunctionAction,
  setWorkforceEmployeeDepartmentAction,
  deleteEmployeeAction,
  bulkDeleteEmployeesAction,
  bulkSetTeamAction,
  bulkSetStatusAction,
  getEmployeeProcessDataAction,
} from '@/app/workforce/employees/actions'
import type { ProcessRow, EmployeeProcessScoreRow } from '@/lib/queries/processes'
import { CapabilityRing, LEVEL_COLORS, LEVEL_LABELS } from './CapabilityRing'
import BulkImportModal from '@/components/workforce/BulkImportModal'
import { Avatar, StatusBadge, Th } from '@/components/ui'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-gray-100 text-gray-500',
}

const STATUS_DOT: Record<string, string> = {
  active: 'bg-emerald-400',
  inactive: 'bg-gray-400',
}

const TYPE_LABELS: Record<string, string> = {
  internal: 'Internal',
  temp: 'Temporary',
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ─── Close icon ───────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M1 1L11 11M11 1L1 11"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 4h12M5 4V2.5A1.5 1.5 0 0 1 6.5 1h3A1.5 1.5 0 0 1 11 2.5V4m2 0v9.5A1.5 1.5 0 0 1 11.5 15h-7A1.5 1.5 0 0 1 3 13.5V4h10Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Delete',
  isDangerous = true,
  isPending,
  onConfirm,
  onCancel,
}: {
  title: string
  description: ReactNode
  confirmLabel?: string
  isDangerous?: boolean
  isPending?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-gray-900 mb-2">{title}</h3>
        <div className="text-sm text-gray-500 mb-5 leading-relaxed">{description}</div>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
              isDangerous ? 'bg-red-600 hover:bg-red-500' : 'bg-gray-900 hover:bg-gray-700'
            }`}
          >
            {isPending ? 'Working…' : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Slide Panel wrapper ───────────────────────────────────────────────────────

function SlidePanel({
  onClose,
  width = 'w-[440px]',
  children,
}: {
  onClose: () => void
  width?: string
  children: React.ReactNode
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/25 backdrop-blur-sm transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`fixed inset-y-0 right-0 z-40 ${width} max-w-full bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {children}
      </div>
    </>
  )
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function EmployeeDetailPanel({
  employee,
  teams,
  departments,
  functions,
  canEdit,
  onClose,
  onTeamChange,
  onFunctionChange,
  onDepartmentChange,
}: {
  employee: EmployeeWithContext
  teams: TeamSummary[]
  departments: Department[]
  functions: EmployeeFunction[]
  canEdit: boolean
  onClose: () => void
  onTeamChange: (emp: EmployeeWithContext, teamId: string | null) => void
  onFunctionChange: (emp: EmployeeWithContext, functionId: string | null) => void
  onDepartmentChange: (emp: EmployeeWithContext, departmentId: string | null) => void
}) {
  const [teamValue, setTeamValue] = useState(employee.teamId ?? '')
  const [teamError, setTeamError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [deptValue, setDeptValue] = useState(employee.departmentId ?? '')
  const [deptError, setDeptError] = useState<string | null>(null)
  const [isDeptPending, startDeptTransition] = useTransition()
  const [fnValue, setFnValue] = useState(employee.functionId ?? '')
  const [fnError, setFnError] = useState<string | null>(null)
  const [isFnPending, startFnTransition] = useTransition()

  const [processes, setProcesses] = useState<ProcessRow[]>([])
  const [scores, setScores] = useState<EmployeeProcessScoreRow[]>([])
  const [scoresReady, setScoresReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    getEmployeeProcessDataAction(employee.id).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setProcesses(result.processes)
        setScores(result.scores)
      }
      setScoresReady(true)
    })
    return () => { cancelled = true }
  }, [employee.id])

  const ini = getInitials(employee.name)

  function handleTeamChange(newValue: string) {
    const newId = newValue || null
    const prev = teamValue
    setTeamValue(newValue)
    setTeamError(null)
    startTransition(async () => {
      const result = await setWorkforceEmployeeTeamAction(employee.id, newId)
      if (!result.ok) {
        setTeamError(result.error)
        setTeamValue(prev)
      } else {
        onTeamChange(employee, newId)
      }
    })
  }

  function handleDeptChange(newValue: string) {
    const newId = newValue || null
    const prev = deptValue
    setDeptValue(newValue)
    setDeptError(null)
    startDeptTransition(async () => {
      const result = await setWorkforceEmployeeDepartmentAction(employee.id, newId)
      if (!result.ok) {
        setDeptError(result.error)
        setDeptValue(prev)
      } else {
        onDepartmentChange(employee, newId)
      }
    })
  }

  function handleFnChange(newValue: string) {
    const newId = newValue || null
    const prev = fnValue
    setFnValue(newValue)
    setFnError(null)
    startFnTransition(async () => {
      const result = await setWorkforceEmployeeFunctionAction(employee.id, newId)
      if (!result.ok) {
        setFnError(result.error)
        setFnValue(prev)
      } else {
        onFunctionChange(employee, newId)
      }
    })
  }

  const currentTeam = teams.find((t) => t.id === teamValue) ?? null
  const currentFn = functions.find((f) => f.id === fnValue) ?? null

  return (
    <SlidePanel onClose={onClose}>
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-5 border-b border-gray-100">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white select-none">
            {ini}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h2 className="text-[15px] font-semibold text-gray-900 leading-snug truncate">
              {employee.name}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5 truncate">{employee.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 mt-0.5 flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 mt-3.5 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[employee.status] ?? 'bg-gray-100 text-gray-600'}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[employee.status] ?? 'bg-gray-400'}`}
            />
            <span className="capitalize">{employee.status}</span>
          </span>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            {TYPE_LABELS[employee.employeeType] ?? employee.employeeType}
          </span>
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
            {employee.contractHours}h / week
          </span>
          {(currentFn?.overhead ?? employee.employeeFunction?.overhead) && (
            <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-600">
              Overhead
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Organisation section */}
        <div className="px-6 py-5 border-b border-gray-100">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Organisation
          </p>
          <dl className="space-y-3.5">
            <div className="flex items-start gap-4">
              <dt className="w-24 shrink-0 text-sm text-gray-500 pt-0.5">Team</dt>
              <dd className="flex-1 min-w-0">
                {canEdit ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <select
                        value={teamValue}
                        onChange={(e) => handleTeamChange(e.target.value)}
                        disabled={isPending}
                        className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none disabled:opacity-60 transition-colors"
                      >
                        <option value="">No team</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      {isPending && (
                        <span className="text-xs text-gray-400 whitespace-nowrap">Saving…</span>
                      )}
                    </div>
                    {teamError && (
                      <p className="text-xs text-red-600 mt-1.5">{teamError}</p>
                    )}
                  </div>
                ) : currentTeam ? (
                  <div className="flex items-center gap-1.5">
                    {currentTeam.color && (
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: currentTeam.color }}
                      />
                    )}
                    <span className="text-sm text-gray-900">{currentTeam.name}</span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">—</span>
                )}
              </dd>
            </div>

            <div className="flex items-start gap-4">
              <dt className="w-24 shrink-0 text-sm text-gray-500">Location</dt>
              <dd className="text-sm text-gray-900">
                {employee.location?.name ?? <span className="text-gray-400">—</span>}
              </dd>
            </div>

            <div className="flex items-start gap-4">
              <dt className="w-24 shrink-0 text-sm text-gray-500 pt-1.5">Department</dt>
              <dd className="flex-1 min-w-0">
                {canEdit && departments.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <select
                        value={deptValue}
                        onChange={(e) => handleDeptChange(e.target.value)}
                        disabled={isDeptPending}
                        className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none disabled:opacity-60 transition-colors"
                      >
                        <option value="">Unassigned department</option>
                        {/* Show archived legacy value as a disabled option if not in active list */}
                        {deptValue && !departments.find((d) => d.id === deptValue) && employee.department && (
                          <option value={deptValue} disabled>
                            {employee.department.name} (Archived)
                          </option>
                        )}
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                      {isDeptPending && (
                        <span className="text-xs text-gray-400 whitespace-nowrap">Saving…</span>
                      )}
                    </div>
                    {deptError && <p className="text-xs text-red-600 mt-1.5">{deptError}</p>}
                  </div>
                ) : (
                  <span className="text-sm text-gray-900">
                    {employee.department?.name ?? <span className="text-gray-400">Unassigned department</span>}
                  </span>
                )}
              </dd>
            </div>

            <div className="flex items-start gap-4">
              <dt className="w-24 shrink-0 text-sm text-gray-500 pt-1.5">Function</dt>
              <dd className="flex-1 min-w-0">
                {canEdit && functions.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <select
                        value={fnValue}
                        onChange={(e) => handleFnChange(e.target.value)}
                        disabled={isFnPending}
                        className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none disabled:opacity-60 transition-colors"
                      >
                        <option value="">Unassigned function</option>
                        {/* Show archived legacy value as a disabled option if not in active list */}
                        {fnValue && !functions.find((f) => f.id === fnValue) && employee.employeeFunction && (
                          <option value={fnValue} disabled>
                            {employee.employeeFunction.name} (Archived)
                          </option>
                        )}
                        {functions.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}{f.overhead ? ' (overhead)' : ''}
                          </option>
                        ))}
                      </select>
                      {isFnPending && (
                        <span className="text-xs text-gray-400 whitespace-nowrap">Saving…</span>
                      )}
                    </div>
                    {fnError && <p className="text-xs text-red-600 mt-1.5">{fnError}</p>}
                  </div>
                ) : (
                  <span className="text-sm text-gray-900">
                    {employee.employeeFunction
                      ? employee.employeeFunction.name
                      : <span className="text-gray-400">Unassigned function</span>}
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        {/* Capabilities section */}
        {scoresReady && processes.length > 0 && (
          <div className="px-6 py-5 border-b border-gray-100">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Capabilities
            </p>
            <div className="space-y-3">
              {processes.map((proc) => {
                const lv = scores.find((s) => s.processId === proc.id)?.level ?? 0
                const color = LEVEL_COLORS[lv] ?? '#d1d5db'
                const label = LEVEL_LABELS[lv] ?? 'Unknown'
                return (
                  <div key={proc.id} className="flex items-center gap-3">
                    <CapabilityRing level={lv} size={40} strokeWidth={3} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-800 block truncate">{proc.name}</span>
                      <span className="text-[11px] font-medium" style={{ color: lv === 0 ? '#9ca3af' : color }}>
                        {label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* System section */}
        <div className="px-6 py-5">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">
            System
          </p>
          <dl className="space-y-3.5">
            <div className="flex items-start gap-4">
              <dt className="w-24 shrink-0 text-sm text-gray-500">Added</dt>
              <dd className="text-sm text-gray-900">{formatDate(employee.createdAt)}</dd>
            </div>
            <div className="flex items-start gap-4">
              <dt className="w-24 shrink-0 text-sm text-gray-500">ID</dt>
              <dd className="text-[11px] text-gray-400 font-mono pt-[2px] truncate">
                {employee.id}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </SlidePanel>
  )
}

// ─── Add Employee Panel ───────────────────────────────────────────────────────

function AddEmployeePanel({
  teams,
  departments,
  functions,
  onClose,
  onCreated,
}: {
  teams: TeamSummary[]
  departments: Department[]
  functions: EmployeeFunction[]
  onClose: () => void
  onCreated: (result: Awaited<ReturnType<typeof createWorkforceEmployeeAction>>) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createWorkforceEmployeeAction(formData)
      if (!result.ok) {
        setError(result.error)
      } else {
        onCreated(result)
      }
    })
  }

  return (
    <SlidePanel onClose={onClose} width="w-[420px]">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-5 border-b border-gray-100">
        <div>
          <h2 className="text-[15px] font-semibold text-gray-900">New employee</h2>
          <p className="text-xs text-gray-500 mt-0.5">Fill in the details below</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          aria-label="Close"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5" htmlFor="add-name">
              Full name <span className="text-red-400">*</span>
            </label>
            <input
              id="add-name"
              name="name"
              type="text"
              required
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
              placeholder="Jane Doe"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5" htmlFor="add-email">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              id="add-email"
              name="email"
              type="email"
              required
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
              placeholder="jane@example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5" htmlFor="add-type">
                Type
              </label>
              <select
                id="add-type"
                name="employeeType"
                required
                defaultValue="internal"
                className="w-full rounded-md border border-gray-200 px-2.5 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
              >
                <option value="internal">Internal</option>
                <option value="temp">Temporary</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5" htmlFor="add-status">
                Status
              </label>
              <select
                id="add-status"
                name="status"
                required
                defaultValue="active"
                className="w-full rounded-md border border-gray-200 px-2.5 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5" htmlFor="add-hours">
              Contract hours / week
            </label>
            <input
              id="add-hours"
              name="contractHours"
              type="number"
              required
              min={0}
              max={168}
              step={0.5}
              defaultValue={40}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
            />
          </div>

          {departments.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5" htmlFor="add-dept">
                Main department
              </label>
              <select
                id="add-dept"
                name="mainDepartmentId"
                defaultValue=""
                className="w-full rounded-md border border-gray-200 px-2.5 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
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
              <label className="block text-xs font-medium text-gray-600 mb-1.5" htmlFor="add-fn">
                Function
              </label>
              <select
                id="add-fn"
                name="functionId"
                defaultValue=""
                className="w-full rounded-md border border-gray-200 px-2.5 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
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

          {teams.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5" htmlFor="add-team">
                Team
              </label>
              <select
                id="add-team"
                name="teamId"
                defaultValue=""
                className="w-full rounded-md border border-gray-200 px-2.5 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
              >
                <option value="">No team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex gap-2.5 px-6 py-4 border-t border-gray-100">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Creating…' : 'Create employee'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </SlidePanel>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

interface Props {
  employees: EmployeeWithContext[]
  teams: TeamSummary[]
  departments: Department[]
  functions: EmployeeFunction[]
  canEdit: boolean
}

type PanelState =
  | { type: 'detail'; employee: EmployeeWithContext }
  | { type: 'add' }
  | null

export default function WorkforceEmployeesView({
  employees: initialEmployees,
  teams,
  departments,
  functions,
  canEdit,
}: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [panel, setPanel] = useState<PanelState>(null)
  const [employees, setEmployees] = useState(initialEmployees)
  const [showImport, setShowImport] = useState(false)

  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'internal' | 'temp'>('all')
  const [deptFilter, setDeptFilter] = useState('')
  const [fnFilter, setFnFilter] = useState('')
  const [overheadFilter, setOverheadFilter] = useState<'all' | 'direct' | 'overhead'>('all')
  const hasOverheadFns = functions.some((f) => f.overhead)

  // Row selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Confirmation dialog
  const [confirmDelete, setConfirmDelete] = useState<
    | { mode: 'single'; employee: EmployeeWithContext }
    | { mode: 'bulk' }
    | null
  >(null)

  // Toast feedback
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Bulk operation transition
  const [isBulkPending, startBulkTransition] = useTransition()

  // Dropdown open state
  const [bulkTeamOpen, setBulkTeamOpen] = useState(false)
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false)

  // Sync local list when the server component re-renders with fresh data (after router.refresh())
  useEffect(() => {
    setEmployees(initialEmployees)
  }, [initialEmployees])

  const filtered = employees.filter((e) => {
    if (!e.name.toLowerCase().includes(search.toLowerCase())) return false
    if (typeFilter !== 'all' && e.employeeType !== typeFilter) return false
    if (deptFilter && e.departmentId !== deptFilter) return false
    if (fnFilter && e.functionId !== fnFilter) return false
    if (overheadFilter === 'direct' && e.employeeFunction?.overhead === true) return false
    if (overheadFilter === 'overhead' && e.employeeFunction?.overhead !== true) return false
    return true
  })

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((e) => selectedIds.has(e.id))
  const someSelected = selectedIds.size > 0

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Selection ─────────────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((e) => e.id)))
    }
  }

  function clearSelection() {
    setSelectedIds(new Set())
    setBulkTeamOpen(false)
    setBulkStatusOpen(false)
  }

  // ── Existing handlers ─────────────────────────────────────────────────────
  function handleTeamChange(emp: EmployeeWithContext, teamId: string | null) {
    const team = teams.find((t) => t.id === teamId) ?? null
    const updated: EmployeeWithContext = {
      ...emp,
      teamId,
      team: team
        ? {
            id: team.id,
            name: team.name,
            color: team.color,
            rotationAnchorDate: team.rotationAnchorDate,
            rotationLength: team.rotationLength,
            rotationSlots: [],
          }
        : null,
    }
    setEmployees((prev) => prev.map((e) => (e.id === emp.id ? updated : e)))
    if (panel?.type === 'detail' && panel.employee.id === emp.id) {
      setPanel({ type: 'detail', employee: updated })
    }
  }

  function handleFunctionChange(emp: EmployeeWithContext, functionId: string | null) {
    const fn = functionId ? (functions.find((f) => f.id === functionId) ?? null) : null
    const updated: EmployeeWithContext = {
      ...emp,
      functionId,
      employeeFunction: fn ? { id: fn.id, name: fn.name, overhead: fn.overhead } : null,
    }
    setEmployees((prev) => prev.map((e) => (e.id === emp.id ? updated : e)))
    if (panel?.type === 'detail' && panel.employee.id === emp.id) {
      setPanel({ type: 'detail', employee: updated })
    }
  }

  function handleDepartmentChange(emp: EmployeeWithContext, departmentId: string | null) {
    const dept = departmentId ? (departments.find((d) => d.id === departmentId) ?? null) : null
    const updated: EmployeeWithContext = {
      ...emp,
      departmentId,
      department: dept ? { id: dept.id, name: dept.name } : null,
    }
    setEmployees((prev) => prev.map((e) => (e.id === emp.id ? updated : e)))
    if (panel?.type === 'detail' && panel.employee.id === emp.id) {
      setPanel({ type: 'detail', employee: updated })
    }
  }

  function handleCreated(result: Awaited<ReturnType<typeof createWorkforceEmployeeAction>>) {
    if (!result.ok) return
    const { employee } = result
    const teamId = employee.teamId ?? null
    const team = teams.find((t) => t.id === teamId) ?? null
    const dept = employee.departmentId
      ? (departments.find((d) => d.id === employee.departmentId) ?? null)
      : null
    const fn = employee.functionId
      ? (functions.find((f) => f.id === employee.functionId) ?? null)
      : null
    const newEmployee: EmployeeWithContext = {
      ...employee,
      skills: [],
      location: null,
      department: dept ? { id: dept.id, name: dept.name } : null,
      employeeFunction: fn ? { id: fn.id, name: fn.name, overhead: fn.overhead } : null,
      team: team
        ? {
            id: team.id,
            name: team.name,
            color: team.color,
            rotationAnchorDate: team.rotationAnchorDate,
            rotationLength: team.rotationLength,
            rotationSlots: [],
          }
        : null,
    }
    setEmployees((prev) => [newEmployee, ...prev])
    setPanel(null)
    router.refresh()
  }

  function handleImported() {
    setShowImport(false)
    router.refresh()
  }

  // ── Single delete ──────────────────────────────────────────────────────────
  function openDeleteSingle(emp: EmployeeWithContext) {
    setConfirmDelete({ mode: 'single', employee: emp })
  }

  function executeDeleteSingle() {
    if (confirmDelete?.mode !== 'single') return
    const { employee } = confirmDelete
    startBulkTransition(async () => {
      const result = await deleteEmployeeAction(employee.id)
      setConfirmDelete(null)
      if (!result.ok) {
        showToast('error', result.error)
      } else {
        setEmployees((prev) => prev.filter((e) => e.id !== employee.id))
        setSelectedIds((prev) => {
          const n = new Set(prev)
          n.delete(employee.id)
          return n
        })
        if (panel?.type === 'detail' && panel.employee.id === employee.id) setPanel(null)
        showToast('success', `${employee.name} removed.`)
      }
    })
  }

  // ── Bulk delete ────────────────────────────────────────────────────────────
  function executeDeleteBulk() {
    if (confirmDelete?.mode !== 'bulk') return
    const ids = [...selectedIds]
    startBulkTransition(async () => {
      const result = await bulkDeleteEmployeesAction(ids)
      setConfirmDelete(null)
      if (!result.ok) {
        showToast('error', result.error)
      } else {
        setEmployees((prev) => prev.filter((e) => !result.deletedIds.includes(e.id)))
        setSelectedIds(new Set())
        const msg =
          result.deletedIds.length > 0
            ? `${result.deletedIds.length} employee${result.deletedIds.length !== 1 ? 's' : ''} removed.${
                result.blockedCount > 0
                  ? ` ${result.blockedCount} skipped — has planning history.`
                  : ''
              }`
            : `No employees removed — all have planning history. Deactivate them instead.`
        showToast(result.deletedIds.length > 0 ? 'success' : 'error', msg)
        router.refresh()
      }
    })
  }

  // ── Bulk team ─────────────────────────────────────────────────────────────
  function handleBulkTeam(teamId: string | null) {
    const ids = [...selectedIds]
    setBulkTeamOpen(false)
    startBulkTransition(async () => {
      const result = await bulkSetTeamAction(ids, teamId)
      if (!result.ok) {
        showToast('error', result.error)
      } else {
        const team = teamId ? (teams.find((t) => t.id === teamId) ?? null) : null
        setEmployees((prev) =>
          prev.map((e) =>
            !ids.includes(e.id)
              ? e
              : {
                  ...e,
                  teamId,
                  team: team
                    ? {
                        id: team.id,
                        name: team.name,
                        color: team.color,
                        rotationAnchorDate: team.rotationAnchorDate,
                        rotationLength: team.rotationLength,
                        rotationSlots: [],
                      }
                    : null,
                },
          ),
        )
        setSelectedIds(new Set())
        showToast(
          'success',
          `Team updated for ${result.updated} employee${result.updated !== 1 ? 's' : ''}.`,
        )
        router.refresh()
      }
    })
  }

  // ── Bulk status ───────────────────────────────────────────────────────────
  function handleBulkStatus(status: string) {
    const ids = [...selectedIds]
    setBulkStatusOpen(false)
    startBulkTransition(async () => {
      const result = await bulkSetStatusAction(ids, status)
      if (!result.ok) {
        showToast('error', result.error)
      } else {
        setEmployees((prev) =>
          prev.map((e) => (!ids.includes(e.id) ? e : { ...e, status })),
        )
        setSelectedIds(new Set())
        showToast(
          'success',
          `Status updated for ${result.updated} employee${result.updated !== 1 ? 's' : ''}.`,
        )
      }
    })
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all duration-300 ${
            toast.type === 'success' ? 'bg-gray-900 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? (
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 16 16">
              <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 16 16">
              <path d="M8 5v4M8 11.5v.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Employees</h1>
          <p className="mt-1 text-sm text-gray-500">
            {employees.length}{' '}
            {employees.length === 1 ? 'person' : 'people'} in your workforce
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="shrink-0 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Import
            </button>
            <button
              type="button"
              onClick={() => setPanel({ type: 'add' })}
              className="shrink-0 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
            >
              + Add employee
            </button>
          </div>
        )}
      </div>

      {/* Search + bulk actions bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 16 16">
                <path
                  d="M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10ZM14 14l-3-3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setSelectedIds(new Set())
              }}
              placeholder="Search by name…"
              className="w-full rounded-md border border-gray-200 py-2 pl-8 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
            />
          </div>
          {search && (
            <p className="text-sm text-gray-500 whitespace-nowrap">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value as 'all' | 'internal' | 'temp'); setSelectedIds(new Set()) }}
            className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:border-gray-400 focus:outline-none"
          >
            <option value="all">All types</option>
            <option value="internal">Internal</option>
            <option value="temp">Temporary</option>
          </select>

          {departments.length > 0 && (
            <select
              value={deptFilter}
              onChange={(e) => { setDeptFilter(e.target.value); setSelectedIds(new Set()) }}
              className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:border-gray-400 focus:outline-none"
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}

          {functions.length > 0 && (
            <select
              value={fnFilter}
              onChange={(e) => { setFnFilter(e.target.value); setSelectedIds(new Set()) }}
              className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:border-gray-400 focus:outline-none"
            >
              <option value="">All functions</option>
              {functions.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          )}

          {hasOverheadFns && (
            <select
              value={overheadFilter}
              onChange={(e) => { setOverheadFilter(e.target.value as 'all' | 'direct' | 'overhead'); setSelectedIds(new Set()) }}
              className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:border-gray-400 focus:outline-none"
            >
              <option value="all">All workers</option>
              <option value="direct">Direct labour</option>
              <option value="overhead">Overhead only</option>
            </select>
          )}

          {(typeFilter !== 'all' || deptFilter || fnFilter || overheadFilter !== 'all') && (
            <button
              type="button"
              onClick={() => { setTypeFilter('all'); setDeptFilter(''); setFnFilter(''); setOverheadFilter('all'); setSelectedIds(new Set()) }}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Bulk actions bar — appears when rows are selected */}
        {canEdit && someSelected && (
          <div className="flex flex-wrap items-center gap-2 ds-card px-4 py-2.5">
            <span className="text-sm font-semibold text-gray-800">
              {selectedIds.size} selected
            </span>
            <div className="h-4 w-px bg-gray-200 mx-1" />

            {/* Assign team dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setBulkTeamOpen((v) => !v); setBulkStatusOpen(false) }}
                disabled={isBulkPending}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 16 16">
                  <path d="M8 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM3 13a5 5 0 0 1 10 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                Assign team
                <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 8 8">
                  <path d="M1 2.5L4 5.5 7 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
              {bulkTeamOpen && (
                <div className="ds-menu left-0 top-full mt-1 w-48">
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
                    onClick={() => handleBulkTeam(null)}
                  >
                    Remove team
                  </button>
                  {teams.length > 0 && <div className="my-1 border-t border-gray-100" />}
                  {teams.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
                      onClick={() => handleBulkTeam(t.id)}
                    >
                      {t.color && (
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: t.color }}
                        />
                      )}
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Set status dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setBulkStatusOpen((v) => !v); setBulkTeamOpen(false) }}
                disabled={isBulkPending}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 16 16">
                  <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M8 5v3.5l2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                Set status
                <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 8 8">
                  <path d="M1 2.5L4 5.5 7 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
              {bulkStatusOpen && (
                <div className="ds-menu left-0 top-full mt-1 w-36">
                  <button
                    type="button"
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
                    onClick={() => handleBulkStatus('active')}
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Active
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
                    onClick={() => handleBulkStatus('inactive')}
                  >
                    <span className="h-2 w-2 rounded-full bg-gray-400" />
                    Inactive
                  </button>
                </div>
              )}
            </div>

            {/* Delete selected */}
            <button
              type="button"
              onClick={() => {
                setBulkTeamOpen(false)
                setBulkStatusOpen(false)
                setConfirmDelete({ mode: 'bulk' })
              }}
              disabled={isBulkPending}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <TrashIcon />
              Delete selected
            </button>

            <div className="flex-1" />

            {/* Clear */}
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="ds-card px-6 py-12 text-center">
          <p className="text-sm text-gray-500">
            {search
              ? `No employees match "${search}".`
              : 'No employees yet. Add your first employee.'}
          </p>
        </div>
      ) : (
        <div className="ds-table-wrap">
          <table className="min-w-full ds-table">
            <thead className="ds-table-head">
              <tr>
                {canEdit && (
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected && !allFilteredSelected
                      }}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      aria-label="Select all"
                    />
                  </th>
                )}
                {['Name', 'Team', 'Department', 'Function', 'Type', 'Status', 'Added'].map((h) => (
                  <Th key={h}>{h}</Th>
                ))}
                {canEdit && <th className="w-10" />}
              </tr>
            </thead>
            <tbody className="ds-table-body">
              {filtered.map((emp) => {
                const isDetailOpen = panel?.type === 'detail' && panel.employee.id === emp.id
                const isChecked = selectedIds.has(emp.id)
                return (
                  <tr
                    key={emp.id}
                    onClick={() => {
                      setBulkTeamOpen(false)
                      setBulkStatusOpen(false)
                      setPanel({ type: 'detail', employee: emp })
                    }}
                    className={[
                      'ds-table-row cursor-pointer group',
                      isChecked
                        ? '!bg-indigo-50/60'
                        : isDetailOpen
                        ? '!bg-indigo-50'
                        : '',
                    ].join(' ')}
                  >
                    {/* Checkbox */}
                    {canEdit && (
                      <td
                        className="w-10 px-3 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(emp.id)}
                          className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                          aria-label={`Select ${emp.name}`}
                        />
                      </td>
                    )}

                    {/* Name */}
                    <td className="ds-table-td whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={emp.name} size="sm" />
                        <span className="ds-table-td-primary">{emp.name}</span>
                      </div>
                    </td>

                    {/* Team */}
                    <td className="ds-table-td whitespace-nowrap">
                      {emp.team ? (
                        <div className="flex items-center gap-1.5">
                          {emp.team.color && (
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: emp.team.color }}
                            />
                          )}
                          <span className="text-gray-700">{emp.team.name}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Department */}
                    <td className="ds-table-td whitespace-nowrap">
                      {emp.department?.name
                        ? <span className="text-gray-700">{emp.department.name}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>

                    {/* Function */}
                    <td className="ds-table-td whitespace-nowrap">
                      {emp.employeeFunction ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-gray-700">{emp.employeeFunction.name}</span>
                          {emp.employeeFunction.overhead && (
                            <span className="rounded-full border border-violet-100 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600">
                              OH
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Type */}
                    <td className="ds-table-td ds-table-td-secondary whitespace-nowrap">
                      {TYPE_LABELS[emp.employeeType] ?? emp.employeeType}
                    </td>

                    {/* Status */}
                    <td className="ds-table-td whitespace-nowrap">
                      <StatusBadge
                        variant={emp.status === 'active' ? 'success' : 'neutral'}
                        dot
                      >
                        {emp.status}
                      </StatusBadge>
                    </td>

                    {/* Added */}
                    <td className="ds-table-td ds-table-td-meta whitespace-nowrap">
                      {formatDate(emp.createdAt)}
                    </td>

                    {/* Row delete button */}
                    {canEdit && (
                      <td
                        className="px-2 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => openDeleteSingle(emp)}
                          className="invisible group-hover:visible flex h-7 w-7 items-center justify-center rounded-md text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                          aria-label={`Delete ${emp.name}`}
                          title="Delete employee"
                        >
                          <TrashIcon />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Panels */}
      {panel?.type === 'detail' && (
        <EmployeeDetailPanel
          employee={panel.employee}
          teams={teams}
          departments={departments}
          functions={functions}
          canEdit={canEdit}
          onClose={() => setPanel(null)}
          onTeamChange={handleTeamChange}
          onFunctionChange={handleFunctionChange}
          onDepartmentChange={handleDepartmentChange}
        />
      )}

      {panel?.type === 'add' && (
        <AddEmployeePanel
          teams={teams}
          departments={departments}
          functions={functions}
          onClose={() => setPanel(null)}
          onCreated={handleCreated}
        />
      )}

      {showImport && (
        <BulkImportModal
          teams={teams}
          departments={departments}
          functions={functions}
          onClose={() => setShowImport(false)}
          onImported={handleImported}
        />
      )}

      {/* Confirmation dialog */}
      {confirmDelete && (
        <ConfirmDialog
          title={
            confirmDelete.mode === 'single'
              ? `Delete ${confirmDelete.employee.name}?`
              : `Delete ${selectedIds.size} employee${selectedIds.size !== 1 ? 's' : ''}?`
          }
          description={
            confirmDelete.mode === 'single' ? (
              <>
                Permanently removes{' '}
                <strong>{confirmDelete.employee.name}</strong> from your workforce.
                Employees with planning history cannot be deleted — you will see an explanation
                if that applies.
              </>
            ) : (
              <>
                <p>
                  Permanently removes{' '}
                  <strong>
                    {selectedIds.size} employee{selectedIds.size !== 1 ? 's' : ''}
                  </strong>{' '}
                  from your workforce.
                </p>
                <p className="mt-1.5 text-xs text-amber-600">
                  Employees with planning history are skipped — deactivate them instead.
                </p>
              </>
            )
          }
          confirmLabel="Delete"
          isPending={isBulkPending}
          onConfirm={confirmDelete.mode === 'single' ? executeDeleteSingle : executeDeleteBulk}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
