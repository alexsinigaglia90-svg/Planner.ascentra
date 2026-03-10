'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import type { ProcessRow, EmployeeProcessScoreRow } from '@/lib/queries/processes'
import type { Employee } from '@prisma/client'
import {
  createProcessAction,
  deleteProcessAction,
  upsertProcessScoreAction,
} from '@/app/workforce/skills/actions'

// ─── Heatmap colour by score ──────────────────────────────────────────────────
// 0–20: light gray  20–40: amber/orange  40–60: blue  60–80: purple  80–100: gold

function scoreColor(score: number): { bg: string; text: string } {
  if (score >= 80) return { bg: 'bg-amber-400',  text: 'text-amber-900' }
  if (score >= 60) return { bg: 'bg-violet-400', text: 'text-violet-900' }
  if (score >= 40) return { bg: 'bg-blue-400',   text: 'text-blue-900' }
  if (score >= 20) return { bg: 'bg-orange-300', text: 'text-orange-900' }
  return               { bg: 'bg-gray-100',   text: 'text-gray-500' }
}

function scoreIntensity(score: number): string {
  // opacity for the cell background based on score (linear 0.08 → 1.0)
  const pct = Math.max(0, Math.min(100, score))
  const op = 0.08 + (pct / 100) * 0.92
  return String(Math.round(op * 100))
}

// ─── Cell editor ─────────────────────────────────────────────────────────────

function ScoreCell({
  score,
  canEdit,
  onSave,
}: {
  score: number | undefined
  canEdit: boolean
  onSave: (v: number) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<number>(score ?? 0)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const s = score ?? 0
  const { bg, text } = scoreColor(s)

  useEffect(() => {
    if (editing) {
      setDraft(score ?? 0)
      setTimeout(() => inputRef.current?.select(), 20)
    }
  }, [editing, score])

  async function commit(val: number) {
    const clamped = Math.round(Math.max(0, Math.min(100, val)))
    setSaving(true)
    await onSave(clamped)
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center justify-center w-full h-full px-1">
        <input
          ref={inputRef}
          type="number"
          min={0}
          max={100}
          value={draft}
          onChange={(e) => setDraft(Number(e.target.value))}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit(draft)
            if (e.key === 'Escape') setEditing(false)
          }}
          disabled={saving}
          className="w-14 text-center rounded-md border border-indigo-400 bg-white px-1 py-0.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 ring-offset-0"
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={!canEdit}
      onClick={() => canEdit && setEditing(true)}
      title={canEdit ? `Score: ${s} — click to edit` : `Score: ${s}`}
      className={[
        'group relative flex items-center justify-center w-full h-full rounded-md transition-all duration-200',
        s === 0 ? 'bg-gray-100 hover:bg-gray-200' : `${bg}/[0.${scoreIntensity(s)}]`,
        canEdit ? 'cursor-pointer hover:ring-2 hover:ring-indigo-400 hover:ring-offset-0' : 'cursor-default',
        saving ? 'opacity-50' : '',
      ].join(' ')}
    >
      {s > 0 ? (
        <span className={`text-[11px] font-semibold tabular-nums select-none ${text}`}>
          {s}
        </span>
      ) : (
        <span className="text-[10px] text-gray-300 select-none">
          {canEdit ? '—' : ''}
        </span>
      )}
      {canEdit && s > 0 && (
        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className="h-3 w-3 text-gray-600" fill="none" viewBox="0 0 12 12">
            <path d="M8 1l3 3-7 7H1V8l7-7z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </button>
  )
}

// ─── Add process dialog ───────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#ef4444', '#14b8a6',
]

