'use client'

import { useState, useTransition, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Department, DepartmentWithChildren } from '@/lib/queries/locations'
import {
  createDepartmentMdAction,
  createSubdepartmentMdAction,
  updateDepartmentMdAction,
  deleteDepartmentMdAction,
  archiveDepartmentMdAction,
  reparentDepartmentMdAction,
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

// ─── DragState ────────────────────────────────────────────────────────────────

interface DragState {
  deptId: string
  fromParentId: string   // children only in Phase 3
}

// ─── Forklift micro-animation ────────────────────────────────────────────────
// Appears briefly during any structural action. Non-blocking, tasteful.

function ForkLiftCue({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          aria-hidden="true"
          initial={{ x: -56, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 72, opacity: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: 'absolute', top: 6, left: PAD_X + NODE_W + 18, zIndex: 50, pointerEvents: 'none' }}
        >
          {/* forklift body */}
          <svg width="36" height="28" viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* forks */}
            <rect x="0" y="17" width="12" height="2" rx="1" fill="#6b7280"/>
            <rect x="0" y="21" width="12" height="2" rx="1" fill="#6b7280"/>
            {/* mast */}
            <rect x="11" y="8" width="2" height="16" rx="1" fill="#9ca3af"/>
            {/* body */}
            <rect x="12" y="14" width="18" height="10" rx="2" fill="#374151"/>
            {/* cab */}
            <rect x="20" y="10" width="10" height="8" rx="1.5" fill="#4b5563"/>
            {/* window */}
            <rect x="22" y="12" width="6" height="4" rx="1" fill="#e0f2fe" opacity="0.85"/>
            {/* wheels */}
            <circle cx="17" cy="25" r="3" fill="#1f2937"/>
            <circle cx="17" cy="25" r="1.5" fill="#6b7280"/>
            <circle cx="27" cy="25" r="3" fill="#1f2937"/>
            <circle cx="27" cy="25" r="1.5" fill="#6b7280"/>
            {/* box on forks */}
            <motion.g
              animate={{ y: [0, -1, 0] }}
              transition={{ repeat: Infinity, repeatType: 'mirror', duration: 0.6, ease: 'easeInOut' }}
            >
              <rect x="1" y="9" width="10" height="8" rx="1.5" fill="#fbbf24" opacity="0.9"/>
              {/* box lines */}
              <line x1="6" y1="9" x2="6" y2="17" stroke="#f59e0b" strokeWidth="0.8"/>
              <line x1="1" y1="13" x2="11" y2="13" stroke="#f59e0b" strokeWidth="0.8"/>
            </motion.g>
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  )
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
  // Phase 3 — drag/drop
  isDraggable?: boolean
  isBeingDragged?: boolean
  isActiveDrop?: boolean
  onDragStart?: () => void
  onDragEnd?: () => void
  onDragOver?: () => void
  onDragLeave?: () => void
  onDrop?: () => void
  // Phase 4 — feedback
  justCreated?: boolean
  justReparented?: boolean
}

