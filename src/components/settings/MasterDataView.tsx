'use client'

import { useState, useTransition } from 'react'
import type { Department } from '@/lib/queries/locations'
import type { EmployeeFunction } from '@/lib/queries/functions'
import {
  createDepartmentMdAction,
  updateDepartmentMdAction,
  deleteDepartmentMdAction,
  createFunctionMdAction,
  updateFunctionMdAction,
  deleteFunctionMdAction,
} from '@/app/settings/masterdata/actions'

// ─── Shared helpers ────────────────────────────────────────────────────────────

function UsageBadge({ count }: { count: number }) {
  return (
    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
      {count} employee{count !== 1 ? 's' : ''}
    </span>
  )
}

// ─── Department row ────────────────────────────────────────────────────────────

interface DeptRowProps {
  dept: Department
  usage: number
  onDeleted: (id: string) => void
  onUpdated: (updated: Department) => void
}

function DeptRow({ dept, usage, onDeleted, onUpdated }: DeptRowProps) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(dept.name)
  const [isPending, startTransition] = useTransition()
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  function handleDelete() {
    if (!confirm(`Delete department "${dept.name}"?`)) return
    setDeleteError(null)
    startTransition(async () => {
      const res = await deleteDepartmentMdAction(dept.id)
      if (!res.ok) setDeleteError(res.error)
      else onDeleted(dept.id)
    })
  }

  function handleSaveEdit() {
    setEditError(null)
    startTransition(async () => {
      const res = await updateDepartmentMdAction(dept.id, editName)
      if (!res.ok) {
        setEditError(res.error)
      } else {
        setEditing(false)
        onUpdated({ ...dept, name: editName.trim() })
      }
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-3 px-4 py-3">
        {editing ? (
          <div className="flex-1 flex flex-col gap-2">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Department name"
              className="rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            {editError && <p className="text-xs text-red-600">{editError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={isPending}
                className="rounded bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => { setEditing(false); setEditError(null); setEditName(dept.name) }}
                className="rounded border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{dept.name}</p>
            </div>
            <UsageBadge count={usage} />
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setEditing(true)}
                className="rounded px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="rounded px-2.5 py-1 text-xs font-medium text-red-600 border border-red-100 hover:bg-red-50 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
      {deleteError && (
        <p className="px-4 pb-3 text-xs text-red-600">{deleteError}</p>
      )}
    </div>
  )
}

// ─── New department form ───────────────────────────────────────────────────────

interface NewDeptFormProps {
  onCreated: (dept: Department) => void
}

function NewDeptForm({ onCreated }: NewDeptFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await createDepartmentMdAction(name)
      if (!res.ok) {
        setError(res.error)
      } else {
        setName('')
        onCreated({ id: res.id, name: res.name, organizationId: '' } as Department)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
      <p className="text-sm font-semibold text-gray-700 mb-3">New department</p>
      <div className="flex gap-2">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Department name"
          className="flex-1 rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Adding…' : 'Add'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </form>
  )
}

// ─── Function row ──────────────────────────────────────────────────────────────

interface FnRowProps {
  fn: EmployeeFunction
  usage: number
  onDeleted: (id: string) => void
  onUpdated: (updated: EmployeeFunction) => void
}

function FnRow({ fn, usage, onDeleted, onUpdated }: FnRowProps) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(fn.name)
  const [editOverhead, setEditOverhead] = useState(fn.overhead)
  const [isPending, startTransition] = useTransition()
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  function handleDelete() {
    if (!confirm(`Delete function "${fn.name}"?`)) return
    setDeleteError(null)
    startTransition(async () => {
      const res = await deleteFunctionMdAction(fn.id)
      if (!res.ok) setDeleteError(res.error)
      else onDeleted(fn.id)
    })
  }

  function handleSaveEdit() {
    setEditError(null)
    startTransition(async () => {
      const res = await updateFunctionMdAction(fn.id, { name: editName, overhead: editOverhead })
      if (!res.ok) {
        setEditError(res.error)
      } else {
        setEditing(false)
        onUpdated({ ...fn, name: editName.trim(), overhead: editOverhead })
      }
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-3 px-4 py-3">
        {editing ? (
          <div className="flex-1 flex flex-col gap-2">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Function name"
              className="rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={editOverhead}
                onChange={(e) => setEditOverhead(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
              />
              <span className="font-medium">Overhead</span>
              <span className="text-xs text-gray-400">(not counted in direct labour)</span>
            </label>
            {editError && <p className="text-xs text-red-600">{editError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={isPending}
                className="rounded bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setEditing(false)
                  setEditError(null)
                  setEditName(fn.name)
                  setEditOverhead(fn.overhead)
                }}
                className="rounded border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900 truncate">{fn.name}</p>
              {fn.overhead ? (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  Overhead
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                  Direct
                </span>
              )}
            </div>
            <UsageBadge count={usage} />
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setEditing(true)}
                className="rounded px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="rounded px-2.5 py-1 text-xs font-medium text-red-600 border border-red-100 hover:bg-red-50 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
      {deleteError && (
        <p className="px-4 pb-3 text-xs text-red-600">{deleteError}</p>
      )}
    </div>
  )
}

// ─── New function form ─────────────────────────────────────────────────────────

interface NewFnFormProps {
  onCreated: (fn: EmployeeFunction) => void
}

function NewFnForm({ onCreated }: NewFnFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [overhead, setOverhead] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await createFunctionMdAction(name, overhead)
      if (!res.ok) {
        setError(res.error)
      } else {
        setName('')
        setOverhead(false)
        onCreated({ id: res.id, name: res.name, overhead: res.overhead, organizationId: '' } as EmployeeFunction)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
      <p className="text-sm font-semibold text-gray-700 mb-3">New function</p>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Function name"
            className="flex-1 rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Adding…' : 'Add'}
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={overhead}
            onChange={(e) => setOverhead(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
          />
          <span className="font-medium">Overhead</span>
          <span className="text-xs text-gray-400">(not counted in direct labour)</span>
        </label>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </form>
  )
}

// ─── Main view ─────────────────────────────────────────────────────────────────

interface Props {
  departments: Department[]
  departmentUsage: Record<string, number>
  functions: EmployeeFunction[]
  functionUsage: Record<string, number>
}

export default function MasterDataView({
  departments: initialDepts,
  departmentUsage: initialDeptUsage,
  functions: initialFns,
  functionUsage: initialFnUsage,
}: Props) {
  const [depts, setDepts] = useState(initialDepts)
  const [deptUsage, setDeptUsage] = useState(initialDeptUsage)
  const [fns, setFns] = useState(initialFns)
  const [fnUsage, setFnUsage] = useState(initialFnUsage)

  function handleDeptCreated(dept: Department) {
    setDepts((prev) => [...prev, dept].sort((a, b) => a.name.localeCompare(b.name)))
    setDeptUsage((prev) => ({ ...prev, [dept.id]: 0 }))
  }

  function handleDeptDeleted(id: string) {
    setDepts((prev) => prev.filter((d) => d.id !== id))
    setDeptUsage((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  function handleDeptUpdated(updated: Department) {
    setDepts((prev) =>
      prev.map((d) => (d.id === updated.id ? updated : d)).sort((a, b) => a.name.localeCompare(b.name)),
    )
  }

  function handleFnCreated(fn: EmployeeFunction) {
    setFns((prev) => [...prev, fn].sort((a, b) => a.name.localeCompare(b.name)))
    setFnUsage((prev) => ({ ...prev, [fn.id]: 0 }))
  }

  function handleFnDeleted(id: string) {
    setFns((prev) => prev.filter((f) => f.id !== id))
    setFnUsage((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  function handleFnUpdated(updated: EmployeeFunction) {
    setFns((prev) =>
      prev.map((f) => (f.id === updated.id ? updated : f)).sort((a, b) => a.name.localeCompare(b.name)),
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 space-y-12">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Master Data</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage departments and employee functions used across the planner.
        </p>
      </div>

      {/* ── Departments ── */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-gray-800">Departments</h2>
        <div className="space-y-3 mb-4">
          {depts.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No departments yet.</p>
          ) : (
            depts.map((dept) => (
              <DeptRow
                key={dept.id}
                dept={dept}
                usage={deptUsage[dept.id] ?? 0}
                onDeleted={handleDeptDeleted}
                onUpdated={handleDeptUpdated}
              />
            ))
          )}
        </div>
        <NewDeptForm onCreated={handleDeptCreated} />
      </section>

      {/* ── Functions ── */}
      <section>
        <h2 className="mb-1 text-base font-semibold text-gray-800">Functions</h2>
        <p className="mb-4 text-sm text-gray-500">
          Functions marked <span className="font-semibold text-amber-700">Overhead</span> are excluded from direct labour calculations.
        </p>
        <div className="space-y-3 mb-4">
          {fns.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No functions yet.</p>
          ) : (
            fns.map((fn) => (
              <FnRow
                key={fn.id}
                fn={fn}
                usage={fnUsage[fn.id] ?? 0}
                onDeleted={handleFnDeleted}
                onUpdated={handleFnUpdated}
              />
            ))
          )}
        </div>
        <NewFnForm onCreated={handleFnCreated} />
      </section>
    </div>
  )
}
