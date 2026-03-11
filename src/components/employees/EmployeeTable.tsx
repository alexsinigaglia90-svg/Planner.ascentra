'use client'

import { useRef, useState, useTransition } from 'react'
import type { EmployeeWithContext, SkillEntry } from '@/lib/queries/employees'
import type { Skill } from '@/lib/queries/skills'
import {
  addEmployeeSkillAction,
  removeEmployeeSkillAction,
  setEmployeeLocationAction,
  setEmployeeDepartmentAction,
  setEmployeeTeamAction,
  setEmployeeFunctionAction,
} from '@/app/employees/actions'

// ---------------------------------------------------------------------------
// Per-employee skill cell — add / remove skills inline
// ---------------------------------------------------------------------------

function EmployeeSkillCell({
  employee,
  orgSkills,
  canEdit,
}: {
  employee: EmployeeWithContext
  orgSkills: Skill[]
  canEdit: boolean
}) {
  const [currentSkills, setCurrentSkills] = useState<SkillEntry[]>(employee.skills)
  const [showDropdown, setShowDropdown] = useState(false)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [addingId, setAddingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const assignedIds = new Set(currentSkills.map((s) => s.skillId))
  const available = orgSkills.filter((s) => !assignedIds.has(s.id))

  function handleAdd(skill: Skill) {
    setShowDropdown(false)
    setAddingId(skill.id)
    startTransition(async () => {
      const result = await addEmployeeSkillAction(employee.id, skill.id)
      if (result.ok) {
        setCurrentSkills((prev) => [
          ...prev,
          { id: `${employee.id}:${skill.id}`, skillId: skill.id, skill },
        ])
      }
      setAddingId(null)
    })
  }

  function handleRemove(skillId: string) {
    setRemovingIds((prev) => new Set([...prev, skillId]))
    startTransition(async () => {
      const result = await removeEmployeeSkillAction(employee.id, skillId)
      if (result.ok) {
        setCurrentSkills((prev) => prev.filter((s) => s.skillId !== skillId))
      }
      setRemovingIds((prev) => {
        const next = new Set(prev)
        next.delete(skillId)
        return next
      })
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-1 min-w-[8rem]">
      {currentSkills.length === 0 && !canEdit && (
        <span className="text-xs text-gray-400">—</span>
      )}

      {currentSkills.map(({ skillId, skill }) => {
        const isRemoving = removingIds.has(skillId)
        return (
          <span
            key={skillId}
            className={[
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity',
              isRemoving
                ? 'bg-gray-100 text-gray-400 opacity-50'
                : 'bg-violet-50 text-violet-700',
            ].join(' ')}
          >
            {skill.name}
            {canEdit && !isRemoving && (
              <button
                type="button"
                onClick={() => handleRemove(skillId)}
                className="ml-0.5 text-violet-400 hover:text-violet-700 leading-none transition-colors"
                aria-label={`Remove skill ${skill.name}`}
              >
                ×
              </button>
            )}
          </span>
        )
      })}

      {addingId && (
        <span className="text-[10px] text-gray-400">
          Adding…
        </span>
      )}

      {/* Add button — only when editable and there are unassigned skills */}
      {canEdit && available.length > 0 && (
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowDropdown((v) => !v)}
            onBlur={(e) => {
              if (!dropdownRef.current?.contains(e.relatedTarget as Node)) {
                setShowDropdown(false)
              }
            }}
            className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-violet-400 hover:text-violet-600 transition-colors text-xs leading-none"
            aria-label="Add skill"
          >
            +
          </button>

          {showDropdown && (
            <div className="absolute z-20 top-6 left-0 min-w-[130px] rounded-lg border border-gray-200 bg-white shadow-lg py-1">
              {available.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  onMouseDown={() => handleAdd(skill)}
                  className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors"
                >
                  {skill.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Location / Department selector cell
// ---------------------------------------------------------------------------

type NamedItem = { id: string; name: string }

function ContextSelectCell({
  currentId,
  currentName,
  options,
  canEdit,
  onSave,
  placeholder,
  tagClassName,
}: {
  currentId: string | null
  currentName: string | null
  options: NamedItem[]
  canEdit: boolean
  onSave: (id: string | null) => Promise<{ ok: true } | { ok: false; error: string }>
  placeholder: string
  tagClassName: string
}) {
  const [value, setValue] = useState(currentId ?? '')
  const [displayName, setDisplayName] = useState(currentName)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleChange(newValue: string) {
    setValue(newValue)
    setError(null)
    const newId = newValue || null
    const found = options.find((o) => o.id === newValue)
    setDisplayName(found?.name ?? null)
    startTransition(async () => {
      const result = await onSave(newId)
      if (!result.ok) setError(result.error)
    })
  }

  if (!canEdit) {
    return displayName ? (
      <span className={tagClassName}>{displayName}</span>
    ) : (
      <span className="text-xs text-gray-400">—</span>
    )
  }

  if (options.length === 0) {
    return <span className="text-xs text-gray-400">None defined</span>
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-gray-500 focus:outline-none disabled:opacity-60 max-w-[150px]"
        aria-label={placeholder}
      >
        <option value="">— {placeholder} —</option>
        {/* Show archived legacy value as a disabled option if not in active list */}
        {value && !options.find((o) => o.id === value) && displayName && (
          <option value={value} disabled>{displayName} (Archived)</option>
        )}
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
      {isPending && <span className="text-[10px] text-gray-400">Saving…</span>}
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
}

const TYPE_LABELS: Record<string, string> = {
  internal: 'Internal',
  temp: 'Temporary',
}

interface Props {
  employees: EmployeeWithContext[]
  orgSkills: Skill[]
  locations: NamedItem[]
  departments: NamedItem[]
  teams: NamedItem[]
  functions?: (NamedItem & { overhead: boolean })[]
  canEdit: boolean
}

export default function EmployeeTable({ employees, orgSkills, locations, departments, teams, functions = [], canEdit }: Props) {
  if (employees.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-6">
        No employees yet. Add your first employee below.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {['Name', 'Email', 'Type', 'Contract hours', 'Skills', 'Location', 'Department', 'Function', 'Team', 'Status'].map((h) => (
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
          {employees.map((emp) => (
            <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{emp.name}</td>
              <td className="px-4 py-3 text-gray-600">{emp.email}</td>
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                {TYPE_LABELS[emp.employeeType] ?? emp.employeeType}
              </td>
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{emp.contractHours}h</td>
              <td className="px-4 py-3">
                <EmployeeSkillCell employee={emp} orgSkills={orgSkills} canEdit={canEdit} />
              </td>
              <td className="px-4 py-3">
                <ContextSelectCell
                  currentId={emp.locationId ?? null}
                  currentName={emp.location?.name ?? null}
                  options={locations}
                  canEdit={canEdit}
                  onSave={(id) => setEmployeeLocationAction(emp.id, id)}
                  placeholder="Location"
                  tagClassName="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700"
                />
              </td>
              <td className="px-4 py-3">
                <ContextSelectCell
                  currentId={emp.departmentId ?? null}
                  currentName={emp.department?.name ?? null}
                  options={departments}
                  canEdit={canEdit}
                  onSave={(id) => setEmployeeDepartmentAction(emp.id, id)}
                  placeholder="Department"
                  tagClassName="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                />
              </td>
              <td className="px-4 py-3">
                {functions.length > 0 ? (
                  <ContextSelectCell
                    currentId={emp.functionId ?? null}
                    currentName={emp.employeeFunction?.name ?? null}
                    options={functions}
                    canEdit={canEdit}
                    onSave={(id) => setEmployeeFunctionAction(emp.id, id)}
                    placeholder="Function"
                    tagClassName="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700"
                  />
                ) : (
                  <span className="text-xs text-gray-500">
                    {emp.employeeFunction?.name ?? <span className="text-gray-400">—</span>}
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <ContextSelectCell
                  currentId={emp.teamId ?? null}
                  currentName={emp.team?.name ?? null}
                  options={teams}
                  canEdit={canEdit}
                  onSave={(id) => setEmployeeTeamAction(emp.id, id)}
                  placeholder="Team"
                  tagClassName="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
                />
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[emp.status] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {emp.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
