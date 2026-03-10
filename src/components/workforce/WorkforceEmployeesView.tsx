'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { EmployeeWithContext } from '@/lib/queries/employees'
import type { TeamSummary } from '@/lib/queries/teams'
import {
  createWorkforceEmployeeAction,
  setWorkforceEmployeeTeamAction,
} from '@/app/workforce/employees/actions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
}

const TYPE_LABELS: Record<string, string> = {
  internal: 'Internal',
  temp: 'Temporary',
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
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

  function handleTeamChange(newValue: string) {
    const newId = newValue || null
    setTeamValue(newValue)
    setTeamError(null)
    startTransition(async () => {
      const result = await setWorkforceEmployeeTeamAction(employee.id, newId)
      if (!result.ok) {
        setTeamError(result.error)
      } else {
        onTeamChange(employee, newId)
      }
    })
  }

  const teamName = teams.find((t) => t.id === teamValue)?.name ?? null
  const teamColor = teams.find((t) => t.id === teamValue)?.color ?? null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-40 w-96 bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900 truncate pr-4">{employee.name}</h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Status + Type badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[employee.status] ?? 'bg-gray-100 text-gray-600'}`}
            >
              {employee.status}
            </span>
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
              {TYPE_LABELS[employee.employeeType] ?? employee.employeeType}
            </span>
          </div>

          {/* Email */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Email</p>
            <p className="text-sm text-gray-900">{employee.email}</p>
          </div>

          {/* Contract hours */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Contract hours / week</p>
            <p className="text-sm text-gray-900">{employee.contractHours}h</p>
          </div>

          {/* Team */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Team</p>
            {canEdit ? (
              <div className="flex items-center gap-2">
                <select
                  value={teamValue}
                  onChange={(e) => handleTeamChange(e.target.value)}
                  disabled={isPending}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-500 focus:outline-none disabled:opacity-60"
                >
                  <option value="">— No team —</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {isPending && <span className="text-xs text-gray-400">Saving…</span>}
                {teamError && <span className="text-xs text-red-600">{teamError}</span>}
              </div>
            ) : teamName ? (
              <div className="flex items-center gap-1.5">
                {teamColor && (
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: teamColor }}
                  />
                )}
                <span className="text-sm text-gray-900">{teamName}</span>
              </div>
            ) : (
              <span className="text-sm text-gray-400">—</span>
            )}
          </div>

          {/* Location */}
          {employee.location && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Location</p>
              <p className="text-sm text-gray-900">{employee.location.name}</p>
            </div>
          )}

          {/* Department */}
          {employee.department && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Department</p>
              <p className="text-sm text-gray-900">{employee.department.name}</p>
            </div>
          )}

          {/* Created */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Added</p>
            <p className="text-sm text-gray-900">{formatDate(employee.createdAt)}</p>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Add Employee Panel ───────────────────────────────────────────────────────

function AddEmployeePanel({
  teams,
  onClose,
  onSuccess,
}: {
  teams: TeamSummary[]
  onClose: () => void
  onSuccess: () => void
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
        onSuccess()
      }
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-40 w-96 bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Add employee</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4 flex flex-col">
          <div className="flex-1 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="add-name">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="add-name"
                name="name"
                type="text"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
                placeholder="Jane Doe"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="add-email">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="add-email"
                name="email"
                type="email"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
                placeholder="jane@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="add-type">
                Type
              </label>
              <select
                id="add-type"
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
              <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="add-hours">
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
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="add-status">
                Status
              </label>
              <select
                id="add-status"
                name="status"
                required
                defaultValue="active"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {teams.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="add-team">
                  Team
                </label>
                <select
                  id="add-team"
                  name="teamId"
                  defaultValue=""
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
                >
                  <option value="">— No team —</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Adding…' : 'Add employee'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
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

export default function WorkforceEmployeesView({ employees: initialEmployees, teams, canEdit }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [panel, setPanel] = useState<PanelState>(null)
  const [employees, setEmployees] = useState(initialEmployees)

  // Sync when server re-renders (after router.refresh)
  // This relies on the parent server component passing fresh props
  // React will reconcile and update the state through the initial render
  // We use a different approach: keep employees derived from props when no local mutation is pending

  const filtered = employees.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()),
  )

  function handleTeamChange(emp: EmployeeWithContext, teamId: string | null) {
    const team = teams.find((t) => t.id === teamId) ?? null
    setEmployees((prev) =>
      prev.map((e) =>
        e.id === emp.id
          ? {
              ...e,
              teamId: teamId,
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
          : e,
      ),
    )
    // Update detail panel employee reference as well
    if (panel?.type === 'detail' && panel.employee.id === emp.id) {
      setPanel({
        type: 'detail',
        employee: {
          ...emp,
          teamId: teamId,
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
      })
    }
  }

  function handleAddSuccess() {
    setPanel(null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Employees</h1>
          <p className="mt-1 text-sm text-gray-500">Browse and manage your workforce.</p>
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

      {/* Search */}
      <div className="max-w-sm">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-6">
          {search ? 'No employees match your search.' : 'No employees yet.'}
        </p>
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
                const isSelected = panel?.type === 'detail' && panel.employee.id === emp.id
                return (
                  <tr
                    key={emp.id}
                    onClick={() => setPanel({ type: 'detail', employee: emp })}
                    className={[
                      'cursor-pointer transition-colors',
                      isSelected ? 'bg-gray-100' : 'hover:bg-gray-50',
                    ].join(' ')}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {emp.name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {emp.team ? (
                        <div className="flex items-center gap-1.5">
                          {emp.team.color && (
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: emp.team.color }}
                            />
                          )}
                          <span className="text-gray-700">{emp.team.name}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {TYPE_LABELS[emp.employeeType] ?? emp.employeeType}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[emp.status] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {emp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
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
          onSuccess={handleAddSuccess}
        />
      )}
    </div>
  )
}