function DeptNode({ dept, usage, isRoot, x, y, onArchived, onDeleted, onUpdated, onAddChild, onHoverChange, isDraggable, isBeingDragged, isActiveDrop, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop, justCreated, justReparented }: DeptNodeProps) {
  const [editing, setEditing]           = useState(false)
  const [editName, setEditName]         = useState(dept.name)
  const [editError, setEditError]       = useState<string | null>(null)
  const [actionError, setActionError]   = useState<string | null>(null)
  const [menuOpen, setMenuOpen]         = useState(false)
  const [savedFlash, setSavedFlash]     = useState(false)
  const [archiveFlash, setArchiveFlash] = useState(false)
  const [isPending, startTransition]    = useTransition()
  const menuRef = useRef<HTMLDivElement>(null)
  const { amplitude, duration, phaseDelay } = floatParams(dept.id)

  // justCreated / justReparented: brief entrance glow on first render
  const glowFlash = justCreated || justReparented

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
      setTimeout(() => setSavedFlash(false), 1400)
    })
  }

  function handleArchive() {
    if (!confirm(`Archive "${dept.name}"? It will be hidden from selectors but employees keep their reference.`)) return
    setActionError(null)
    setArchiveFlash(true)
    setTimeout(() => {
      setArchiveFlash(false)
      startTransition(async () => {
        const res = await archiveDepartmentMdAction(dept.id)
        if (!res.ok) { setActionError(res.error); return }
        onArchived()
      })
    }, 500)
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
    // Outer plain div: absolute position + HTML5 drag source
    <div
      style={{ position: 'absolute', left: x, top: y, width: NODE_W, zIndex: menuOpen ? 40 : 1 }}
      draggable={isDraggable}
      onDragStart={isDraggable ? (e: React.DragEvent) => { e.dataTransfer.effectAllowed = 'move'; onDragStart?.() } : undefined}
      onDragEnd={isDraggable ? () => onDragEnd?.() : undefined}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      {/* Float animation wrapper */}
      <motion.div
        animate={{ y: [-amplitude, amplitude] }}
        transition={{ repeat: Infinity, repeatType: 'mirror', duration: duration / 2, ease: 'easeInOut', delay: phaseDelay }}
      >
      {/* Inner: hover lift + drop target highlight */}
      <motion.div
        initial={glowFlash ? { scale: 0.96, opacity: 0 } : false}
        animate={glowFlash ? { scale: 1, opacity: 1 } : {}}
        transition={glowFlash ? { type: 'spring', stiffness: 380, damping: 26, duration: 0.4 } : {}}
        whileHover={{ y: -2 }}
        style={{ transition: undefined }}
        onDragOver={isActiveDrop !== undefined ? (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDragOver?.() } : undefined}
        onDragLeave={isActiveDrop !== undefined ? () => onDragLeave?.() : undefined}
        onDrop={isActiveDrop !== undefined ? (e: React.DragEvent) => { e.preventDefault(); onDrop?.() } : undefined}
        className={[
          'relative rounded-2xl border transition-[border-color,box-shadow,background-color,opacity] duration-200',
          isBeingDragged
            ? 'opacity-40 scale-[0.97]'
            : isActiveDrop
              ? 'border-indigo-400 shadow-[0_0_0_4px_rgba(99,102,241,0.18),0_2px_12px_rgba(0,0,0,0.08)] bg-indigo-50/40 scale-[1.015]'
              : archiveFlash
                ? 'border-amber-300/70 shadow-[0_0_0_3px_rgba(251,191,36,0.16)] bg-amber-50/40'
                : glowFlash
                  ? 'border-emerald-300/70 shadow-[0_0_0_4px_rgba(52,211,153,0.18),0_2px_10px_rgba(0,0,0,0.06)] bg-emerald-50/30'
                  : savedFlash
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
            'absolute left-0 inset-y-0 rounded-l-2xl transition-colors duration-200',
            isActiveDrop
              ? 'w-[4px] bg-indigo-400'
              : archiveFlash
                ? 'w-[4px] bg-amber-400'
                : glowFlash || savedFlash
                  ? 'w-[4px] bg-emerald-400'
                  : isRoot
                    ? 'w-[4px] bg-gray-900'
                    : 'w-[3px] bg-gray-300',
          ].join(' ')}
        />

        <div className="px-4 py-3 pr-10">
          <AnimatePresence mode="wait" initial={false}>
            {editing ? (
              <motion.div
                key="edit"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
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
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
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
    </div>
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
      initial={{ opacity: 0, y: -10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
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
  onReparented:    (deptId: string, fromParentId: string | null, toParentId: string | null) => void
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
  onReparented,
}: DepartmentGraphProps) {
  const [addingChildTo,  setAddingChildTo]  = useState<string | null>(null)
  const [addingRoot,     setAddingRoot]     = useState(false)
  const [hoveredRootId,  setHoveredRootId]  = useState<string | null>(null)

  // ── Phase 3: drag/drop state ──────────────────────────────────────────────
  const [dragState,     setDragState]     = useState<DragState | null>(null)
  const [dropTargetId,  setDropTargetId]  = useState<string | 'root' | null>(null)
  const [reparentError, setReparentError] = useState<string | null>(null)
  const [reparentPending, startReparentTransition] = useTransition()

  // ── Phase 4: micro-experience state ──────────────────────────────────────
  const [justCreatedIds,   setJustCreatedIds]   = useState<Set<string>>(new Set())
  const [justReparentedId, setJustReparentedId] = useState<string | null>(null)
  const [forkLiftVisible,  setForkLiftVisible]  = useState(false)

  const showForklift = useCallback(() => {
    setForkLiftVisible(true)
    setTimeout(() => setForkLiftVisible(false), 1200)
  }, [])

  function markCreated(id: string) {
    setJustCreatedIds((prev) => new Set(prev).add(id))
    setTimeout(() => setJustCreatedIds((prev) => { const n = new Set(prev); n.delete(id); return n }), 1600)
  }

  function handleDrop(targetId: string | 'root') {
    if (!dragState) return
    const newParentId = targetId === 'root' ? null : targetId
    // No-op: same parent
    if (newParentId === dragState.fromParentId) {
      setDragState(null)
      setDropTargetId(null)
      return
    }
    setDropTargetId(null)
    const captured = dragState
    showForklift()
    startReparentTransition(async () => {
      const res = await reparentDepartmentMdAction(captured.deptId, newParentId)
      if (!res.ok) {
        setReparentError(res.error)
        setTimeout(() => setReparentError(null), 4000)
      } else {
        onReparented(captured.deptId, captured.fromParentId, newParentId)
        setJustReparentedId(captured.deptId)
        setTimeout(() => setJustReparentedId(null), 1600)
      }
      setDragState(null)
    })
  }

  const rows    = buildRows(deptTree, addingChildTo)
  const edges   = buildEdges(rows)
  const lastRow = rows[rows.length - 1]

  // Extra canvas height when the "promote to root" drop zone is visible
  const showPromoteZone = dragState !== null
  const canvasH = rowY(lastRow.index) + NODE_H + PAD_Y + (showPromoteZone ? STEP + 12 : 0)

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
      {reparentError && (
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="mb-3 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
        >
          {reparentError}
        </motion.p>
      )}
      <div style={{ position: 'relative', width: CANVAS_W, height: canvasH }}>

        {/* ── Forklift micro-animation ── */}
        <ForkLiftCue visible={forkLiftVisible} />

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
            // A root is a valid drop target only when a child is being dragged and it's not the current parent
            const isValidDrop = dragState !== null && dragState.fromParentId !== row.dept.id
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
                onUpdated={(d) => { showForklift(); onDeptUpdated(d) }}
                onAddChild={() => setAddingChildTo((prev) => prev === row.dept.id ? null : row.dept.id)}
                onHoverChange={(hovered) => setHoveredRootId(hovered ? row.dept.id : null)}
                isActiveDrop={isValidDrop ? dropTargetId === row.dept.id : undefined}
                onDragOver={isValidDrop ? () => setDropTargetId(row.dept.id) : undefined}
                onDragLeave={isValidDrop ? () => setDropTargetId((p) => p === row.dept.id ? null : p) : undefined}
                onDrop={isValidDrop ? () => handleDrop(row.dept.id) : undefined}
                justCreated={justCreatedIds.has(row.dept.id)}
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
                onUpdated={(updated) => { showForklift(); onChildUpdated(row.parentId, updated) }}
                onHoverChange={(hovered) => setHoveredRootId(hovered ? row.parentId : null)}
                isDraggable={!reparentPending}
                isBeingDragged={dragState?.deptId === row.dept.id}
                onDragStart={() => setDragState({ deptId: row.dept.id, fromParentId: row.parentId })}
                onDragEnd={() => { setDragState(null); setDropTargetId(null) }}
                justCreated={justCreatedIds.has(row.dept.id)}
                justReparented={justReparentedId === row.dept.id}
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
                    const newDept: Department = {
                      id: res.id,
                      name: res.name,
                      organizationId: '',
                      archived: false,
                      parentDepartmentId: row.parentId,
                    } as Department
                    onChildCreated(row.parentId, newDept)
                    markCreated(res.id)
                    showForklift()
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
                    markCreated(res.id)
                    showForklift()
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

        {/* ── Promote-to-root drop zone (visible during any child drag) ── */}
        <AnimatePresence>
          {showPromoteZone && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              style={{
                position: 'absolute',
                left: ROOT_X,
                top: rowY(lastRow.index) + NODE_H + PAD_Y,
                width: NODE_W,
              }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTargetId('root') }}
              onDragLeave={() => setDropTargetId((p) => p === 'root' ? null : p)}
              onDrop={(e) => { e.preventDefault(); handleDrop('root') }}
              className={[
                'flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-3.5 text-[12px] font-medium transition-[border-color,background-color,box-shadow,color] duration-150',
                dropTargetId === 'root'
                  ? 'border-indigo-400 bg-indigo-50/50 text-indigo-600 shadow-[0_0_0_3px_rgba(99,102,241,0.14)]'
                  : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500',
              ].join(' ')}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7 7 7M5 19l7-7 7 7" />
              </svg>
              Make top-level department
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
