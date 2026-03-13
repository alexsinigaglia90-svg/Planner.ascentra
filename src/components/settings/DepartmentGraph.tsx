'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Department, DepartmentWithChildren } from '@/lib/queries/locations'
import {
  createDepartmentMdAction,
  createSubdepartmentMdAction,
  updateDepartmentMdAction,
  deleteDepartmentMdAction,
  archiveDepartmentMdAction,
} from '@/app/settings/masterdata/actions'

// ─── Layout constants (unchanged) ─────────────────────────────────────────────

const NODE_W   = 210
const NODE_H   = 66
const ROW_GAP  = 14
const COL_GAP  = 96
const PAD_X    = 20
const PAD_Y    = 24
const STEP     = NODE_H + ROW_GAP
const ROOT_X   = PAD_X
const CHILD_X  = PAD_X + NODE_W + COL_GAP        // 20 + 210 + 96 = 326
const CANVAS_W = CHILD_X + NODE_W + PAD_X         // 326 + 210 + 20 = 556

function rowY(rowIndex: number) {
  return PAD_Y + rowIndex * STEP
}

// ─── Per-node float parameters ────────────────────────────────────────────────
// Deterministic from dept.id — no hydration mismatch.

function floatParams(id: string): { amplitude: number; duration: number; phaseDelay: number } {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  const amplitude  = 1 + (Math.abs(h) % 20) / 10         // 1.0–3.0 px
  const duration   = 8 + (Math.abs(h >> 4) % 40) / 10    // 8.0–12.0 s
  const phase      = (Math.abs(h >> 8) % 100) / 100       // 0.0–1.0
  const phaseDelay = -(duration * phase)                   // negative = start mid-cycle
  return { amplitude, duration, phaseDelay }
}

// ─── Row model (unchanged) ────────────────────────────────────────────────────

type Row =
  | { kind: 'root';      dept: DepartmentWithChildren; index: number }
  | { kind: 'child';     dept: Department; parentId: string; index: number }
  | { kind: 'add-child'; parentId: string; index: number }
  | { kind: 'add-root';  index: number }

function buildRows(tree: DepartmentWithChildren[], addingChildTo: string | null): Row[] {
  const rows: Row[] = []
  let i = 0
  for (const root of tree) {
    rows.push({ kind: 'root', dept: root, index: i++ })
    for (const child of root.children) {
      rows.push({ kind: 'child', dept: child, parentId: root.id, index: i++ })
    }
    if (addingChildTo === root.id) {
      rows.push({ kind: 'add-child', parentId: root.id, index: i++ })
    }
  }
  rows.push({ kind: 'add-root', index: i })
  return rows
}

// ─── SVG edges ────────────────────────────────────────────────────────────────

interface Edge { d: string; parentId: string }

function buildEdges(rows: Row[]): Edge[] {
  const parentY = new Map<string, number>()
  for (const row of rows) {
    if (row.kind === 'root') parentY.set(row.dept.id, rowY(row.index))
  }
  const edges: Edge[] = []
  for (const row of rows) {
    if (row.kind === 'child') {
      const py = parentY.get(row.parentId)
      if (py !== undefined) {
        const x1 = ROOT_X + NODE_W
        const y1 = py + NODE_H / 2
        const x2 = CHILD_X
        const y2 = rowY(row.index) + NODE_H / 2
        const mx = (x1 + x2) / 2
        edges.push({ d: `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`, parentId: row.parentId })
      }
    }
  }
  return edges
}

// ─── DeptNode ─────────────────────────────────────────────────────────────────

interface DeptNodeProps {
  dept: Department
  usage: number
  isRoot: boolean
  x: number
  y: number
  onArchived: () => void
  onDeleted: () => void
  onUpdated: (d: Department) => void
  onAddChild?: () => void
  onHoverChange: (hovered: boolean) => void
}

