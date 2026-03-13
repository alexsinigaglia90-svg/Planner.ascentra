'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import type { Department, DepartmentWithChildren } from '@/lib/queries/locations'
import {
  createDepartmentMdAction,
  createSubdepartmentMdAction,
  updateDepartmentMdAction,
  deleteDepartmentMdAction,
  archiveDepartmentMdAction,
} from '@/app/settings/masterdata/actions'

// ─── Layout constants ─────────────────────────────────────────────────────────

const NODE_W  = 210
const NODE_H  = 66
const ROW_GAP = 14
const COL_GAP = 96
const PAD_X   = 20
const PAD_Y   = 24
const STEP    = NODE_H + ROW_GAP
const ROOT_X  = PAD_X
const CHILD_X = PAD_X + NODE_W + COL_GAP        // 20 + 210 + 96 = 326
const CANVAS_W = CHILD_X + NODE_W + PAD_X        // 326 + 210 + 20 = 556

function rowY(rowIndex: number) {
  return PAD_Y + rowIndex * STEP
}

// ─── Row model ────────────────────────────────────────────────────────────────

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

interface Edge { d: string }

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
        edges.push({ d: `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}` })
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
  onAddChild?: () => void   // root only
}

function DeptNode({ dept, usage, isRoot, x, y, onArchived, onDeleted, onUpdated, onAddChild }: DeptNodeProps) {
  const [editing, setEditing]         = useState(false)
  const [editName, setEditName]       = useState(dept.name)
  const [editError, setEditError]     = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen]       = useState(false)
  const [isPending, startTransition]  = useTransition()
  const menuRef = useRef<HTMLDivElement>(null)

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

  const accent = isRoot
    ? 'before:bg-gray-800'
    : 'before:bg-gray-300'

  return (
    <div
      style={{ position: 'absolute', left: x, top: y, width: NODE_W, zIndex: menuOpen ? 40 : 1 }}
    >
      {/* Card */}
      <div
        className={[
          'relative rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden',
          'before:absolute before:left-0 before:inset-y-0 before:w-[3px]',
          accent,
          isPending ? 'opacity-60' : '',
        ].join(' ')}
      >
        <div className="px-3.5 py-2.5 pr-9">
          {editing ? (
            <div className="flex flex-col gap-1.5">
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit()
                  if (e.key === 'Escape') { setEditing(false); setEditName(dept.name); setEditError(null) }
                }}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 w-full"
              />
              {editError && <p className="text-[11px] text-red-500">{editError}</p>}
              <div className="flex gap-1.5">
                <button
                  onClick={saveEdit}
                  disabled={isPending}
                  className="text-[11px] font-semibold bg-gray-900 text-white rounded-md px-2.5 py-1 hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  {isPending ? '…' : 'Save'}
                </button>
                <button
                  onClick={() => { setEditing(false); setEditName(dept.name); setEditError(null) }}
                  className="text-[11px] text-gray-500 hover:text-gray-800 rounded-md px-2 py-1 border border-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{dept.name}</p>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">
                {usage} employee{usage !== 1 ? 's' : ''}
              </p>
            </>
          )}
        </div>

        {/* Three-dot menu button */}
        {!editing && (
          <div ref={menuRef} className="absolute top-2 right-2">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Department actions"
              className="flex items-center justify-center h-6 w-6 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                <circle cx="8" cy="2.5" r="1.5" />
                <circle cx="8" cy="8"   r="1.5" />
                <circle cx="8" cy="13.5" r="1.5" />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-gray-200 bg-white shadow-lg py-1 z-50">
                <button
                  onClick={() => { setEditing(true); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Rename
                </button>
                {isRoot && onAddChild && (
                  <button
                    onClick={() => { onAddChild(); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    + Add subdepartment
                  </button>
                )}
                <div className="mx-3 my-1 border-t border-gray-100" />
                <button
                  onClick={() => { handleArchive(); setMenuOpen(false) }}
                  disabled={isPending}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-40 transition-colors"
                >
                  Archive
                </button>
                <button
                  onClick={() => { handleDelete(); setMenuOpen(false) }}
                  disabled={isPending}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {actionError && (
        <p className="mt-1 px-1 text-[11px] text-red-500">{actionError}</p>
      )}
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
    <div style={{ position: 'absolute', left: x, top: y, width: NODE_W }}>
      <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-3 shadow-sm">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{label}</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
          <input
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onCancel()}
            placeholder={placeholder}
            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 w-full"
          />
          {error && <p className="text-[11px] text-red-500">{error}</p>}
          <div className="flex gap-1.5">
            <button
              type="submit"
              disabled={isPending}
              className="text-[11px] font-semibold bg-gray-900 text-white rounded-md px-2.5 py-1.5 hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? '…' : 'Add'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="text-[11px] text-gray-500 hover:text-gray-800 rounded-md px-2 py-1.5 border border-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── AddRootButton ────────────────────────────────────────────────────────────

function AddRootButton({ x, y, onClick }: { x: number; y: number; onClick: () => void }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: NODE_W }}>
      <button
        onClick={onClick}
        className="w-full flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 bg-transparent text-gray-400 hover:border-gray-400 hover:text-gray-600 py-3 text-sm font-medium transition-colors"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add department
      </button>
    </div>
  )
}

// ─── DepartmentGraph (main export) ───────────────────────────────────────────

export interface DepartmentGraphProps {
  deptTree:     DepartmentWithChildren[]
  deptUsage:    Record<string, number>
  onDeptCreated:  (dept: Department) => void
  onDeptArchived: (id: string) => void
  onDeptDeleted:  (id: string) => void
  onDeptUpdated:  (updated: Department) => void
  onChildCreated: (parentId: string, child: Department) => void
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
  const [addingChildTo, setAddingChildTo] = useState<string | null>(null)
  const [addingRoot,    setAddingRoot]    = useState(false)

  const rows   = buildRows(deptTree, addingChildTo)
  const edges  = buildEdges(rows)
  const lastRow = rows[rows.length - 1]
  const canvasH = rowY(lastRow.index) + NODE_H + PAD_Y

  if (deptTree.length === 0 && !addingRoot) {
    return (
      <div className="flex flex-col items-start gap-4 py-2">
        <p className="text-sm text-gray-400 italic">No active departments yet.</p>
        <button
          onClick={() => setAddingRoot(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-500 hover:border-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add first department
        </button>
        {addingRoot && (
          <div className="w-60">
            <InlineAddForm
              label="New department"
              placeholder="Department name"
              x={0} y={0}
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
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto -mx-1 px-1 pb-2">
      <div style={{ position: 'relative', width: CANVAS_W, height: canvasH }}>

        {/* ── SVG edge layer ── */}
        <svg
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
          width={CANVAS_W}
          height={canvasH}
          aria-hidden="true"
        >
          {edges.map((e, i) => (
            <path
              key={i}
              d={e.d}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          ))}
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
