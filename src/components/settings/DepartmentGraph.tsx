'use client'

import { useState, useTransition, useEffect, useRef, useId } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Department, DepartmentWithChildren } from '@/lib/queries/locations'
import {
  createDepartmentMdAction,
  createSubdepartmentMdAction,
  updateDepartmentMdAction,
  deleteDepartmentMdAction,
  archiveDepartmentMdAction,
} from '@/app/settings/masterdata/actions'

// ─── Types ────────────────────────────────────────────────────────────────────
type ProcessChip = { id: string; name: string; active: boolean }

// ─── Subtle color palette for department groups ──────────────────────────────
const GROUP_PALETTES = [
  { bg: 'bg-blue-50/60',    border: 'border-blue-100',    accent: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-700',    ring: 'ring-blue-200' },
  { bg: 'bg-emerald-50/60', border: 'border-emerald-100', accent: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-200' },
  { bg: 'bg-violet-50/60',  border: 'border-violet-100',  accent: 'bg-violet-500',  badge: 'bg-violet-100 text-violet-700',  ring: 'ring-violet-200' },
  { bg: 'bg-amber-50/60',   border: 'border-amber-100',   accent: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700',   ring: 'ring-amber-200' },
  { bg: 'bg-rose-50/60',    border: 'border-rose-100',    accent: 'bg-rose-500',    badge: 'bg-rose-100 text-rose-700',    ring: 'ring-rose-200' },
  { bg: 'bg-cyan-50/60',    border: 'border-cyan-100',    accent: 'bg-cyan-500',    badge: 'bg-cyan-100 text-cyan-700',    ring: 'ring-cyan-200' },
  { bg: 'bg-orange-50/60',  border: 'border-orange-100',  accent: 'bg-orange-500',  badge: 'bg-orange-100 text-orange-700',  ring: 'ring-orange-200' },
  { bg: 'bg-indigo-50/60',  border: 'border-indigo-100',  accent: 'bg-indigo-500',  badge: 'bg-indigo-100 text-indigo-700',  ring: 'ring-indigo-200' },
]

function paletteForIndex(i: number) {
  return GROUP_PALETTES[i % GROUP_PALETTES.length]
}

// ─── Inline add form (simplified, no absolute positioning) ───────────────────

function InlineAddForm({
  label,
  placeholder,
  onSave,
  onCancel,
}: {
  label: string
  placeholder: string
  onSave: (name: string) => Promise<{ ok: true } | { ok: false; error: string }>
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await onSave(name.trim())
      if (!res.ok) setError(res.error)
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
    >
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-3">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{label}</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
          <input
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onCancel()}
            placeholder={placeholder}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/15 focus:border-gray-400 w-full transition-[border-color,box-shadow] duration-150"
          />
          {error && <p className="text-[11px] text-red-500">{error}</p>}
          <div className="flex gap-1.5 mt-0.5">
            <button type="submit" disabled={isPending} className="text-[11px] font-semibold bg-gray-900 text-white rounded-lg px-2.5 py-1.5 hover:bg-gray-700 disabled:opacity-50 transition-colors">
              {isPending ? '…' : 'Add'}
            </button>
            <button type="button" onClick={onCancel} className="text-[11px] text-gray-500 hover:text-gray-700 rounded-lg px-2 py-1.5 border border-gray-200 bg-white transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  )
}

// ─── Editable name (inline rename) ──────────────────────────────────────────

function EditableName({
  dept,
  onUpdated,
}: {
  dept: Department
  onUpdated: (d: Department) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(dept.name)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSave() {
    const trimmed = editName.trim()
    if (!trimmed || trimmed === dept.name) { setEditing(false); return }
    setError(null)
    startTransition(async () => {
      const res = await updateDepartmentMdAction(dept.id, trimmed)
      if (!res.ok) { setError(res.error); return }
      onUpdated({ ...dept, name: trimmed })
      setEditing(false)
    })
  }

  if (editing) {
    return (
      <form
        onSubmit={(e) => { e.preventDefault(); handleSave() }}
        className="flex items-center gap-1"
      >
        <input
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { setEditing(false); setEditName(dept.name) } }}
          onBlur={handleSave}
          disabled={isPending}
          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/15 w-full"
        />
        {error && <p className="text-[10px] text-red-500 ml-1">{error}</p>}
      </form>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-sm font-semibold text-gray-900 leading-tight truncate hover:text-gray-700 transition-colors text-left"
      title="Click to rename"
    >
      {dept.name}
    </button>
  )
}

// ─── Action menu (archive / delete) ─────────────────────────────────────────

function CardActions({
  dept,
  usage,
  isRoot,
  onArchived,
  onDeleted,
}: {
  dept: Department
  usage: number
  isRoot: boolean
  onArchived: () => void
  onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const menuRef = useRef<HTMLDivElement>(null)
  const btnId = useId()

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleArchive() {
    setOpen(false)
    startTransition(async () => {
      const res = await archiveDepartmentMdAction(dept.id)
      if (res.ok) onArchived()
    })
  }

  function handleDelete() {
    setOpen(false)
    startTransition(async () => {
      const res = await deleteDepartmentMdAction(dept.id)
      if (res.ok) onDeleted()
    })
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        id={btnId}
        onClick={() => setOpen((p) => !p)}
        disabled={isPending}
        aria-label="Department actions"
        className="flex items-center justify-center w-6 h-6 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="8" cy="3" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1 z-50 min-w-[120px] rounded-lg border border-gray-200 bg-white shadow-lg py-1"
          >
            <button
              onClick={handleArchive}
              disabled={isPending}
              className="w-full text-left px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Archive
            </button>
            <button
              onClick={handleDelete}
              disabled={isPending || usage > 0}
              title={usage > 0 ? `${usage} employee${usage !== 1 ? 's' : ''} assigned` : undefined}
              className="w-full text-left px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50/50 disabled:opacity-40 transition-colors"
            >
              Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Success banner (reliable, React-driven) ────────────────────────────────

function SuccessBanner({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 shadow-[0_2px_8px_rgba(16,185,129,0.10)]"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.2, 1] }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="9" fill="#22C55E" opacity="0.9" />
          <motion.path
            d="M6 10.5l2.5 2.5L14 8"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
      </motion.div>
      <span className="text-sm font-medium text-emerald-800">{message}</span>
    </motion.div>
  )
}

// ─── Department Group Card (mind-map node) ───────────────────────────────────

function DeptGroupCard({
  root,
  palette,
  deptUsage,
  processesByDept,
  onDeptArchived,
  onDeptDeleted,
  onDeptUpdated,
  onChildArchived,
  onChildDeleted,
  onChildUpdated,
  onChildCreated,
  addingChildTo,
  onAddChild,
  onCancelAddChild,
  celebratedId,
  onCelebrate,
}: {
  root: DepartmentWithChildren
  palette: typeof GROUP_PALETTES[0]
  deptUsage: Record<string, number>
  processesByDept: Record<string, ProcessChip[]>
  onDeptArchived: (id: string) => void
  onDeptDeleted: (id: string) => void
  onDeptUpdated: (updated: Department) => void
  onChildArchived: (parentId: string, childId: string) => void
  onChildDeleted: (parentId: string, childId: string) => void
  onChildUpdated: (parentId: string, updated: Department) => void
  onChildCreated: (parentId: string, child: Department) => void
  addingChildTo: string | null
  onAddChild: (parentId: string) => void
  onCancelAddChild: () => void
  celebratedId: string | null
  onCelebrate: (id: string) => void
}) {
  const processes = processesByDept[root.id] ?? []
  const isCelebrating = celebratedId === root.id

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
      className={[
        'rounded-2xl border p-4 transition-all duration-300',
        palette.bg,
        palette.border,
        isCelebrating ? `ring-2 ${palette.ring} shadow-[0_0_20px_rgba(34,197,94,0.12)]` : 'shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
      ].join(' ')}
    >
      {/* Parent header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className={`w-1 h-8 rounded-full ${palette.accent} flex-shrink-0`} />
          <div className="min-w-0 flex-1">
            <EditableName
              dept={root}
              onUpdated={(d) => { onCelebrate(d.id); onDeptUpdated(d) }}
            />
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${palette.badge}`}>
                {deptUsage[root.id] ?? 0} employee{(deptUsage[root.id] ?? 0) !== 1 ? 's' : ''}
              </span>
              {processes.length > 0 && (
                <span className="text-[10px] text-gray-400">
                  {processes.length} process{processes.length !== 1 ? 'es' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onAddChild(root.id)}
            title="Add subdepartment"
            className="flex items-center justify-center w-6 h-6 rounded-md text-gray-400 hover:text-gray-600 hover:bg-white/80 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <CardActions
            dept={root}
            usage={deptUsage[root.id] ?? 0}
            isRoot
            onArchived={() => onDeptArchived(root.id)}
            onDeleted={() => onDeptDeleted(root.id)}
          />
        </div>
      </div>

      {/* Children */}
      {root.children.length > 0 && (
        <div className="flex flex-col gap-1.5 ml-3 pl-3 border-l-2 border-gray-200/60">
          {root.children.map((child) => {
            const childCelebrating = celebratedId === child.id
            return (
              <motion.div
                key={child.id}
                layout
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className={[
                  'group flex items-center justify-between gap-2 rounded-lg bg-white/70 border border-gray-100 px-3 py-2 transition-all duration-300',
                  childCelebrating ? `ring-2 ${palette.ring} shadow-[0_0_12px_rgba(34,197,94,0.10)] bg-emerald-50/30` : 'hover:bg-white',
                ].join(' ')}
              >
                <div className="min-w-0 flex-1">
                  <EditableName
                    dept={child}
                    onUpdated={(d) => { onCelebrate(d.id); onChildUpdated(root.id, d) }}
                  />
                  <span className="text-[10px] text-gray-400">
                    {deptUsage[child.id] ?? 0} employee{(deptUsage[child.id] ?? 0) !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <CardActions
                    dept={child}
                    usage={deptUsage[child.id] ?? 0}
                    isRoot={false}
                    onArchived={() => onChildArchived(root.id, child.id)}
                    onDeleted={() => onChildDeleted(root.id, child.id)}
                  />
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Processes (shown as subtle chips) */}
      {processes.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5 ml-3">
          {processes.map((p) => (
            <span
              key={p.id}
              className={[
                'inline-block rounded-md px-2 py-0.5 text-[10px] font-medium',
                p.active ? 'bg-indigo-50 text-indigo-500 border border-indigo-100' : 'bg-gray-50 text-gray-400 border border-gray-100',
              ].join(' ')}
            >
              {p.name}
            </span>
          ))}
        </div>
      )}

      {/* Inline add-child form */}
      <AnimatePresence>
        {addingChildTo === root.id && (
          <div className="mt-2 ml-3">
            <InlineAddForm
              label="New subdepartment"
              placeholder="Subdepartment name"
              onSave={async (name) => {
                const res = await createSubdepartmentMdAction(name, root.id)
                if (res.ok) {
                  onChildCreated(root.id, { id: res.id, name: res.name, organizationId: '', archived: false, parentDepartmentId: root.id } as Department)
                  onCelebrate(res.id)
                  onCancelAddChild()
                  return { ok: true }
                }
                return res
              }}
              onCancel={onCancelAddChild}
            />
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────

export interface DepartmentGraphProps {
  deptTree:        DepartmentWithChildren[]
  deptUsage:       Record<string, number>
  processesByDept: Record<string, ProcessChip[]>
  onDeptCreated:   (dept: Department) => void
  onDeptArchived:  (id: string) => void
  onDeptDeleted:   (id: string) => void
  onDeptUpdated:   (updated: Department) => void
  onChildCreated:  (parentId: string, child: Department) => void
  onChildArchived: (parentId: string, childId: string) => void
  onChildDeleted:  (parentId: string, childId: string) => void
  onChildUpdated:  (parentId: string, updated: Department) => void
  onReparented:    (deptId: string, fromParentId: string | null, toParentId: string | null) => void
}

export default function DepartmentGraph({
  deptTree,
  deptUsage,
  processesByDept,
  onDeptCreated,
  onDeptArchived,
  onDeptDeleted,
  onDeptUpdated,
  onChildCreated,
  onChildArchived,
  onChildDeleted,
  onChildUpdated,
}: DepartmentGraphProps) {
  const [addingChildTo, setAddingChildTo] = useState<string | null>(null)
  const [addingRoot, setAddingRoot] = useState(false)

  // ── Celebration state (React-driven, always reliable) ────────────────────
  const [celebratedId, setCelebratedId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  function celebrate(id: string, message: string) {
    setCelebratedId(id)
    setSuccessMessage(message)
    setTimeout(() => setCelebratedId(null), 2000)
  }

  // ── Count ────────────────────────────────────────────────────────────────
  const totalDepts = deptTree.length
  const totalSubs = deptTree.reduce((n, d) => n + d.children.length, 0)

  return (
    <div>
      {/* ── Header (processes-page style) ──────────────────────────────────── */}
      <div className="flex items-start justify-between gap-6 pb-5 border-b border-[#E6E8F0] mb-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1">
            Workforce setup
          </p>
          <h2 className="text-[22px] font-bold text-gray-900 leading-tight">Departments</h2>
          <p className="mt-1 text-sm text-gray-500">
            Organise your workforce into departments and subdepartments.
            {totalDepts > 0 && (
              <span className="text-gray-400">
                {' · '}{totalDepts} department{totalDepts !== 1 ? 's' : ''}
                {totalSubs > 0 && `, ${totalSubs} sub`}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setAddingRoot(true)}
          className="ds-btn ds-btn-primary ds-btn-sm"
          style={{ flexShrink: 0, marginTop: 4 }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Add Department
        </button>
      </div>

      {/* ── Success banner ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {successMessage && (
          <div className="mb-5">
            <SuccessBanner
              message={successMessage}
              onDone={() => setSuccessMessage(null)}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ── Add root form (top, if active) ─────────────────────────────────── */}
      <AnimatePresence>
        {addingRoot && (
          <div className="mb-5 max-w-sm">
            <InlineAddForm
              label="New department"
              placeholder="Department name"
              onSave={async (name) => {
                const res = await createDepartmentMdAction(name)
                if (res.ok) {
                  onDeptCreated({ id: res.id, name: res.name, organizationId: '', archived: false } as Department)
                  celebrate(res.id, `"${res.name}" created successfully`)
                  setAddingRoot(false)
                  return { ok: true }
                }
                return res
              }}
              onCancel={() => setAddingRoot(false)}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {deptTree.length === 0 && !addingRoot && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl border border-gray-200 bg-white shadow-sm mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 5a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm10 10a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2h-4a2 2 0 01-2-2v-4zM3 15a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4z"
              />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No departments yet</h3>
          <p className="text-[13px] text-gray-500 max-w-[280px] mx-auto mb-5">
            Departments organise your workforce and drive staffing reports. Add your first to get started.
          </p>
          <button
            onClick={() => setAddingRoot(true)}
            className="ds-btn ds-btn-primary ds-btn-sm"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Add first department
          </button>
        </motion.div>
      )}

      {/* ── Mind-map grid ──────────────────────────────────────────────────── */}
      {deptTree.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {deptTree.map((root, i) => (
            <DeptGroupCard
              key={root.id}
              root={root}
              palette={paletteForIndex(i)}
              deptUsage={deptUsage}
              processesByDept={processesByDept}
              onDeptArchived={onDeptArchived}
              onDeptDeleted={onDeptDeleted}
              onDeptUpdated={onDeptUpdated}
              onChildArchived={onChildArchived}
              onChildDeleted={onChildDeleted}
              onChildUpdated={onChildUpdated}
              onChildCreated={onChildCreated}
              addingChildTo={addingChildTo}
              onAddChild={(id) => setAddingChildTo((p) => p === id ? null : id)}
              onCancelAddChild={() => setAddingChildTo(null)}
              celebratedId={celebratedId}
              onCelebrate={(id) => celebrate(id, 'Updated successfully')}
            />
          ))}
        </div>
      )}
    </div>
  )
}