function DeptNode({ dept, usage, isRoot, x, y, onArchived, onDeleted, onUpdated, onAddChild, onHoverChange }: DeptNodeProps) {
  const [editing, setEditing]         = useState(false)
  const [editName, setEditName]       = useState(dept.name)
  const [editError, setEditError]     = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen]       = useState(false)
  const [savedFlash, setSavedFlash]   = useState(false)
  const [isPending, startTransition]  = useTransition()
  const menuRef = useRef<HTMLDivElement>(null)
  const { amplitude, duration, phaseDelay } = floatParams(dept.id)

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  function saveEdit() {
    setEditError(null)
    startTransition(async () => {
      const res = await updateDepartmentMdAction(dept.id, editName)
      if (!res.ok) { setEditError(res.error); return }
      setEditing(false)
      onUpdated({ ...dept, name: editName.trim() })
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 700)
    })
  }

  function handleArchive() {
    if (!confirm(`Archive "${dept.name}"? It will be hidden from selectors but employees keep their reference.`)) return
    setActionError(null)
    startTransition(async () => {
      const res = await archiveDepartmentMdAction(dept.id)
      if (!res.ok) { setActionError(res.error); return }
      onArchived()
    })
  }

  function handleDelete() {
    if (!confirm(`Permanently delete "${dept.name}"? This cannot be undone.`)) return
    setActionError(null)
    startTransition(async () => {
      const res = await deleteDepartmentMdAction(dept.id)
      if (!res.ok) { setActionError(res.error); return }
      onDeleted()
    })
  }

  return (
    // Outer: absolute position anchor + slow float
    <motion.div
      style={{ position: 'absolute', left: x, top: y, width: NODE_W, zIndex: menuOpen ? 40 : 1 }}
      animate={{ y: [-amplitude, amplitude] }}
      transition={{ repeat: Infinity, repeatType: 'mirror', duration: duration / 2, ease: 'easeInOut', delay: phaseDelay }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      {/* Inner: hover lift */}
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
        className={[
          'relative rounded-2xl border transition-[border-color,box-shadow] duration-200',
          savedFlash
            ? 'border-emerald-300/60 shadow-[0_0_0_3px_rgba(52,211,153,0.16),0_2px_8px_rgba(0,0,0,0.06)] bg-white'
            : isRoot
              ? 'border-gray-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)]'
              : 'border-gray-100 bg-[#f9f9fb] shadow-[0_1px_2px_rgba(0,0,0,0.05)]',
          isPending ? 'opacity-60 pointer-events-none' : '',
        ].join(' ')}
      >
        {/* Left accent bar */}
        <div
          aria-hidden="true"
          className={[
            'absolute left-0 inset-y-0 rounded-l-2xl',
            isRoot ? 'w-[4px] bg-gray-900' : 'w-[3px] bg-gray-300',
          ].join(' ')}
        />

        <div className="px-4 py-3 pr-10">
          <AnimatePresence mode="wait" initial={false}>
            {editing ? (
              <motion.div
                key="edit"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="flex flex-col gap-1.5"
              >
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit()
                    if (e.key === 'Escape') { setEditing(false); setEditName(dept.name); setEditError(null) }
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/15 focus:border-gray-400 w-full transition-[border-color,box-shadow] duration-150"
                />
                {editError && <p className="text-[11px] text-red-500 leading-tight">{editError}</p>}
                <div className="flex gap-1.5">
                  <button
                    onClick={saveEdit}
                    disabled={isPending}
                    className="text-[11px] font-semibold bg-gray-900 text-white rounded-lg px-2.5 py-1 hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    {isPending ? '…' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditing(false); setEditName(dept.name); setEditError(null) }}
                    className="text-[11px] text-gray-500 hover:text-gray-700 rounded-lg px-2 py-1 border border-gray-200 bg-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="display"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
              >
                <p className={[
                  'text-sm truncate leading-snug',
                  isRoot ? 'font-semibold text-gray-900 tracking-[-0.01em]' : 'font-medium text-gray-700',
                ].join(' ')}>
                  {dept.name}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">
                  {usage} {usage !== 1 ? 'employees' : 'employee'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Three-dot menu */}
        {!editing && (
          <div ref={menuRef} className="absolute top-2.5 right-2.5">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Department actions"
              className="flex items-center justify-center h-6 w-6 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100/80 transition-colors duration-150"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                <circle cx="8" cy="2.5"  r="1.5" />
                <circle cx="8" cy="8"    r="1.5" />
                <circle cx="8" cy="13.5" r="1.5" />
              </svg>
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -6 }}
                  transition={{ duration: 0.13, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-gray-100 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.09),0_2px_6px_rgba(0,0,0,0.05)] py-1 z-50 origin-top-right"
                >
                  <button
                    onClick={() => { setEditing(true); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Rename
                  </button>
                  {isRoot && onAddChild && (
                    <button
                      onClick={() => { onAddChild(); setMenuOpen(false) }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50/60 transition-colors"
                    >
                      + Add subdepartment
                    </button>
                  )}
                  <div className="mx-3 my-1 border-t border-gray-100" />
                  <button
                    onClick={() => { handleArchive(); setMenuOpen(false) }}
                    disabled={isPending}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50/50 disabled:opacity-40 transition-colors"
                  >
                    Archive
                  </button>
                  <button
                    onClick={() => { handleDelete(); setMenuOpen(false) }}
                    disabled={isPending}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50/50 disabled:opacity-40 transition-colors"
                  >
                    Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {actionError && (
        <p className="mt-1 px-1 text-[11px] text-red-500">{actionError}</p>
      )}
    </motion.div>
  )
}

// ─── InlineAddForm ────────────────────────────────────────────────────────────

interface InlineAddFormProps {
  label: string
  placeholder: string
  x: number
  y: number
  onSave: (name: string) => Promise<{ ok: true } | { ok: false; error: string }>
  onCancel: () => void
}

function InlineAddForm({ label, placeholder, x, y, onSave, onCancel }: InlineAddFormProps) {
  const [name, setName]     = useState('')
  const [error, setError]   = useState<string | null>(null)
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
      style={{ position: 'absolute', left: x, top: y, width: NODE_W }}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">{label}</p>
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
            <button
              type="submit"
              disabled={isPending}
              className="text-[11px] font-semibold bg-gray-900 text-white rounded-lg px-2.5 py-1.5 hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? '…' : 'Add'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="text-[11px] text-gray-500 hover:text-gray-700 rounded-lg px-2 py-1.5 border border-gray-200 bg-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  )
}

// ─── AddRootButton ────────────────────────────────────────────────────────────

function AddRootButton({ x, y, onClick }: { x: number; y: number; onClick: () => void }) {
  return (
    <motion.div
      style={{ position: 'absolute', left: x, top: y, width: NODE_W }}
      whileHover={{ scale: 1.01, y: -1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <button
        onClick={onClick}
        className="w-full flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-gray-200 bg-transparent text-gray-400 hover:border-gray-300 hover:text-gray-500 hover:bg-gray-50/50 py-3.5 text-[13px] font-medium transition-colors duration-200"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add department
      </button>
    </motion.div>
  )
}

// ─── DepartmentGraph (main export) ───────────────────────────────────────────

export interface DepartmentGraphProps {
  deptTree:        DepartmentWithChildren[]
  deptUsage:       Record<string, number>
  onDeptCreated:   (dept: Department) => void
  onDeptArchived:  (id: string) => void
  onDeptDeleted:   (id: string) => void
  onDeptUpdated:   (updated: Department) => void
  onChildCreated:  (parentId: string, child: Department) => void
  onChildArchived: (parentId: string, childId: string) => void
  onChildDeleted:  (parentId: string, childId: string) => void
  onChildUpdated:  (parentId: string, updated: Department) => void
}

export default function DepartmentGraph({
  deptTree,
  deptUsage,
  onDeptCreated,
  onDeptArchived,
  onDeptDeleted,
  onDeptUpdated,
  onChildCreated,
  onChildArchived,
  onChildDeleted,
  onChildUpdated,
}: DepartmentGraphProps) {
  const [addingChildTo,  setAddingChildTo]  = useState<string | null>(null)
  const [addingRoot,     setAddingRoot]     = useState(false)
  const [hoveredRootId,  setHoveredRootId]  = useState<string | null>(null)

  const rows    = buildRows(deptTree, addingChildTo)
  const edges   = buildEdges(rows)
  const lastRow = rows[rows.length - 1]
  const canvasH = rowY(lastRow.index) + NODE_H + PAD_Y

  // ── Premium empty state ──────────────────────────────────────────────────────
  if (deptTree.length === 0 && !addingRoot) {
    return (
      <div className="py-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-2xl border border-gray-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <svg className="w-[18px] h-[18px] text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 5a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm10 10a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2h-4a2 2 0 01-2-2v-4zM3 15a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 leading-snug">No departments yet</h3>
            <p className="mt-1 text-[13px] text-gray-500 leading-relaxed max-w-[280px]">
              Departments organise your workforce and drive staffing reports. Add your first to get started.
            </p>
          </div>
        </div>
        <motion.button
          onClick={() => setAddingRoot(true)}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-semibold hover:bg-gray-800 transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.14)]"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add first department
        </motion.button>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto -mx-1 px-1 pb-4">
      <div style={{ position: 'relative', width: CANVAS_W, height: canvasH }}>

        {/* ── SVG edge layer ── */}
        <svg
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
          width={CANVAS_W}
          height={canvasH}
          aria-hidden="true"
        >
          {edges.map((e, i) => {
            const highlighted = hoveredRootId === e.parentId
            return (
              <path
                key={i}
                d={e.d}
                fill="none"
                stroke={highlighted ? '#9ca3af' : '#e9eaec'}
                strokeWidth={highlighted ? 1.75 : 1.5}
                strokeLinecap="round"
                style={{ transition: 'stroke 0.2s ease, stroke-width 0.2s ease' }}
              />
            )
          })}
        </svg>

        {/* ── Node / form layer ── */}
        {rows.map((row) => {
          const y = rowY(row.index)

          if (row.kind === 'root') {
            return (
              <DeptNode
                key={row.dept.id}
                dept={row.dept}
                usage={deptUsage[row.dept.id] ?? 0}
                isRoot
                x={ROOT_X}
                y={y}
                onArchived={() => { setAddingChildTo(null); onDeptArchived(row.dept.id) }}
                onDeleted={() => { setAddingChildTo(null); onDeptDeleted(row.dept.id) }}
                onUpdated={onDeptUpdated}
                onAddChild={() => setAddingChildTo((prev) => prev === row.dept.id ? null : row.dept.id)}
                onHoverChange={(hovered) => setHoveredRootId(hovered ? row.dept.id : null)}
              />
            )
          }

          if (row.kind === 'child') {
            return (
              <DeptNode
                key={row.dept.id}
                dept={row.dept}
                usage={deptUsage[row.dept.id] ?? 0}
                isRoot={false}
                x={CHILD_X}
                y={y}
                onArchived={() => onChildArchived(row.parentId, row.dept.id)}
                onDeleted={() => onChildDeleted(row.parentId, row.dept.id)}
                onUpdated={(updated) => onChildUpdated(row.parentId, updated)}
                onHoverChange={(hovered) => setHoveredRootId(hovered ? row.parentId : null)}
              />
            )
          }

          if (row.kind === 'add-child') {
            return (
              <InlineAddForm
                key={`add-child-${row.parentId}`}
                label="New subdepartment"
                placeholder="Subdepartment name"
                x={CHILD_X}
                y={y}
                onSave={async (name) => {
                  const res = await createSubdepartmentMdAction(name, row.parentId)
                  if (res.ok) {
                    onChildCreated(row.parentId, {
                      id: res.id,
                      name: res.name,
                      organizationId: '',
                      archived: false,
                      parentDepartmentId: row.parentId,
                    } as Department)
                    setAddingChildTo(null)
                    return { ok: true }
                  }
                  return res
                }}
                onCancel={() => setAddingChildTo(null)}
              />
            )
          }

          // add-root row
          if (addingRoot) {
            return (
              <InlineAddForm
                key="add-root-form"
                label="New department"
                placeholder="Department name"
                x={ROOT_X}
                y={y}
                onSave={async (name) => {
                  const res = await createDepartmentMdAction(name)
                  if (res.ok) {
                    onDeptCreated({ id: res.id, name: res.name, organizationId: '', archived: false } as Department)
                    setAddingRoot(false)
                    return { ok: true }
                  }
                  return res
                }}
                onCancel={() => setAddingRoot(false)}
              />
            )
          }
          return (
            <AddRootButton
              key="add-root-btn"
              x={ROOT_X}
              y={y}
              onClick={() => setAddingRoot(true)}
            />
          )
        })}
      </div>
    </div>
  )
}
