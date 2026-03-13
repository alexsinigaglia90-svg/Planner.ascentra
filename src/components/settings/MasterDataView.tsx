'use client'

import { useState, useTransition } from 'react'
import type { Department } from '@/lib/queries/locations'
import type { DepartmentWithChildren } from '@/lib/queries/locations'
import type { EmployeeFunction } from '@/lib/queries/functions'
import {
  createDepartmentMdAction,
  createSubdepartmentMdAction,
  updateDepartmentMdAction,
  deleteDepartmentMdAction,
  archiveDepartmentMdAction,
  restoreDepartmentMdAction,
  createFunctionMdAction,
  updateFunctionMdAction,
  deleteFunctionMdAction,
  archiveFunctionMdAction,
  restoreFunctionMdAction,
} from '@/app/settings/masterdata/actions'

// â”€â”€â”€ Shared helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function UsageBadge({ count }: { count: number }) {
  return (
    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
      {count} employee{count !== 1 ? 's' : ''}
    </span>
  )
}

// â”€â”€â”€ Department row (active) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface DeptRowProps {
  dept: Department
  usage: number
  onArchived: (id: string) => void
  onDeleted: (id: string) => void
  onUpdated: (updated: Department) => void
}

function DeptRow({ dept, usage, onArchived, onDeleted, onUpdated }: DeptRowProps) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(dept.name)
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  function handleArchive() {
    if (!confirm(`Archive department "${dept.name}"? It will be hidden from selectors but employees will keep their reference.`)) return
    setActionError(null)
    startTransition(async () => {
      const res = await archiveDepartmentMdAction(dept.id)
      if (!res.ok) setActionError(res.error)
      else onArchived(dept.id)
    })
  }

  function handleDelete() {
    if (!confirm(`Permanently delete department "${dept.name}"? This cannot be undone.`)) return
    setActionError(null)
    startTransition(async () => {
      const res = await deleteDepartmentMdAction(dept.id)
      if (!res.ok) setActionError(res.error)
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
                {isPending ? 'Savingâ€¦' : 'Save'}
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
                onClick={handleArchive}
                disabled={isPending}
                className="rounded px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200 hover:bg-amber-50 disabled:opacity-50"
              >
                Archive
              </button>
              {usage === 0 && (
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="rounded px-2.5 py-1 text-xs font-medium text-red-600 border border-red-100 hover:bg-red-50 disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>
      {actionError && (
        <p className="px-4 pb-3 text-xs text-red-600">{actionError}</p>
      )}
    </div>
  )
}

// â”€â”€â”€ Archived department row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ArchivedDeptRow({ dept, usage, onRestored, onDeleted }: {
  dept: Department
  usage: number
  onRestored: (restored: Department) => void
  onDeleted: (id: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleRestore() {
    setError(null)
    startTransition(async () => {
      const res = await restoreDepartmentMdAction(dept.id)
      if (!res.ok) setError(res.error)
      else onRestored({ ...dept, archived: false })
    })
  }

  function handleDelete() {
    if (!confirm(`Permanently delete archived department "${dept.name}"? This cannot be undone.`)) return
    setError(null)
    startTransition(async () => {
      const res = await deleteDepartmentMdAction(dept.id)
      if (!res.ok) setError(res.error)
      else onDeleted(dept.id)
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-400 truncate">{dept.name}</p>
        </div>
        <UsageBadge count={usage} />
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleRestore}
            disabled={isPending}
            className="rounded px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-100 disabled:opacity-50"
          >
            Restore
          </button>
          {usage === 0 && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="rounded px-2.5 py-1 text-xs font-medium text-red-600 border border-red-100 hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>
      {error && <p className="px-4 pb-3 text-xs text-red-600">{error}</p>}
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
        onCreated({ id: res.id, name: res.name, organizationId: '', archived: false } as Department)
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
          {isPending ? 'Addingâ€¦' : 'Add'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </form>
  )
}

// ─── New subdepartment inline form ────────────────────────────────────────────

function NewSubDeptForm({
  parentId,
  onCreated,
  onCancel,
}: {
  parentId: string
  onCreated: (dept: Department) => void
  onCancel: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await createSubdepartmentMdAction(name, parentId)
      if (!res.ok) {
        setError(res.error)
      } else {
        setName('')
        onCreated({ id: res.id, name: res.name, organizationId: '', archived: false, parentDepartmentId: parentId } as Department)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded border border-dashed border-gray-200 bg-gray-50 px-3 py-2.5 flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Subdepartment name"
          className="flex-1 rounded border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Adding\u2026' : 'Add'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  )
}

// ─── Dept group (parent + indented children) ──────────────────────────────────

interface DeptGroupProps {
  dept: DepartmentWithChildren
  usage: Record<string, number>
  onParentArchived: (id: string) => void
  onParentDeleted: (id: string) => void
  onParentUpdated: (updated: Department) => void
  onChildCreated: (parentId: string, child: Department) => void
  onChildArchived: (parentId: string, childId: string) => void
  onChildDeleted: (parentId: string, childId: string) => void
  onChildUpdated: (parentId: string, updated: Department) => void
}

function DeptGroup({
  dept,
  usage,
  onParentArchived,
  onParentDeleted,
  onParentUpdated,
  onChildCreated,
  onChildArchived,
  onChildDeleted,
  onChildUpdated,
}: DeptGroupProps) {
  const [showSubdeptForm, setShowSubdeptForm] = useState(false)

  return (
    <div>
      <DeptRow
        dept={dept}
        usage={usage[dept.id] ?? 0}
        onArchived={onParentArchived}
        onDeleted={onParentDeleted}
        onUpdated={onParentUpdated}
      />
      <div className="ml-6 mt-2 space-y-2">
        {dept.children.map((child) => (
          <DeptRow
            key={child.id}
            dept={child}
            usage={usage[child.id] ?? 0}
            onArchived={(id) => onChildArchived(dept.id, id)}
            onDeleted={(id) => onChildDeleted(dept.id, id)}
            onUpdated={(updated) => onChildUpdated(dept.id, updated)}
          />
        ))}
        {showSubdeptForm ? (
          <NewSubDeptForm
            parentId={dept.id}
            onCreated={(child) => {
              onChildCreated(dept.id, child)
              setShowSubdeptForm(false)
            }}
            onCancel={() => setShowSubdeptForm(false)}
          />
        ) : (
          <button
            onClick={() => setShowSubdeptForm(true)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors py-0.5"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add subdepartment
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Function row (active) ────────────────────────────────────────────────────

interface FnRowProps {
  fn: EmployeeFunction
  usage: number
  onArchived: (id: string) => void
  onDeleted: (id: string) => void
  onUpdated: (updated: EmployeeFunction) => void
}

function FnRow({ fn, usage, onArchived, onDeleted, onUpdated }: FnRowProps) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(fn.name)
  const [editOverhead, setEditOverhead] = useState(fn.overhead)
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  function handleArchive() {
    if (!confirm(`Archive function "${fn.name}"? It will be hidden from selectors but employees will keep their reference.`)) return
    setActionError(null)
    startTransition(async () => {
      const res = await archiveFunctionMdAction(fn.id)
      if (!res.ok) setActionError(res.error)
      else onArchived(fn.id)
    })
  }

  function handleDelete() {
    if (!confirm(`Permanently delete function "${fn.name}"? This cannot be undone.`)) return
    setActionError(null)
    startTransition(async () => {
      const res = await deleteFunctionMdAction(fn.id)
      if (!res.ok) setActionError(res.error)
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
                {isPending ? 'Savingâ€¦' : 'Save'}
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
                onClick={handleArchive}
                disabled={isPending}
                className="rounded px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200 hover:bg-amber-50 disabled:opacity-50"
              >
                Archive
              </button>
              {usage === 0 && (
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="rounded px-2.5 py-1 text-xs font-medium text-red-600 border border-red-100 hover:bg-red-50 disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>
      {actionError && (
        <p className="px-4 pb-3 text-xs text-red-600">{actionError}</p>
      )}
    </div>
  )
}

// â”€â”€â”€ Archived function row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ArchivedFnRow({ fn, usage, onRestored, onDeleted }: {
  fn: EmployeeFunction
  usage: number
  onRestored: (restored: EmployeeFunction) => void
  onDeleted: (id: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleRestore() {
    setError(null)
    startTransition(async () => {
      const res = await restoreFunctionMdAction(fn.id)
      if (!res.ok) setError(res.error)
      else onRestored({ ...fn, archived: false })
    })
  }

  function handleDelete() {
    if (!confirm(`Permanently delete archived function "${fn.name}"? This cannot be undone.`)) return
    setError(null)
    startTransition(async () => {
      const res = await deleteFunctionMdAction(fn.id)
      if (!res.ok) setError(res.error)
      else onDeleted(fn.id)
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <p className="text-sm font-medium text-gray-400 truncate">{fn.name}</p>
          {fn.overhead && (
            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-500">
              Overhead
            </span>
          )}
        </div>
        <UsageBadge count={usage} />
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleRestore}
            disabled={isPending}
            className="rounded px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-100 disabled:opacity-50"
          >
            Restore
          </button>
          {usage === 0 && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="rounded px-2.5 py-1 text-xs font-medium text-red-600 border border-red-100 hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>
      {error && <p className="px-4 pb-3 text-xs text-red-600">{error}</p>}
    </div>
  )
}

// â”€â”€â”€ New function form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
        onCreated({ id: res.id, name: res.name, overhead: res.overhead, organizationId: '', archived: false } as EmployeeFunction)
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
            {isPending ? 'Addingâ€¦' : 'Add'}
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

// â”€â”€â”€ Archived section toggle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ArchivedSection({ label, count, children }: {
  label: string
  count: number
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  if (count === 0) return null
  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        <svg
          className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span>{open ? 'Hide' : 'Show'} {count} archived {label}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {children}
        </div>
      )}
    </div>
  )
}

// â”€â”€â”€ Main view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface Props {
  departments: Department[]
  departmentTree: DepartmentWithChildren[]
  departmentUsage: Record<string, number>
  functions: EmployeeFunction[]
  functionUsage: Record<string, number>
}

export default function MasterDataView({
  departments: initialDepts,
  departmentTree: initialDeptTree,
  departmentUsage: initialDeptUsage,
  functions: initialFns,
  functionUsage: initialFnUsage,
}: Props) {
  const [deptTree, setDeptTree] = useState<DepartmentWithChildren[]>(initialDeptTree)
  const [archivedDepts, setArchivedDepts] = useState<Department[]>(initialDepts.filter((d) => d.archived))
  const [deptUsage, setDeptUsage] = useState(initialDeptUsage)
  const [fns, setFns] = useState(initialFns)
  const [fnUsage, setFnUsage] = useState(initialFnUsage)

  const activeFns = fns.filter((f) => !f.archived)
  const archivedFns = fns.filter((f) => f.archived)

  // ── Department tree handlers ──────────────────────────────────────────────

  function handleDeptCreated(dept: Department) {
    setDeptTree((prev) =>
      [...prev, { ...dept, children: [] } as DepartmentWithChildren].sort((a, b) => a.name.localeCompare(b.name)),
    )
    setDeptUsage((prev) => ({ ...prev, [dept.id]: 0 }))
  }

  function handleDeptArchived(id: string) {
    setDeptTree((prev) => {
      const parent = prev.find((d) => d.id === id)
      if (parent) {
        setArchivedDepts((a) => [...a, { ...parent, archived: true }].sort((x, y) => x.name.localeCompare(y.name)))
      }
      return prev.filter((d) => d.id !== id)
    })
  }

  function handleChildArchived(parentId: string, childId: string) {
    setDeptTree((prev) =>
      prev.map((d) => {
        if (d.id !== parentId) return d
        const child = d.children.find((c) => c.id === childId)
        if (child) {
          setArchivedDepts((a) => [...a, { ...child, archived: true }].sort((x, y) => x.name.localeCompare(y.name)))
        }
        return { ...d, children: d.children.filter((c) => c.id !== childId) }
      }),
    )
  }

  function handleDeptRestored(restored: Department) {
    setArchivedDepts((prev) => prev.filter((d) => d.id !== restored.id))
    if (!restored.parentDepartmentId) {
      setDeptTree((prev) =>
        [...prev, { ...restored, archived: false, children: [] } as DepartmentWithChildren].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      )
    } else {
      setDeptTree((prev) => {
        const parentIdx = prev.findIndex((d) => d.id === restored.parentDepartmentId)
        if (parentIdx === -1) {
          return [...prev, { ...restored, archived: false, children: [] } as DepartmentWithChildren].sort((a, b) =>
            a.name.localeCompare(b.name),
          )
        }
        return prev.map((d, i) =>
          i !== parentIdx
            ? d
            : { ...d, children: [...d.children, { ...restored, archived: false }].sort((a, b) => a.name.localeCompare(b.name)) },
        )
      })
    }
  }

  function handleDeptDeleted(id: string) {
    setDeptTree((prev) => prev.filter((d) => d.id !== id))
    setArchivedDepts((prev) => prev.filter((d) => d.id !== id))
    setDeptUsage((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  function handleChildDeleted(parentId: string, childId: string) {
    setDeptTree((prev) =>
      prev.map((d) => (d.id !== parentId ? d : { ...d, children: d.children.filter((c) => c.id !== childId) })),
    )
    setDeptUsage((prev) => {
      const next = { ...prev }
      delete next[childId]
      return next
    })
  }

  function handleDeptUpdated(updated: Department) {
    setDeptTree((prev) =>
      prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)).sort((a, b) => a.name.localeCompare(b.name)),
    )
  }

  function handleChildUpdated(parentId: string, updated: Department) {
    setDeptTree((prev) =>
      prev.map((d) =>
        d.id !== parentId
          ? d
          : {
              ...d,
              children: d.children
                .map((c) => (c.id === updated.id ? updated : c))
                .sort((a, b) => a.name.localeCompare(b.name)),
            },
      ),
    )
  }

  function handleChildCreated(parentId: string, child: Department) {
    setDeptTree((prev) =>
      prev.map((d) =>
        d.id !== parentId
          ? d
          : { ...d, children: [...d.children, child].sort((a, b) => a.name.localeCompare(b.name)) },
      ),
    )
    setDeptUsage((prev) => ({ ...prev, [child.id]: 0 }))
  }

  // ── Function handlers ─────────────────────────────────────────────────────

  function handleFnCreated(fn: EmployeeFunction) {
    setFns((prev) => [...prev, fn].sort((a, b) => a.name.localeCompare(b.name)))
    setFnUsage((prev) => ({ ...prev, [fn.id]: 0 }))
  }

  function handleFnArchived(id: string) {
    setFns((prev) => prev.map((f) => (f.id === id ? { ...f, archived: true } : f)))
  }

  function handleFnRestored(restored: EmployeeFunction) {
    setFns((prev) =>
      prev.map((f) => (f.id === restored.id ? restored : f)).sort((a, b) => a.name.localeCompare(b.name)),
    )
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

      {/* â”€â”€ Departments â”€â”€ */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-gray-800">Departments</h2>
        <div className="space-y-4 mb-4">
          {deptTree.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No active departments yet.</p>
          ) : (
            deptTree.map((dept) => (
              <DeptGroup
                key={dept.id}
                dept={dept}
                usage={deptUsage}
                onParentArchived={handleDeptArchived}
                onParentDeleted={handleDeptDeleted}
                onParentUpdated={handleDeptUpdated}
                onChildCreated={handleChildCreated}
                onChildArchived={handleChildArchived}
                onChildDeleted={handleChildDeleted}
                onChildUpdated={handleChildUpdated}
              />
            ))
          )}
        </div>
        <NewDeptForm onCreated={handleDeptCreated} />
        <ArchivedSection label="departments" count={archivedDepts.length}>
          {archivedDepts.map((dept) => (
            <ArchivedDeptRow
              key={dept.id}
              dept={dept}
              usage={deptUsage[dept.id] ?? 0}
              onRestored={handleDeptRestored}
              onDeleted={handleDeptDeleted}
            />
          ))}
        </ArchivedSection>
      </section>

      {/* â”€â”€ Functions â”€â”€ */}
      <section>
        <h2 className="mb-1 text-base font-semibold text-gray-800">Functions</h2>
        <p className="mb-4 text-sm text-gray-500">
          Functions marked <span className="font-semibold text-amber-700">Overhead</span> are excluded from direct labour calculations.
        </p>
        <div className="space-y-3 mb-4">
          {activeFns.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No active functions yet.</p>
          ) : (
            activeFns.map((fn) => (
              <FnRow
                key={fn.id}
                fn={fn}
                usage={fnUsage[fn.id] ?? 0}
                onArchived={handleFnArchived}
                onDeleted={handleFnDeleted}
                onUpdated={handleFnUpdated}
              />
            ))
          )}
        </div>
        <NewFnForm onCreated={handleFnCreated} />
        <ArchivedSection label="functions" count={archivedFns.length}>
          {archivedFns.map((fn) => (
            <ArchivedFnRow
              key={fn.id}
              fn={fn}
              usage={fnUsage[fn.id] ?? 0}
              onRestored={handleFnRestored}
              onDeleted={handleFnDeleted}
            />
          ))}
        </ArchivedSection>
      </section>
    </div>
  )
}


