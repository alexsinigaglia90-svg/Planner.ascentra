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
  reparentDepartmentMdAction,
} from '@/app/settings/masterdata/actions'

// ─── Types ────────────────────────────────────────────────────────────────────
type ProcessChip = { id: string; name: string; active: boolean }

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
  | { kind: 'process';   process: ProcessChip; parentId: string; index: number }
  | { kind: 'add-child'; parentId: string; index: number }
  | { kind: 'add-root';  index: number }

function buildRows(tree: DepartmentWithChildren[], addingChildTo: string | null, processesByDept: Record<string, ProcessChip[]>): Row[] {
  const rows: Row[] = []
  let i = 0
  for (const root of tree) {
    rows.push({ kind: 'root', dept: root, index: i++ })
    for (const child of root.children) {
      rows.push({ kind: 'child', dept: child, parentId: root.id, index: i++ })
    }
    for (const proc of (processesByDept[root.id] ?? [])) {
      rows.push({ kind: 'process', process: proc, parentId: root.id, index: i++ })
    }
    if (addingChildTo === root.id) {
      rows.push({ kind: 'add-child', parentId: root.id, index: i++ })
    }
  }
  rows.push({ kind: 'add-root', index: i })
  return rows
}

// ─── SVG edges ────────────────────────────────────────────────────────────────

interface Edge { d: string; parentId: string; dashed?: boolean }

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
    if (row.kind === 'process') {
      const py = parentY.get(row.parentId)
      if (py !== undefined) {
        const x1 = ROOT_X + NODE_W
        const y1 = py + NODE_H / 2
        const x2 = CHILD_X
        const y2 = rowY(row.index) + NODE_H / 2
        const mx = (x1 + x2) / 2
        edges.push({ d: `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`, parentId: row.parentId, dashed: true })
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

// ─── Card celebration system ─────────────────────────────────────────────────
// Fires a multi-phase celebration from the newly created/updated card's
// viewport position. Works regardless of scroll position.

const CELEBRATE_COLORS = ['#4F6BFF', '#6C83FF', '#22C55E', '#10B981', '#fbbf24', '#ffffff']

function celebrateFromRect(rect: DOMRect): void {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2

  // Phase 1 — expanding ring pulse (border ripple from card)
  const ring = document.createElement('div')
  ring.className = 'ds-card-ring-burst'
  ring.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;border-radius:12px`
  document.body.appendChild(ring)
  ring.addEventListener('animationend', () => ring.remove(), { once: true })

  // Phase 2 — success glow flash behind card
  const glow = document.createElement('div')
  glow.className = 'ds-card-success-glow'
  glow.style.cssText = `left:${cx - 80}px;top:${cy - 50}px;width:160px;height:100px`
  document.body.appendChild(glow)
  glow.addEventListener('animationend', () => glow.remove(), { once: true })

  // Phase 3 — confetti burst from card center (t=80ms)
  setTimeout(() => {
    for (let i = 0; i < 24; i++) {
      const el = document.createElement('div')
      el.className = 'ds-burst-particle'
      const angle = (i / 24) * 2 * Math.PI + (Math.random() - 0.5) * 0.4
      const dist = 55 + Math.random() * 70
      const dx = Math.cos(angle) * dist
      const dy = Math.sin(angle) * dist - 25 // upward bias
      const size = 4 + Math.round(Math.random() * 5)
      const color = CELEBRATE_COLORS[i % CELEBRATE_COLORS.length]
      const radius = Math.random() > 0.4 ? '50%' : '2px'
      el.style.cssText = `left:${cx}px;top:${cy}px;background:${color};width:${size}px;height:${size}px;--dx:${dx}px;--dy:${dy}px;border-radius:${radius};animation-delay:${Math.random() * 60}ms`
      document.body.appendChild(el)
      el.addEventListener('animationend', () => el.remove(), { once: true })
    }
  }, 80)

  // Phase 4 — sparkle stars rising from card edges (t=200ms)
  setTimeout(() => {
    for (let i = 0; i < 10; i++) {
      const el = document.createElement('div')
      el.className = 'ds-sparkle-star'
      const sx = rect.left + Math.random() * rect.width
      const sy = rect.top + Math.random() * rect.height * 0.5
      const dx = (Math.random() - 0.5) * 30
      const dy = -(30 + Math.random() * 50)
      el.style.cssText = `left:${sx}px;top:${sy}px;--dx:${dx}px;--dy:${dy}px;animation-delay:${i * 50}ms`
      document.body.appendChild(el)
      el.addEventListener('animationend', () => el.remove(), { once: true })
    }
  }, 200)

  // Phase 5 — trickle fall from above card (t=400ms)
  setTimeout(() => {
    for (let i = 0; i < 12; i++) {
      const el = document.createElement('div')
      el.className = 'ds-burst-particle-fall'
      const sx = cx + (Math.random() - 0.5) * rect.width * 1.2
      const sy = cy - 40
      const dx = (Math.random() - 0.5) * 20
      const dy = 40 + Math.random() * 50
      const size = 3 + Math.round(Math.random() * 3)
      const color = CELEBRATE_COLORS[i % CELEBRATE_COLORS.length]
      el.style.cssText = `left:${sx}px;top:${sy}px;background:${color};width:${size}px;height:${size}px;--dx:${dx}px;--dy:${dy}px;--dur:${600 + Math.random() * 500}ms;animation-delay:${i * 45}ms`
      document.body.appendChild(el)
      el.addEventListener('animationend', () => el.remove(), { once: true })
    }
  }, 400)

  // Phase 6 — final checkmark overlay on card (t=100ms)
  const check = document.createElement('div')
  check.className = 'ds-card-checkmark'
  check.innerHTML = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" fill="#22C55E" opacity="0.9"/><path d="M10 16.5l4 4 8-8.5" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  check.style.cssText = `left:${cx - 16}px;top:${cy - 16}px`
  document.body.appendChild(check)
  setTimeout(() => check.remove(), 1600)
}

/** Find the department card DOM element and fire a celebration from it. */
function celebrateCard(deptId: string): void {
  if (typeof document === 'undefined') return
  // Allow a brief delay for the DOM to update with the new card
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-dept-id="${deptId}"]`)
    if (el) {
      celebrateFromRect(el.getBoundingClientRect())
    }
  })
}

