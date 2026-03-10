'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { EmployeeWithContext } from '@/lib/queries/employees'
import type { TeamSummary } from '@/lib/queries/teams'
import {
  createWorkforceEmployeeAction,
  setWorkforceEmployeeTeamAction,
} from '@/app/workforce/employees/actions'

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
  canEdit,
  onClose,
  onTeamChange,
}: {
  employee: EmployeeWithContext
  teams: TeamSummary[]
  canEdit: boolean
  onClose: () => void
  onTeamChange: (emp: EmployeeWithContext, teamId: string | null) => void
}) {
  const [teamValue, setTeamValue] = useState(employee.teamId ?? '')
  const [teamError, setTeamError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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
        setTeamValue(prev) // revert on failure
      } else {
        onTeamChange(employee, newId)
      }
    })
  }

  const currentTeam = teams.find((t) => t.id === teamValue) ?? null

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
              <dt className="w-24 shrink-0 text-sm text-gray-500">Department</dt>
              <dd className="text-sm text-gray-900">
                {employee.department?.name ?? <span className="text-gray-400">—</span>}
              </dd>
            </div>
          </dl>
        </div>

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
  onClose,
  onCreated,
}: {
  teams: TeamSummary[]
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
  canEdit: boolean
}

type PanelState =
  | { type: 'detail'; employee: EmployeeWithContext }
  | { type: 'add' }
  | null

export default function WorkforceEmployeesView({
  employees: initialEmployees,
  teams,
  canEdit,
}: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [panel, setPanel] = useState<PanelState>(null)
  const [employees, setEmployees] = useState(initialEmployees)

  // Sync local list when the server component re-renders with fresh data (after router.refresh())
  useEffect(() => {
    setEmployees(initialEmployees)
  }, [initialEmployees])

  const filtered = employees.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()),
  )

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

  function handleCreated(result: Awaited<ReturnType<typeof createWorkforceEmployeeAction>>) {
    if (!result.ok) return
    const { employee } = result
    const teamId = employee.teamId ?? null
    const team = teams.find((t) => t.id === teamId) ?? null
    // Optimistically insert at top — matches server sort order (createdAt desc)
    const newEmployee: EmployeeWithContext = {
      ...employee,
      skills: [],
      location: null,
      department: null,
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
    // Background refresh to sync full server state
    router.refresh()
  }

  return (
    <div className="space-y-6">
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
          <button
            type="button"
            onClick={() => setPanel({ type: 'add' })}
            className="shrink-0 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
          >
            + Add employee
          </button>
        )}
      </div>

      {/* Search bar */}
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
            onChange={(e) => setSearch(e.target.value)}
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

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-gray-500">
            {search
              ? `No employees match "${search}".`
              : 'No employees yet. Add your first employee.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Team', 'Type', 'Status', 'Added'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filtered.map((emp) => {
                const isSelected =
                  panel?.type === 'detail' && panel.employee.id === emp.id
                return (
                  <tr
                    key={emp.id}
                    onClick={() => setPanel({ type: 'detail', employee: emp })}
                    className={[
                      'cursor-pointer transition-colors',
                      isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50',
                    ].join(' ')}
                  >
                    {/* Name with mini avatar */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600 select-none">
                          {getInitials(emp.name)}
                        </div>
                        <span className="font-medium text-gray-900">{emp.name}</span>
                      </div>
                    </td>

                    {/* Team */}
                    <td className="px-4 py-3 whitespace-nowrap">
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

                    {/* Type */}
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {TYPE_LABELS[emp.employeeType] ?? emp.employeeType}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[emp.status] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[emp.status] ?? 'bg-gray-400'}`}
                        />
                        <span className="capitalize">{emp.status}</span>
                      </span>
                    </td>

                    {/* Added */}
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                      {formatDate(emp.createdAt)}
                    </td>
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
          canEdit={canEdit}
          onClose={() => setPanel(null)}
          onTeamChange={handleTeamChange}
        />
      )}

      {panel?.type === 'add' && (
        <AddEmployeePanel
          teams={teams}
          onClose={() => setPanel(null)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
