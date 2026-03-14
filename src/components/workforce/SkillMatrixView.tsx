'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import type { ProcessRow, EmployeeProcessScoreRow } from '@/lib/queries/processes'
import type { Employee } from '@prisma/client'
import { LEVEL_COLORS, LEVEL_LABELS, RING_CIRC } from './SkillLevelIndicator'
import {
  createProcessAction,
  deleteProcessAction,
  upsertProcessLevelAction,
} from '@/app/workforce/skills/actions'
import { SkillMatrixHeader } from './SkillMatrixHeader'
import { SkillMatrixRow } from './SkillMatrixRow'

// ─── Level legend ─────────────────────────────────────────────────────────────

function LevelLegend() {
  return (
    <div className="flex items-center gap-x-6 gap-y-2 flex-wrap">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Level</span>
      {LEVEL_LABELS.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 36 36" aria-hidden="true">
            <circle
              cx="18" cy="18" r="14"
              fill="none"
              stroke={i === 0 ? '#e5e7eb' : `${LEVEL_COLORS[i]}22`}
              strokeWidth="4"
            />
            {i > 0 && (
              <circle
                cx="18" cy="18" r="14"
                fill="none"
                stroke={LEVEL_COLORS[i]}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={RING_CIRC}
                strokeDashoffset={RING_CIRC * (1 - i / 4)}
                transform="rotate(-90 18 18)"
              />
            )}
          </svg>
          <span className="text-[11px] text-gray-500">
            <span className="font-semibold text-gray-700">{i}</span>
            <span className="text-gray-400 mx-0.5">–</span>
            {label}
          </span>
        </div>
      ))}
    </div>
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

  // Build level lookup: `${employeeId}:${processId}` → level (0–4)
  const levelMap = new Map(scores.map((s) => [`${s.employeeId}:${s.processId}`, s.level]))

  const filteredEmployees = initialEmployees.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()),
  )

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Cycle level: 0 → 1 → 2 → 3 → 4 → 0 ────────────────────────────────────
  function handleCycleLevel(employeeId: string, processId: string) {
    const key = `${employeeId}:${processId}`
    const current = levelMap.get(key) ?? 0
    const next = (current + 1) % 5

    // Optimistic update — ring animates immediately
    setScores((prev) => {
      const exists = prev.find((s) => s.employeeId === employeeId && s.processId === processId)
      if (exists) {
        return prev.map((s) =>
          s.employeeId === employeeId && s.processId === processId
            ? { ...s, level: next, updatedAt: new Date() }
            : s,
        )
      }
      return [
        ...prev,
        { id: key, employeeId, processId, score: 0, level: next, updatedAt: new Date() },
      ]
    })

    upsertProcessLevelAction(employeeId, processId, next).then((result) => {
      if (!result.ok) {
        showToast('error', result.error)
        // Revert on server failure
        setScores((prev) =>
          prev.map((s) =>
            s.employeeId === employeeId && s.processId === processId
              ? { ...s, level: current }
              : s,
          ),
        )
      }
    })
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

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (processes.length === 0) {
    return (
      <div className="space-y-4">
        <SkillMatrixHeader
          search={search}
          onSearch={setSearch}
          canEdit={canEdit}
          onAddProcess={() => setShowAddProcess(true)}
        />
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-8 py-16 text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
              <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-900 mb-1">No processes yet</p>
          <p className="text-[13px] text-gray-500 mb-5 max-w-xs mx-auto">
            Add warehouse processes — e.g. Picking, Packing, Inbound — to start building the matrix.
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

  // ── Stats label ─────────────────────────────────────────────────────────────
  const employeeCount = filteredEmployees.length
  const totalCount = initialEmployees.length
  const statsLabel =
    search && employeeCount !== totalCount
      ? `${employeeCount} of ${totalCount} employees · ${processes.length} processes`
      : `${totalCount} employee${totalCount !== 1 ? 's' : ''} · ${processes.length} process${processes.length !== 1 ? 'es' : ''}`

  return (
    <div className="space-y-5">
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === 'success' ? 'bg-gray-900 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Toolbar */}
      <SkillMatrixHeader
        search={search}
        onSearch={setSearch}
        canEdit={canEdit}
        onAddProcess={() => setShowAddProcess(true)}
      />

      {/* Meta row: legend + stats */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-1">
        <LevelLegend />
        <span className="text-[11px] text-gray-400 tabular-nums shrink-0 font-medium">{statsLabel}</span>
      </div>

      {/* Matrix workspace card */}
      <div
        className="overflow-auto rounded-2xl border border-gray-200 shadow-sm bg-white"
        style={{ maxHeight: 'calc(100vh - 300px)' }}
      >
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-20">
            <tr className="bg-gray-50 border-b border-gray-200">
              {/* Corner: Employee header — sticky on both axes */}
              <th className="sticky left-0 z-30 bg-gray-50 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap w-48 min-w-[12rem] border-r border-gray-200 shadow-[1px_0_0_0_rgba(0,0,0,0.04)]">
                Employee
              </th>
              {/* Process column headers */}
              {processes.map((proc) => (
                <th
                  key={proc.id}
                  className="bg-gray-50 px-3 py-2.5 text-center min-w-[60px] group"
                >
                  <div className="flex flex-col items-center gap-1.5">
                    {/* Color accent bar */}
                    {proc.color && (
                      <div
                        className="h-0.5 w-7 rounded-full"
                        style={{ backgroundColor: proc.color }}
                      />
                    )}
                    {/* Process label */}
                    <span className="text-[11px] font-semibold text-gray-600 tracking-wide whitespace-nowrap">
                      {proc.name}
                    </span>
                    {/* Delete button — revealed on hover */}
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
          <tbody className="divide-y divide-gray-100/80">
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={processes.length + 1} className="px-4 py-10 text-center text-sm text-gray-400">
                  {search ? <>No employees match &ldquo;{search}&rdquo;.</> : 'No employees.'}
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp) => (
                <SkillMatrixRow
                  key={emp.id}
                  employee={emp}
                  processes={processes}
                  levelMap={levelMap}
                  canEdit={canEdit}
                  onCycleLevel={handleCycleLevel}
                />
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
              <h3 className="text-base font-semibold text-gray-900 mb-2">Remove &ldquo;{proc?.name}&rdquo;?</h3>
              <p className="text-sm text-gray-500 mb-5">
                This permanently deletes the process and all capability data for it.
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


