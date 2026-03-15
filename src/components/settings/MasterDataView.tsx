'use client'

import { useState, useTransition } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { Department, DepartmentWithChildren } from '@/lib/queries/locations'
import type { EmployeeFunction } from '@/lib/queries/functions'
import DepartmentGraph from '@/components/settings/DepartmentGraph'
import FunctionWizard from '@/components/settings/FunctionWizard'
import { motion, AnimatePresence } from 'framer-motion'
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

// â"€â"€â"€ Shared helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function UsageBadge({ count }: { count: number }) {
  return (
    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
      {count} employee{count !== 1 ? 's' : ''}
    </span>
  )
}

// â"€â"€â"€ Department row (active) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

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

// â"€â"€â"€ Archived department row â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

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

// â"€â"€â"€ Archived function row â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

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

// ─── FunctionsSection (premium redesign) ──────────────────────────────────────

function FnCard({
  fn,
  usage,
  celebrated,
  onEdit,
  onArchived,
  onDeleted,
}: {
  fn: EmployeeFunction
  usage: number
  celebrated: boolean
  onEdit: () => void
  onArchived: (id: string) => void
  onDeleted: (id: string) => void
}) {
  const [isPending, startTransition] = useTransition()

  function handleArchive() {
    if (!confirm(`Archive function "${fn.name}"?`)) return
    startTransition(async () => {
      const res = await archiveFunctionMdAction(fn.id)
      if (res.ok) onArchived(fn.id)
    })
  }

  function handleDelete() {
    if (!confirm(`Permanently delete "${fn.name}"?`)) return
    startTransition(async () => {
      const res = await deleteFunctionMdAction(fn.id)
      if (res.ok) onDeleted(fn.id)
    })
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={[
        'group relative rounded-xl border bg-white px-4 py-3 transition-all duration-300',
        celebrated
          ? fn.overhead
            ? 'ring-2 ring-amber-200 border-amber-200 shadow-[0_0_16px_rgba(245,158,11,0.10)]'
            : 'ring-2 ring-blue-200 border-blue-200 shadow-[0_0_16px_rgba(79,107,255,0.10)]'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]',
      ].join(' ')}
    >
      {/* Left accent */}
      <div className={`absolute left-0 inset-y-0 w-[3px] rounded-l-xl ${fn.overhead ? 'bg-amber-400' : 'bg-blue-400'}`} />

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{fn.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={[
              'inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold',
              fn.overhead ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700',
            ].join(' ')}>
              {fn.overhead ? 'Overhead' : 'Direct'}
            </span>
            <span className="text-[10px] text-gray-400">
              {usage} employee{usage !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Hover actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={onEdit}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Edit"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M10 2l2 2-7 7H3v-2l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={handleArchive}
            disabled={isPending}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-40"
            title="Archive"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="1" y="2" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <path d="M2 5v6a1 1 0 001 1h8a1 1 0 001-1V5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M5.5 8h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
          {usage === 0 && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
              title="Delete"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 4h10M5 4V2.5h4V4M3.5 4v7.5a1 1 0 001 1h5a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function FunctionsSection({
  activeFns,
  archivedFns,
  fnUsage,
  onCreated,
  onArchived,
  onDeleted,
  onUpdated,
  onRestored,
}: {
  activeFns: EmployeeFunction[]
  archivedFns: EmployeeFunction[]
  fnUsage: Record<string, number>
  onCreated: (fn: EmployeeFunction) => void
  onArchived: (id: string) => void
  onDeleted: (id: string) => void
  onUpdated: (updated: EmployeeFunction) => void
  onRestored: (restored: EmployeeFunction) => void
}) {
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editingFn, setEditingFn] = useState<EmployeeFunction | null>(null)
  const [celebratedId, setCelebratedId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  function celebrate(id: string, msg: string) {
    setCelebratedId(id)
    setSuccessMsg(msg)
    setTimeout(() => setCelebratedId(null), 2000)
  }

  const directFns = activeFns.filter((f) => !f.overhead)
  const overheadFns = activeFns.filter((f) => f.overhead)

  return (
    <section>
      {/* Header */}
      <div className="flex items-start justify-between gap-6 pb-5 border-b border-[#E6E8F0] mb-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1">
            Workforce setup
          </p>
          <h2 className="text-[22px] font-bold text-gray-900 leading-tight">Functions</h2>
          <p className="mt-1 text-sm text-gray-500">
            Define job roles for your workforce.
            {activeFns.length > 0 && (
              <span className="text-gray-400">
                {' · '}{directFns.length} direct, {overheadFns.length} overhead
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => { setEditingFn(null); setWizardOpen(true) }}
          className="ds-btn ds-btn-primary ds-btn-sm"
          style={{ flexShrink: 0, marginTop: 4 }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Add Function
        </button>
      </div>

      {/* Success banner */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 shadow-[0_2px_8px_rgba(16,185,129,0.10)] mb-5"
          >
            <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ duration: 0.5 }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="9" fill="#22C55E" opacity="0.9" />
                <motion.path d="M6 10.5l2.5 2.5L14 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.15 }} />
              </svg>
            </motion.div>
            <span className="text-sm font-medium text-emerald-800">{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="ml-auto text-emerald-400 hover:text-emerald-600 transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10 4L4 10M4 4l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {activeFns.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl border border-gray-200 bg-white shadow-sm mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No functions yet</h3>
          <p className="text-[13px] text-gray-500 max-w-[280px] mx-auto mb-5">
            Functions define job roles like Operator, Teamleader, or Forklift driver.
          </p>
          <button onClick={() => setWizardOpen(true)} className="ds-btn ds-btn-primary ds-btn-sm">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            Add first function
          </button>
        </motion.div>
      )}

      {/* Two-column grid: Direct vs Overhead */}
      {activeFns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Direct labour column */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Direct Labour
              </h3>
              <span className="text-[10px] text-gray-300 font-medium">{directFns.length}</span>
            </div>
            {directFns.length === 0 ? (
              <p className="text-[13px] text-gray-400 italic py-4">No direct labour functions.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {directFns.map((fn) => (
                  <FnCard
                    key={fn.id}
                    fn={fn}
                    usage={fnUsage[fn.id] ?? 0}
                    celebrated={celebratedId === fn.id}
                    onEdit={() => { setEditingFn(fn); setWizardOpen(true) }}
                    onArchived={onArchived}
                    onDeleted={onDeleted}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Overhead column */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Overhead
              </h3>
              <span className="text-[10px] text-gray-300 font-medium">{overheadFns.length}</span>
            </div>
            {overheadFns.length === 0 ? (
              <p className="text-[13px] text-gray-400 italic py-4">No overhead functions.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {overheadFns.map((fn) => (
                  <FnCard
                    key={fn.id}
                    fn={fn}
                    usage={fnUsage[fn.id] ?? 0}
                    celebrated={celebratedId === fn.id}
                    onEdit={() => { setEditingFn(fn); setWizardOpen(true) }}
                    onArchived={onArchived}
                    onDeleted={onDeleted}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Archived */}
      <ArchivedSection label="functions" count={archivedFns.length}>
        {archivedFns.map((fn) => (
          <ArchivedFnRow
            key={fn.id}
            fn={fn}
            usage={fnUsage[fn.id] ?? 0}
            onRestored={onRestored}
            onDeleted={onDeleted}
          />
        ))}
      </ArchivedSection>

      {/* Wizard */}
      <FunctionWizard
        open={wizardOpen}
        onClose={() => { setWizardOpen(false); setEditingFn(null) }}
        editingFn={editingFn}
        onCreated={(fn) => {
          onCreated(fn)
          celebrate(fn.id, `"${fn.name}" created successfully`)
        }}
        onUpdated={(fn) => {
          onUpdated(fn)
          celebrate(fn.id, `"${fn.name}" updated`)
        }}
      />
    </section>
  )
}

// â"€â"€â"€ Archived section toggle â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

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

// â"€â"€â"€ Main view â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

interface Props {
  departments: Department[]
  departmentTree: DepartmentWithChildren[]
  departmentUsage: Record<string, number>
  processesByDept: Record<string, { id: string; name: string; active: boolean }[]>
  functions: EmployeeFunction[]
  functionUsage: Record<string, number>
}

export default function MasterDataView({
  departments: initialDepts,
  departmentTree: initialDeptTree,
  departmentUsage: initialDeptUsage,
  processesByDept,
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

  function handleReparented(deptId: string, fromParentId: string | null, toParentId: string | null) {
    setDeptTree((prev) => {
      let moved: Department | undefined
      let withRemoved: DepartmentWithChildren[]

      if (fromParentId === null) {
        // Was a root — remove from root list
        const root = prev.find((d) => d.id === deptId)
        moved = root
        withRemoved = prev.filter((d) => d.id !== deptId)
      } else {
        // Was a child — remove from its parent
        withRemoved = prev.map((d) => {
          if (d.id !== fromParentId) return d
          moved = d.children.find((c) => c.id === deptId)
          return { ...d, children: d.children.filter((c) => c.id !== deptId) }
        })
      }

      if (!moved) return prev

      if (toParentId === null) {
        // Becoming a root
        return [...withRemoved, { ...moved, parentDepartmentId: null, children: [] } as DepartmentWithChildren]
          .sort((a, b) => a.name.localeCompare(b.name))
      } else {
        // Moving under a new parent
        return withRemoved.map((d) =>
          d.id !== toParentId
            ? d
            : { ...d, children: [...d.children, { ...moved!, parentDepartmentId: toParentId }].sort((a, b) => a.name.localeCompare(b.name)) },
        )
      }
    })
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

  const searchParams = useSearchParams()
  const router = useRouter()
  const rawSection = searchParams.get('section')
  const activeSection: 'departments' | 'functions' =
    rawSection === 'functions' ? 'functions' : 'departments'

  function handleTabChange(section: 'departments' | 'functions') {
    router.replace(`/settings/masterdata?section=${section}`, { scroll: false })
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Master Data</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage departments and employee functions used across the planner.
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {(['departments', 'functions'] as const).map((s) => (
          <button
            key={s}
            onClick={() => handleTabChange(s)}
            className={[
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize',
              activeSection === s
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {s === 'departments' ? 'Departments' : 'Functions'}
          </button>
        ))}
      </div>

      {/* â"€â"€ Departments â"€â"€ */}
      {activeSection === 'departments' && (
      <section>
        <DepartmentGraph
          deptTree={deptTree}
          deptUsage={deptUsage}
          processesByDept={processesByDept}
          onDeptCreated={handleDeptCreated}
          onDeptArchived={handleDeptArchived}
          onDeptDeleted={handleDeptDeleted}
          onDeptUpdated={handleDeptUpdated}
          onChildCreated={handleChildCreated}
          onChildArchived={handleChildArchived}
          onChildDeleted={handleChildDeleted}
          onChildUpdated={handleChildUpdated}
          onReparented={handleReparented}
        />
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
      )}

      {/* â"€â"€ Functions â"€â"€ */}
      {activeSection === 'functions' && (
      <FunctionsSection
        activeFns={activeFns}
        archivedFns={archivedFns}
        fnUsage={fnUsage}
        onCreated={handleFnCreated}
        onArchived={handleFnArchived}
        onDeleted={handleFnDeleted}
        onUpdated={handleFnUpdated}
        onRestored={handleFnRestored}
      />
      )}

    </div>
  )
}