// ─── ProcessNode ──────────────────────────────────────────────────────────────

function ProcessNode({ process, x, y }: { process: ProcessChip; x: number; y: number }) {
  const { amplitude, duration, phaseDelay } = floatParams(process.id)
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: NODE_W }}>
      <motion.div
        animate={{ y: [-amplitude * 0.7, amplitude * 0.7] }}
        transition={{ repeat: Infinity, repeatType: 'mirror', duration: duration / 2, ease: 'easeInOut', delay: phaseDelay }}
      >
        <div
          className={[
            'relative rounded-2xl border transition-[border-color,box-shadow] duration-200',
            process.active
              ? 'border-indigo-100 bg-white shadow-[0_1px_3px_rgba(99,102,241,0.1),0_1px_2px_rgba(0,0,0,0.04)]'
              : 'border-gray-100 bg-[#f9f9fb] shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
          ].join(' ')}
        >
          <div
            aria-hidden="true"
            className={[
              'absolute left-0 inset-y-0 w-[3px] rounded-l-2xl',
              process.active ? 'bg-indigo-400' : 'bg-gray-200',
            ].join(' ')}
          />
          <div className="px-4 py-3">
            <p title={process.name} className="text-sm font-medium text-gray-700 truncate leading-snug">
              {process.name}
            </p>
            <p className={['text-[11px] mt-0.5 leading-tight', process.active ? 'text-indigo-400' : 'text-gray-400'].join(' ')}>
              {process.active ? 'process' : 'process · inactive'}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
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
  const menuRef   = useRef<HTMLDivElement>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const menuId    = useId()
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
    const warning = isRoot
      ? `Permanently delete "${dept.name}" and all its subdepartments? This cannot be undone.`
      : `Permanently delete "${dept.name}"? This cannot be undone.`
    if (!confirm(warning)) return
    setActionError(null)
    startTransition(async () => {
      const res = await deleteDepartmentMdAction(dept.id)
      if (!res.ok) { setActionError(res.error); return }
      onDeleted()
    })
  }

  // Keyboard: Delete/Backspace on focused node triggers delete
  function handleNodeKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (editing) return
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.defaultPrevented) {
      e.preventDefault()
      handleDelete()
    }
    if (e.key === 'Enter' && !e.defaultPrevented) {
      e.preventDefault()
      setEditing(true)
    }
  }

  return (
    // Outer plain div: absolute position + HTML5 drag source + keyboard focus
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
        data-dept-id={dept.id}
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
          'cursor-default',
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
        tabIndex={0}
        role="treeitem"
        aria-label={`${dept.name}, ${isRoot ? 'department' : 'subdepartment'}, ${usage} ${usage !== 1 ? 'employees' : 'employee'}`}
        aria-expanded={isRoot ? true : undefined}
        onKeyDown={handleNodeKeyDown}
        onFocus={() => onHoverChange(true)}
        onBlur={() => onHoverChange(false)}
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
                    if (e.key === 'Enter') { e.stopPropagation(); saveEdit() }
                    if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); setEditName(dept.name); setEditError(null) }
                  }}
                  aria-label={`Rename ${dept.name}`}
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/15 focus:border-gray-400 w-full transition-[border-color,box-shadow] duration-150"
                />
                {editError && <p role="alert" className="text-[11px] text-red-500 leading-tight">{editError}</p>}
                <div className="flex gap-1.5">
                  <button
                    onClick={saveEdit}
                    disabled={isPending}
                    className="text-[11px] font-semibold bg-gray-900 text-white rounded-lg px-2.5 py-1 hover:bg-gray-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/30"
                  >
                    {isPending ? '…' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditing(false); setEditName(dept.name); setEditError(null) }}
                    className="text-[11px] text-gray-500 hover:text-gray-700 rounded-lg px-2 py-1 border border-gray-200 bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/30"
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
                <p
                  title={dept.name}
                  className={[
                    'text-sm truncate leading-snug',
                    isRoot ? 'font-semibold text-gray-900 tracking-[-0.01em]' : 'font-medium text-gray-700',
                  ].join(' ')}
                >
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
              ref={menuBtnRef}
              onClick={() => setMenuOpen((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setMenuOpen(false); menuBtnRef.current?.blur() }
                if (e.key === 'ArrowDown' && !menuOpen) { e.preventDefault(); setMenuOpen(true) }
              }}
              aria-label={`Actions for ${dept.name}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? menuId : undefined}
              className="flex items-center justify-center h-6 w-6 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/40 transition-colors duration-150"
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
                  id={menuId}
                  role="menu"
                  aria-label={`${dept.name} actions`}
                  initial={{ opacity: 0, scale: 0.94, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -6 }}
                  transition={{ duration: 0.13, ease: [0.16, 1, 0.3, 1] }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setMenuOpen(false); menuBtnRef.current?.focus() }
                  }}
                  className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-gray-100 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.09),0_2px_6px_rgba(0,0,0,0.05)] py-1 z-50 origin-top-right"
                >
                  <button
                    role="menuitem"
                    onClick={() => { setEditing(true); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none transition-colors cursor-pointer"
                  >
                    Rename
                  </button>
                  {isRoot && onAddChild && (
                    <button
                      role="menuitem"
                      onClick={() => { onAddChild(); setMenuOpen(false) }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50/60 focus-visible:bg-indigo-50/60 focus-visible:outline-none transition-colors cursor-pointer"
                    >
                      + Add subdepartment
                    </button>
                  )}
                  <div className="mx-3 my-1 border-t border-gray-100" />
                  <button
                    role="menuitem"
                    onClick={() => { handleArchive(); setMenuOpen(false) }}
                    disabled={isPending}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50/50 focus-visible:bg-amber-50/50 focus-visible:outline-none disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    Archive
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { handleDelete(); setMenuOpen(false) }}
                    disabled={isPending}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50/50 focus-visible:bg-red-50/50 focus-visible:outline-none disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* focus ring — rendered as a pseudo-overlay via box-shadow on the wrapper */}
        <style>{`
          [role="treeitem"]:focus-visible {
            outline: none;
            box-shadow: 0 0 0 3px rgba(99,102,241,0.28), 0 1px 3px rgba(0,0,0,0.07);
          }
        `}</style>
      </motion.div>

      {actionError && (
        <p role="alert" className="mt-1 px-1 text-[11px] text-red-500">{actionError}</p>
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

// ─── DeptListView ─────────────────────────────────────────────────────────────
// Compact hierarchical table. Same actions, no drag/drop.

interface DeptListViewProps {
  deptTree:        DepartmentWithChildren[]
  deptUsage:       Record<string, number>
  processesByDept: Record<string, ProcessChip[]>
  onDeptArchived:  (id: string) => void
  onDeptDeleted:   (id: string) => void
  onDeptUpdated:   (updated: Department) => void
  onChildArchived: (parentId: string, childId: string) => void
  onChildDeleted:  (parentId: string, childId: string) => void
  onChildUpdated:  (parentId: string, updated: Department) => void
  onAddChild:      (parentId: string) => void
  addingChildTo:   string | null
  onChildCreated:  (parentId: string, child: Department) => void
  onCancelAddChild: () => void
  addingRoot:      boolean
  onDeptCreated:   (dept: Department) => void
  onStartAddRoot:  () => void
  onCancelAddRoot: () => void
  justCreatedIds:  Set<string>
  markCreated:     (id: string) => void
}

function ListRowActions({
  dept,
  isRoot,
  usage,
  onArchived,
  onDeleted,
  onUpdated,
  onAddChild,
  isPending,
  setEditing,
}: {
  dept: Department
  isRoot: boolean
  usage: number
  onArchived: () => void
  onDeleted: () => void
  onUpdated: (d: Department) => void
  onAddChild?: () => void
  isPending: boolean
  setEditing: (v: boolean) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!menuOpen) return
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  function handleArchive() {
    if (!confirm(`Archive "${dept.name}"? It will be hidden from selectors but employees keep their reference.`)) return
    onArchived()
  }
  function handleDelete() {
    const warning = isRoot
      ? `Permanently delete "${dept.name}" and all its subdepartments? This cannot be undone.`
      : `Permanently delete "${dept.name}"? This cannot be undone.`
    if (!confirm(warning)) return
    onDeleted()
  }

  return (
    <div ref={menuRef} className="relative flex-shrink-0">
      <button
        ref={menuBtnRef}
        onClick={() => setMenuOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setMenuOpen(false); menuBtnRef.current?.blur() }
          if (e.key === 'ArrowDown' && !menuOpen) { e.preventDefault(); setMenuOpen(true) }
        }}
        aria-label={`Actions for ${dept.name}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        disabled={isPending}
        className="flex items-center justify-center h-6 w-6 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/40 disabled:opacity-40 transition-colors duration-150 cursor-pointer"
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
            id={menuId}
            role="menu"
            aria-label={`${dept.name} actions`}
            initial={{ opacity: 0, scale: 0.94, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -6 }}
            transition={{ duration: 0.13, ease: [0.16, 1, 0.3, 1] }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setMenuOpen(false); menuBtnRef.current?.focus() }
            }}
            className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-gray-100 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.09),0_2px_6px_rgba(0,0,0,0.05)] py-1 z-50 origin-top-right"
          >
            <button role="menuitem" onClick={() => { setEditing(true); setMenuOpen(false) }}
              className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none transition-colors cursor-pointer">
              Rename
            </button>
            {isRoot && onAddChild && (
              <button role="menuitem" onClick={() => { onAddChild(); setMenuOpen(false) }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50/60 focus-visible:bg-indigo-50/60 focus-visible:outline-none transition-colors cursor-pointer">
                + Add subdepartment
              </button>
            )}
            <div className="mx-3 my-1 border-t border-gray-100" />
            <button role="menuitem" onClick={() => { handleArchive(); setMenuOpen(false) }} disabled={isPending}
              className="w-full text-left px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50/50 focus-visible:bg-amber-50/50 focus-visible:outline-none disabled:opacity-40 transition-colors cursor-pointer">
              Archive
            </button>
            <button role="menuitem" onClick={() => { handleDelete(); setMenuOpen(false) }} disabled={isPending}
              className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50/50 focus-visible:bg-red-50/50 focus-visible:outline-none disabled:opacity-40 transition-colors cursor-pointer">
              Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ListRow({
  dept,
  isRoot,
  usage,
  onArchived,
  onDeleted,
  onUpdated,
  onAddChild,
  isExpanded,
  onToggleExpand,
  justCreated,
  processes,
}: {
  dept: Department
  isRoot: boolean
  usage: number
  onArchived: () => void
  onDeleted: () => void
  onUpdated: (d: Department) => void
  onAddChild?: () => void
  isExpanded?: boolean
  onToggleExpand?: () => void
  justCreated?: boolean
  processes: ProcessChip[]
}) {
  const [editing, setEditing]       = useState(false)
  const [editName, setEditName]     = useState(dept.name)
  const [editError, setEditError]   = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const [isPending, startTransition] = useTransition()

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

  function handleArchived() {
    startTransition(async () => {
      const res = await archiveDepartmentMdAction(dept.id)
      if (!res.ok) { setActionError(res.error); return }
      onArchived()
    })
  }

  function handleDeleted() {
    startTransition(async () => {
      const res = await deleteDepartmentMdAction(dept.id)
      if (!res.ok) { setActionError(res.error); return }
      onDeleted()
    })
  }

  return (
    <motion.div
      layout
      data-dept-id={dept.id}
      initial={justCreated ? { opacity: 0, x: -8 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={[
        'group flex items-center gap-2 px-3 py-2.5 rounded-xl transition-[background-color,box-shadow] duration-150',
        isRoot ? 'bg-white border border-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)]' : 'ml-7 bg-[#f9f9fb] border border-gray-100',
        savedFlash ? 'border-emerald-300/60 bg-emerald-50/20 shadow-[0_0_0_2px_rgba(52,211,153,0.14)]' : '',
        'hover:bg-gray-50/60',
        'focus-within:bg-gray-50/40',
      ].join(' ')}
    >
      {/* Expand/collapse toggle for root rows */}
      {isRoot && onToggleExpand !== undefined ? (
        <button
          onClick={onToggleExpand}
          aria-label={isExpanded ? `Collapse ${dept.name}` : `Expand ${dept.name}`}
          className="flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/40 transition-colors cursor-pointer"
        >
          <svg className={['h-3 w-3 transition-transform duration-200', isExpanded ? 'rotate-90' : ''].join(' ')} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      ) : (
        <span aria-hidden="true" className="flex-shrink-0 ml-5 w-1 h-1 rounded-full bg-gray-300" />
      )}

      {/* Left accent */}
      <span aria-hidden="true" className={['flex-shrink-0 w-0.5 h-6 rounded-full', isRoot ? 'bg-gray-900' : 'bg-gray-300'].join(' ')} />

      {/* Name / edit */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex flex-col gap-1">
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.stopPropagation(); saveEdit() }
                if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); setEditName(dept.name); setEditError(null) }
              }}
              aria-label={`Rename ${dept.name}`}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/15 focus:border-gray-400 w-full transition-[border-color,box-shadow] duration-150"
            />
            {editError && <p role="alert" className="text-[10px] text-red-500">{editError}</p>}
            <div className="flex gap-1">
              <button onClick={saveEdit} disabled={isPending}
                className="text-[10px] font-semibold bg-gray-900 text-white rounded-md px-2 py-0.5 hover:bg-gray-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/30">
                {isPending ? '…' : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setEditName(dept.name); setEditError(null) }}
                className="text-[10px] text-gray-500 hover:text-gray-700 rounded-md px-1.5 py-0.5 border border-gray-200 bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/30">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p title={dept.name} className={['text-sm truncate leading-snug', isRoot ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'].join(' ')}>
              {dept.name}
            </p>
            <p className="text-[11px] text-gray-400 leading-tight">
              {usage} {usage !== 1 ? 'employees' : 'employee'}
            </p>
            {processes.length > 0 && (
              <div className="flex flex-wrap gap-[3px] mt-1">
                {processes.slice(0, 3).map((p) => (
                  <span
                    key={p.id}
                    title={p.name}
                    className={[
                      'inline-block max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap rounded px-1 py-px text-[9px] font-medium',
                      p.active ? 'bg-gray-100 text-gray-600' : 'bg-gray-50 text-gray-400',
                    ].join(' ')}
                  >
                    {p.name}
                  </span>
                ))}
                {processes.length > 3 && (
                  <span className="inline-block rounded bg-gray-100 px-1 py-px text-[9px] font-medium text-gray-400">
                    +{processes.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
        {actionError && <p role="alert" className="text-[10px] text-red-500 mt-0.5">{actionError}</p>}
      </div>

      {/* Actions — only visible on hover / focus-within */}
      {!editing && (
        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">
          <ListRowActions
            dept={dept}
            isRoot={isRoot}
            usage={usage}
            onArchived={handleArchived}
            onDeleted={handleDeleted}
            onUpdated={onUpdated}
            onAddChild={onAddChild}
            isPending={isPending}
            setEditing={setEditing}
          />
        </div>
      )}
    </motion.div>
  )
}

function DeptListView({
  deptTree, deptUsage, processesByDept,
  onDeptArchived, onDeptDeleted, onDeptUpdated,
  onChildArchived, onChildDeleted, onChildUpdated,
  onAddChild, addingChildTo, onChildCreated, onCancelAddChild,
  addingRoot, onDeptCreated, onStartAddRoot, onCancelAddRoot,
  justCreatedIds, markCreated,
}: DeptListViewProps) {

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
    new Set(deptTree.map((d) => d.id))          // start all expanded
  )

  // expand a newly created root automatically
  useEffect(() => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      for (const d of deptTree) next.add(d.id)
      return next
    })
  }, [deptTree])

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  if (deptTree.length === 0 && !addingRoot) {
    return (
      <div className="py-4">
        <p className="text-sm text-gray-400 mb-3">No departments yet.</p>
        <button
          onClick={onStartAddRoot}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/40"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add department
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {deptTree.map((root) => {
        const expanded = expandedIds.has(root.id)
        return (
          <div key={root.id} className="flex flex-col gap-1">
            <ListRow
              dept={root}
              isRoot
              usage={deptUsage[root.id] ?? 0}
              onArchived={() => onDeptArchived(root.id)}
              onDeleted={() => onDeptDeleted(root.id)}
              onUpdated={(d) => { celebrateCard(d.id); onDeptUpdated(d) }}
              onAddChild={() => onAddChild(root.id)}
              isExpanded={expanded}
              onToggleExpand={() => toggleExpand(root.id)}
              justCreated={justCreatedIds.has(root.id)}
              processes={processesByDept[root.id] ?? []}
            />
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  key="children"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden flex flex-col gap-1"
                >
                  {root.children.map((child) => (
                    <ListRow
                      key={child.id}
                      dept={child}
                      isRoot={false}
                      usage={deptUsage[child.id] ?? 0}
                      onArchived={() => onChildArchived(root.id, child.id)}
                      onDeleted={() => onChildDeleted(root.id, child.id)}
                      onUpdated={(updated) => { celebrateCard(updated.id); onChildUpdated(root.id, updated) }}
                      justCreated={justCreatedIds.has(child.id)}
                      processes={processesByDept[child.id] ?? []}
                    />
                  ))}
                  {/* Inline add-child form */}
                  {addingChildTo === root.id && (
                    <div className="ml-7 rounded-xl border border-dashed border-gray-200 bg-white p-3">
                      <ListInlineAddForm
                        label="New subdepartment"
                        placeholder="Subdepartment name"
                        onSave={async (name) => {
                          const res = await createSubdepartmentMdAction(name, root.id)
                          if (res.ok) {
                            onChildCreated(root.id, { id: res.id, name: res.name, organizationId: '', archived: false, parentDepartmentId: root.id } as Department)
                            markCreated(res.id)
                            celebrateCard(res.id)
                            onCancelAddChild()
                            return { ok: true }
                          }
                          return res
                        }}
                        onCancel={onCancelAddChild}
                      />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}

      {/* Add root inline form / button */}
      {addingRoot ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-3 mt-1">
          <ListInlineAddForm
            label="New department"
            placeholder="Department name"
            onSave={async (name) => {
              const res = await createDepartmentMdAction(name)
              if (res.ok) {
                onDeptCreated({ id: res.id, name: res.name, organizationId: '', archived: false } as Department)
                markCreated(res.id)
                celebrateCard(res.id)
                onCancelAddRoot()
                return { ok: true }
              }
              return res
            }}
            onCancel={onCancelAddRoot}
          />
        </div>
      ) : (
        <button
          onClick={onStartAddRoot}
          className="flex items-center gap-1.5 mt-1 text-[13px] font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-50/60 rounded-xl px-3 py-2.5 border border-dashed border-gray-200 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/40 w-full justify-center"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add department
        </button>
      )}
    </div>
  )
}

function ListInlineAddForm({
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
  const [name, setName]   = useState('')
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
      <input
        autoFocus
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
        placeholder={placeholder}
        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/15 focus:border-gray-400 w-full transition-[border-color,box-shadow] duration-150"
      />
      {error && <p role="alert" className="text-[11px] text-red-500">{error}</p>}
      <div className="flex gap-1.5">
        <button type="submit" disabled={isPending}
          className="text-[11px] font-semibold bg-gray-900 text-white rounded-lg px-2.5 py-1.5 hover:bg-gray-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/30">
          {isPending ? '…' : 'Add'}
        </button>
        <button type="button" onClick={onCancel}
          className="text-[11px] text-gray-500 hover:text-gray-700 rounded-lg px-2 py-1.5 border border-gray-200 bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/30">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── DepartmentGraph (main export) ───────────────────────────────────────────

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
  onReparented,
}: DepartmentGraphProps) {
  const [viewMode,       setViewMode]       = useState<'graph' | 'list'>('graph')
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
    celebrateCard(captured.deptId)
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

  const rows    = buildRows(deptTree, addingChildTo, processesByDept)
  const edges   = buildEdges(rows)
  const lastRow = rows[rows.length - 1]

  // Extra canvas height when the "promote to root" drop zone is visible
  const showPromoteZone = dragState !== null
  const canvasH = rowY(lastRow.index) + NODE_H + PAD_Y + (showPromoteZone ? STEP + 12 : 0)

  // ── View toggle header ────────────────────────────────────────────────────
  const toggleHeader = (
    <div className="flex items-center justify-between mb-4">
      <p className="text-[11px] text-gray-400 font-medium">
        {deptTree.length} {deptTree.length === 1 ? 'department' : 'departments'}
        {deptTree.reduce((n, d) => n + d.children.length, 0) > 0 &&
          `, ${deptTree.reduce((n, d) => n + d.children.length, 0)} subdepartments`}
      </p>
      <div
        role="group"
        aria-label="View mode"
        className="flex gap-0.5 bg-gray-100 rounded-xl p-0.5"
      >
        {(['graph', 'list'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            aria-pressed={viewMode === mode}
            aria-label={`${mode === 'graph' ? 'Graph' : 'List'} view`}
            className={[
              'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/40',
              viewMode === mode
                ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
                : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {mode === 'graph' ? (
              <>
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="2" y="3" width="7" height="7" rx="1.5" strokeWidth={2} />
                  <rect x="15" y="3" width="7" height="7" rx="1.5" strokeWidth={2} />
                  <rect x="15" y="14" width="7" height="7" rx="1.5" strokeWidth={2} />
                  <path d="M9 6.5h3.5a2.5 2.5 0 012.5 2.5v2.5" strokeWidth={2} strokeLinecap="round" />
                </svg>
                Graph
              </>
            ) : (
              <>
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                List
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  )

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

  // ── List view ────────────────────────────────────────────────────────────────
  if (viewMode === 'list') {
    return (
      <div>
        {toggleHeader}
        <DeptListView
          deptTree={deptTree}
          deptUsage={deptUsage}
          processesByDept={processesByDept}
          onDeptArchived={onDeptArchived}
          onDeptDeleted={onDeptDeleted}
          onDeptUpdated={onDeptUpdated}
          onChildArchived={onChildArchived}
          onChildDeleted={onChildDeleted}
          onChildUpdated={onChildUpdated}
          onAddChild={(parentId) => setAddingChildTo((prev) => prev === parentId ? null : parentId)}
          addingChildTo={addingChildTo}
          onChildCreated={onChildCreated}
          onCancelAddChild={() => setAddingChildTo(null)}
          addingRoot={addingRoot}
          onDeptCreated={onDeptCreated}
          onStartAddRoot={() => setAddingRoot(true)}
          onCancelAddRoot={() => setAddingRoot(false)}
          justCreatedIds={justCreatedIds}
          markCreated={markCreated}
        />
      </div>
    )
  }

  return (
    <div>
      {toggleHeader}
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
                strokeDasharray={e.dashed ? '5 3' : undefined}
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
                onUpdated={(d) => { celebrateCard(d.id); onDeptUpdated(d) }}
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
                onUpdated={(updated) => { celebrateCard(updated.id); onChildUpdated(row.parentId, updated) }}
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

          if (row.kind === 'process') {
            return (
              <ProcessNode
                key={`proc-${row.process.id}`}
                process={row.process}
                x={CHILD_X}
                y={y}
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
                    celebrateCard(res.id)
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
                    celebrateCard(res.id)
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
    </div>
  )
}