function AddProcessDialog({
  onAdd,
  onCancel,
}: {
  onAdd: (name: string, color: string | null) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<string | null>(PRESET_COLORS[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Name is required.'); return }
    setSaving(true)
    await onAdd(trimmed, color)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-xs rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Add process</h3>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Process name…"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null) }}
            maxLength={80}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:outline-none mb-3"
          />
          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-5 w-5 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-1 ring-gray-900 scale-110' : ''}`}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add process'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  const tiers = [
    { label: '0–19', classes: 'bg-gray-100 text-gray-500' },
    { label: '20–39', classes: 'bg-orange-300/70 text-orange-900' },
    { label: '40–59', classes: 'bg-blue-400/60 text-blue-900' },
    { label: '60–79', classes: 'bg-violet-400/70 text-violet-900' },
    { label: '80–100', classes: 'bg-amber-400/90 text-amber-900' },
  ]
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mr-1">Score</span>
      {tiers.map((t) => (
        <span
          key={t.label}
          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold tabular-nums ${t.classes}`}
        >
          {t.label}
        </span>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  employees: Employee[]
  processes: ProcessRow[]
  scores: EmployeeProcessScoreRow[]
  canEdit: boolean
}

export default function SkillMatrixView({
  employees: initialEmployees,
  processes: initialProcesses,
  scores: initialScores,
  canEdit,
}: Props) {
  const [processes, setProcesses] = useState(initialProcesses)
  const [scores, setScores] = useState(initialScores)
  const [search, setSearch] = useState('')
  const [showAddProcess, setShowAddProcess] = useState(false)
  const [deletingProcessId, setDeletingProcessId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => { setProcesses(initialProcesses) }, [initialProcesses])
  useEffect(() => { setScores(initialScores) }, [initialScores])

  // Build score lookup: `${employeeId}:${processId}` → score
  const scoreMap = new Map(scores.map((s) => [`${s.employeeId}:${s.processId}`, s.score]))

  const filteredEmployees = initialEmployees.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()),
  )

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Save a single cell score ────────────────────────────────────────────────
  async function handleSaveScore(employeeId: string, processId: string, value: number) {
    // Optimistic update
    const key = `${employeeId}:${processId}`
    setScores((prev) => {
      const existing = prev.find((s) => s.employeeId === employeeId && s.processId === processId)
      if (existing) {
        return prev.map((s) =>
          s.employeeId === employeeId && s.processId === processId
            ? { ...s, score: value, updatedAt: new Date() }
            : s,
        )
      }
      return [
        ...prev,
        { id: key, employeeId, processId, score: value, updatedAt: new Date() },
      ]
    })

    const result = await upsertProcessScoreAction(employeeId, processId, value)
    if (!result.ok) {
      showToast('error', result.error)
      // Revert on failure
      setScores((prev) =>
        prev.map((s) =>
          s.employeeId === employeeId && s.processId === processId
            ? { ...s, score: scoreMap.get(`${employeeId}:${processId}`) ?? 0 }
            : s,
        ),
      )
    }
  }

  // ── Add process ─────────────────────────────────────────────────────────────
  async function handleAddProcess(name: string, color: string | null) {
    const result = await createProcessAction(name, color)
    if (!result.ok) {
      showToast('error', result.error)
    } else {
      setProcesses((prev) => [
        ...prev,
        { id: result.id, name, color, sortOrder: prev.length, createdAt: new Date() },
      ])
      setShowAddProcess(false)
    }
  }

  // ── Delete process ──────────────────────────────────────────────────────────
  function handleDeleteProcess(processId: string) {
    startTransition(async () => {
      const result = await deleteProcessAction(processId)
      if (!result.ok) {
        showToast('error', result.error)
      } else {
        setProcesses((prev) => prev.filter((p) => p.id !== processId))
        setScores((prev) => prev.filter((s) => s.processId !== processId))
      }
      setDeletingProcessId(null)
    })
  }

  // ── Empty states ────────────────────────────────────────────────────────────
  if (processes.length === 0) {
    return (
      <div className="space-y-6">
        <MatrixHeader
          search={search}
          onSearch={setSearch}
          canEdit={canEdit}
          onAddProcess={() => setShowAddProcess(true)}
        />
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-8 py-16 text-center">
          <p className="text-sm font-semibold text-gray-900 mb-1">No processes yet</p>
          <p className="text-sm text-gray-500 mb-4">
            Add warehouse processes (e.g. Picking, Packing) to start building the skill matrix.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowAddProcess(true)}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
            >
              + Add first process
            </button>
          )}
        </div>
        {showAddProcess && (
          <AddProcessDialog onAdd={handleAddProcess} onCancel={() => setShowAddProcess(false)} />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all duration-300 ${
            toast.type === 'success' ? 'bg-gray-900 text-white' : 'bg-red-600 text-white'
          }`}
        >
          <span>{toast.message}</span>
        </div>
      )}

      <MatrixHeader
        search={search}
        onSearch={setSearch}
        canEdit={canEdit}
        onAddProcess={() => setShowAddProcess(true)}
      />

      <Legend />

      {/* Matrix table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {/* Employee name column */}
              <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap w-44 min-w-[11rem] border-r border-gray-200">
                Employee
              </th>
              {processes.map((proc) => (
                <th
                  key={proc.id}
                  className="px-1 py-3 text-center text-xs font-semibold text-gray-700 whitespace-nowrap min-w-[80px] group"
                >
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1">
                      {proc.color && (
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: proc.color }}
                        />
                      )}
                      <span>{proc.name}</span>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setDeletingProcessId(proc.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400"
                        title={`Remove ${proc.name}`}
                        aria-label={`Remove ${proc.name}`}
                      >
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={processes.length + 1} className="px-4 py-10 text-center text-sm text-gray-400">
                  {search ? `No employees match "${search}".` : 'No employees.'}
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp) => (
                <tr key={emp.id} className="group/row hover:bg-gray-50/50 transition-colors">
                  {/* Name cell */}
                  <td className="sticky left-0 z-10 bg-white group-hover/row:bg-gray-50/50 transition-colors px-4 py-2 whitespace-nowrap border-r border-gray-100 w-44 min-w-[11rem]">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-600 select-none">
                        {emp.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-900 truncate max-w-[8rem]">{emp.name}</span>
                    </div>
                  </td>
                  {/* Score cells */}
                  {processes.map((proc) => {
                    const val = scoreMap.get(`${emp.id}:${proc.id}`) ?? 0
                    return (
                      <td key={proc.id} className="px-1 py-1.5 text-center">
                        <div className="h-9 w-[72px] mx-auto">
                          <ScoreCell
                            score={val}
                            canEdit={canEdit}
                            onSave={(v) => handleSaveScore(emp.id, proc.id, v)}
                          />
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add process dialog */}
      {showAddProcess && (
        <AddProcessDialog onAdd={handleAddProcess} onCancel={() => setShowAddProcess(false)} />
      )}

      {/* Confirm delete process */}
      {deletingProcessId && (() => {
        const proc = processes.find((p) => p.id === deletingProcessId)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setDeletingProcessId(null)} />
            <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <h3 className="text-base font-semibold text-gray-900 mb-2">Remove "{proc?.name}"?</h3>
              <p className="text-sm text-gray-500 mb-5">
                This permanently deletes the process and all employee scores for it.
              </p>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => handleDeleteProcess(deletingProcessId)}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors"
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingProcessId(null)}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Header bar ───────────────────────────────────────────────────────────────

function MatrixHeader({
  search,
  onSearch,
  canEdit,
  onAddProcess,
}: {
  search: string
  onSearch: (v: string) => void
  canEdit: boolean
  onAddProcess: () => void
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative max-w-xs flex-1">
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 16 16">
            <path d="M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10ZM14 14l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Filter employees…"
          className="w-full rounded-md border border-gray-200 py-2 pl-8 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
        />
      </div>
      {canEdit && (
        <button
          type="button"
          onClick={onAddProcess}
          className="shrink-0 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          + Add process
        </button>
      )}
    </div>
  )
}
