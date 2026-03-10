'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { TeamSummary } from '@/lib/queries/teams'
import {
  bulkImportEmployeesAction,
  type BulkImportRow,
} from '@/app/workforce/employees/import-action'

// ─── Types ────────────────────────────────────────────────────────────────────

type PreviewRow = {
  _id: number
  name: string
  rawTeamInput: string
}

type TeamMappingEntry = {
  rawInput: string       // original text from import (unresolved)
  affectedCount: number
  resolvedTeamId: string | null  // null = No team
}

type Step = 'input' | 'preview' | 'mapping' | 'confirm' | 'done'

type DoneResult = { created: number; skipped: number }

// ─── Parsing ──────────────────────────────────────────────────────────────────

function parseText(text: string): PreviewRow[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      const commaIdx = line.indexOf(',')
      if (commaIdx !== -1) {
        return {
          _id: i,
          name: line.slice(0, commaIdx).trim(),
          rawTeamInput: line.slice(commaIdx + 1).trim(),
        }
      }
      return { _id: i, name: line.trim(), rawTeamInput: '' }
    })
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M1 1L11 11M11 1L1 11"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
      />
    </svg>
  )
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

const WIZARD_STEPS: { key: Step; label: string }[] = [
  { key: 'input', label: 'Input' },
  { key: 'preview', label: 'Preview' },
  { key: 'mapping', label: 'Teams' },
  { key: 'confirm', label: 'Confirm' },
]

const STEP_INDEX: Record<Step, number> = {
  input: 0, preview: 1, mapping: 2, confirm: 3, done: 4,
}

function StepIndicator({ current }: { current: Step }) {
  if (current === 'done') return null
  const currentIdx = STEP_INDEX[current]
  return (
    <div className="flex items-center">
      {WIZARD_STEPS.map((s, i) => {
        const done = i < currentIdx
        const active = i === currentIdx
        return (
          <div key={s.key} className="flex items-center">
            {i > 0 && <div className={`h-px w-5 ${done ? 'bg-gray-900' : 'bg-gray-200'}`} />}
            <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold
              ${done ? 'bg-gray-900 text-white' : active ? 'bg-gray-900 text-white ring-4 ring-gray-100' : 'bg-gray-100 text-gray-400'}`}
            >
              {done
                ? <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                : i + 1}
            </div>
            <span className={`ml-1 text-[10px] font-medium ${active ? 'text-gray-900' : done ? 'text-gray-400' : 'text-gray-300'}`}>
              {s.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  teams: TeamSummary[]
  onClose: () => void
  onImported: () => void
}

export default function BulkImportModal({ teams, onClose, onImported }: Props) {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState<Step>('input')

  // Input step
  const [pasteText, setPasteText] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Preview step
  const [rows, setRows] = useState<PreviewRow[]>([])

  // Mapping step
  const [teamMappings, setTeamMappings] = useState<TeamMappingEntry[]>([])

  // Done step
  const [result, setResult] = useState<DoneResult | null>(null)

  const [isImporting, startTransition] = useTransition()

  // Lookup: lowercase team name → team id (for instant match resolution)
  const teamByNameLower = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of teams) m.set(t.name.toLowerCase().trim(), t.id)
    return m
  }, [teams])

  // Slide-in animation
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // ── File upload ─────────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError(null)

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'csv' && ext !== 'txt') {
      setFileError('Only .csv and .txt files are supported. To import from Excel, save your sheet as CSV first (File → Save As → CSV).')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setPasteText(text)
    }
    reader.onerror = () => setFileError('Could not read file.')
    reader.readAsText(file, 'UTF-8')
  }

  // ── Parse → Preview ─────────────────────────────────────────────────────────

  function handleParse() {
    setParseError(null)
    const parsed = parseText(pasteText)
    if (parsed.length === 0) {
      setParseError('No valid rows found. Enter one name per line.')
      return
    }
    setRows(parsed)
    setStep('preview')
  }

  // ── Preview row editing ──────────────────────────────────────────────────────

  function updateRow(id: number, field: 'name' | 'rawTeamInput', value: string) {
    setRows((prev) => prev.map((r) => (r._id === id ? { ...r, [field]: value } : r)))
  }

  function deleteRow(id: number) {
    setRows((prev) => prev.filter((r) => r._id !== id))
  }

  function addRow() {
    setRows((prev) => [...prev, { _id: Date.now(), name: '', rawTeamInput: '' }])
  }

  // ── Preview → Team Mapping ───────────────────────────────────────────────────

  function handleGoToMapping() {
    // Find unique team input values that don't match an existing team
    const unresolvedCounts = new Map<string, number>()  // lowercase → count
    const displayText = new Map<string, string>()        // lowercase → original casing

    for (const row of rows) {
      const raw = row.rawTeamInput.trim()
      if (!raw) continue
      const key = raw.toLowerCase()
      if (teamByNameLower.has(key)) continue  // already resolved
      unresolvedCounts.set(key, (unresolvedCounts.get(key) ?? 0) + 1)
      if (!displayText.has(key)) displayText.set(key, raw)
    }

    const entries: TeamMappingEntry[] = Array.from(unresolvedCounts.entries()).map(([key, count]) => ({
      rawInput: displayText.get(key) ?? key,
      affectedCount: count,
      resolvedTeamId: null,
    }))

    setTeamMappings(entries)
    setStep('mapping')
  }

  // ── Import ───────────────────────────────────────────────────────────────────

  function handleImport() {
    // Build resolution map: lowercase raw input → resolved team id (or null)
    const resolutionMap = new Map<string, string | null>()
    // 1. Automatically matched teams
    for (const t of teams) resolutionMap.set(t.name.toLowerCase().trim(), t.id)
    // 2. Manual mappings override
    for (const entry of teamMappings) {
      resolutionMap.set(entry.rawInput.toLowerCase(), entry.resolvedTeamId)
    }

    const toImport: BulkImportRow[] = rows
      .filter((r) => r.name.trim().length > 0)
      .map((r) => ({
        name: r.name.trim(),
        teamId: resolutionMap.get(r.rawTeamInput.trim().toLowerCase()) ?? null,
      }))

    startTransition(async () => {
      const res = await bulkImportEmployeesAction(toImport)
      if (!res.ok) {
        setParseError(res.error)
        return
      }
      setResult({ created: res.created, skipped: res.skipped })
      setStep('done')
      onImported()
    })
  }

  // ── Derived row stats ────────────────────────────────────────────────────────

  const rowStats = useMemo(() => {
    const total = rows.length
    const missingName = rows.filter((r) => r.name.trim().length === 0).length
    const seenNames = new Set<string>()
    let dupCount = 0
    for (const r of rows) {
      const key = r.name.trim().toLowerCase()
      if (!key) continue
      if (seenNames.has(key)) dupCount++
      else seenNames.add(key)
    }
    const withTeam = rows.filter((r) => {
      const raw = r.rawTeamInput.trim()
      return raw && teamByNameLower.has(raw.toLowerCase())
    }).length
    return { total, missingName, dupCount, withTeam }
  }, [rows, teamByNameLower])

  const validCount = rows.filter((r) => r.name.trim().length > 0).length

  function getTeamStatus(rawTeamInput: string): 'matched' | 'unresolved' | 'none' {
    const raw = rawTeamInput.trim()
    if (!raw) return 'none'
    return teamByNameLower.has(raw.toLowerCase()) ? 'matched' : 'unresolved'
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-2xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[85vh] transition-all duration-200 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-semibold text-gray-900">Import employees</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {step === 'input'   && 'Paste names or upload a file'}
                {step === 'preview' && `Review ${rows.length} detected row${rows.length !== 1 ? 's' : ''}`}
                {step === 'mapping' && 'Assign unresolved team values'}
                {step === 'confirm' && 'Review and confirm import'}
                {step === 'done'    && 'Import complete'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <StepIndicator current={step} />
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                aria-label="Close"
              >
                <CloseIcon />
              </button>
            </div>
          </div>
        </div>

        {/* ── Step 1: Input ───────────────────────────────────────────────────── */}
        {step === 'input' && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Paste names (one per line)
                </label>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={9}
                  placeholder={`Jan Jansen\nPiet Pietersen, Team A\nMaria de Vries, Team B`}
                  className="w-full rounded-md border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-300 font-mono focus:border-gray-400 focus:outline-none resize-none"
                  spellCheck={false}
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  Format: <code className="bg-gray-100 px-1 rounded text-gray-600">Name</code> or{' '}
                  <code className="bg-gray-100 px-1 rounded text-gray-600">Name, Team</code> — one per line.
                  Team names must match an existing team exactly.
                </p>
              </div>

              {/* File upload */}
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-5 py-4">
                <div className="flex items-center gap-3">
                  <UploadIcon />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700">Upload a file</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Accepts .csv and .txt — for Excel, save your sheet as CSV first
                    </p>
                  </div>
                  <label className="shrink-0 cursor-pointer rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    Choose file
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt"
                      className="sr-only"
                      onChange={handleFileChange}
                    />
                  </label>
                </div>
                {fileError && (
                  <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-xs text-red-700">{fileError}</p>
                  </div>
                )}
              </div>

              {/* Available teams hint */}
              {teams.length > 0 && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                  <p className="text-xs font-semibold text-blue-800 mb-2">
                    Available teams ({teams.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {teams.map((t) => (
                      <span key={t.id} className="inline-flex rounded-full border border-blue-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-blue-700">
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {parseError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
                  <p className="text-sm text-red-700">{parseError}</p>
                </div>
              )}
            </div>

            <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleParse}
                disabled={!pasteText.trim()}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                Preview →
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Preview ─────────────────────────────────────────────────── */}
        {step === 'preview' && (
          <>
            <div className="flex-1 overflow-y-auto">
              {/* Summary bar */}
              <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3 bg-gray-50 flex-wrap">
                <span className="text-xs font-medium text-gray-700">
                  {rowStats.total} detected
                </span>
                {rowStats.missingName > 0 && (
                  <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
                    {rowStats.missingName} missing name
                  </span>
                )}
                {rowStats.dupCount > 0 && (
                  <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
                    {rowStats.dupCount} duplicate{rowStats.dupCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Table */}
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[45%]">
                      Name
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Team
                    </th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((row) => {
                    const isEmpty = row.name.trim().length === 0
                    const teamStatus = getTeamStatus(row.rawTeamInput)
                    return (
                      <tr key={row._id} className={isEmpty ? 'bg-amber-50/40' : ''}>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => updateRow(row._id, 'name', e.target.value)}
                            className={`w-full rounded border px-2.5 py-1.5 text-sm focus:outline-none focus:border-gray-400 ${isEmpty ? 'border-amber-300 bg-amber-50' : 'border-transparent bg-transparent hover:border-gray-200 focus:bg-white'}`}
                            placeholder="Name"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={row.rawTeamInput}
                              onChange={(e) => updateRow(row._id, 'rawTeamInput', e.target.value)}
                              className="w-full rounded border border-transparent bg-transparent px-2.5 py-1.5 text-sm focus:outline-none focus:border-gray-400 hover:border-gray-200 focus:bg-white"
                              placeholder="—"
                            />
                            {teamStatus === 'matched' && (
                              <span className="shrink-0 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-700 whitespace-nowrap">
                                ✓ matched
                              </span>
                            )}
                            {teamStatus === 'unresolved' && (
                              <span className="shrink-0 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700 whitespace-nowrap">
                                ? unresolved
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => deleteRow(row._id)}
                            className="flex h-6 w-6 items-center justify-center rounded text-gray-300 hover:bg-gray-100 hover:text-gray-500 transition-colors"
                            aria-label="Remove row"
                          >
                            <CloseIcon />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="px-4 py-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={addRow}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  + Add row
                </button>
              </div>
            </div>

            <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => { setStep('input'); setParseError(null) }}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleGoToMapping}
                disabled={rows.length === 0}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                Continue →
              </button>
            </div>
          </>
        )}

        {/* ── Step 3: Team Mapping ─────────────────────────────────────────────── */}
        {step === 'mapping' && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {teamMappings.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-10 text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                    <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} stroke="currentColor" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-emerald-800">All teams matched</p>
                  <p className="text-xs text-emerald-600 mt-1">Every team value in your file was recognised — nothing to assign.</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-1">
                    The following imported team values could not be matched to an existing team.
                  </p>
                  <p className="text-xs text-gray-400 mb-5">
                    Select a team from the dropdown or leave as <span className="font-medium text-gray-500">No team</span>. New teams will not be created.
                  </p>
                  <div className="space-y-2.5">
                    {teamMappings.map((entry, idx) => (
                      <div key={entry.rawInput} className="flex items-center gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            &ldquo;{entry.rawInput}&rdquo;
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {entry.affectedCount} employee{entry.affectedCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="shrink-0">
                          <select
                            value={entry.resolvedTeamId ?? ''}
                            onChange={(e) => {
                              const val = e.target.value
                              setTeamMappings((prev) =>
                                prev.map((m, i) => i === idx ? { ...m, resolvedTeamId: val || null } : m)
                              )
                            }}
                            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
                          >
                            <option value="">No team</option>
                            {teams.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setStep('preview')}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep('confirm')}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
              >
                Review import →
              </button>
            </div>
          </>
        )}

        {/* ── Step 4: Confirm ─────────────────────────────────────────────────── */}
        {step === 'confirm' && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="text-sm text-gray-600 mb-5">
                Review the summary below. Only rows with a valid name will be imported.
                Duplicates and rows with a missing name will be skipped automatically.
              </p>

              <dl className="space-y-2.5">
                <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                  <dt className="text-sm text-gray-600">Employees detected</dt>
                  <dd className="text-sm font-semibold text-gray-900">{rowStats.total}</dd>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
                  <dt className="text-sm text-emerald-700">Ready to import</dt>
                  <dd className="text-sm font-semibold text-emerald-800">{validCount}</dd>
                </div>
                {rowStats.missingName > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
                    <dt className="text-sm text-amber-700">Missing name — will be skipped</dt>
                    <dd className="text-sm font-semibold text-amber-800">{rowStats.missingName}</dd>
                  </div>
                )}
                {rowStats.dupCount > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
                    <dt className="text-sm text-amber-700">Duplicates within import — will be skipped</dt>
                    <dd className="text-sm font-semibold text-amber-800">{rowStats.dupCount}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                  <dt className="text-sm text-gray-600">With team assignment</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    {(() => {
                      // Count rows that will get a team id after all mappings
                      const resMap = new Map<string, string | null>()
                      for (const t of teams) resMap.set(t.name.toLowerCase().trim(), t.id)
                      for (const m of teamMappings) resMap.set(m.rawInput.toLowerCase(), m.resolvedTeamId)
                      return rows.filter((r) => {
                        if (!r.name.trim()) return false
                        const raw = r.rawTeamInput.trim()
                        if (!raw) return false
                        return (resMap.get(raw.toLowerCase()) ?? null) !== null
                      }).length
                    })()}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                <p className="text-xs text-blue-700">
                  Placeholder emails will be assigned. Update them from each employee&apos;s detail panel after import.
                </p>
              </div>

              {parseError && (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
                  <p className="text-sm text-red-700">{parseError}</p>
                </div>
              )}
            </div>

            <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => { setStep('mapping'); setParseError(null) }}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={isImporting || validCount === 0}
                className="rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                {isImporting
                  ? 'Importing…'
                  : `Import ${validCount} employee${validCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}

        {/* ── Done ────────────────────────────────────────────────────────────── */}
        {step === 'done' && result && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-8">
              <div className="text-center mb-6">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      stroke="currentColor" d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-gray-900">Import complete</h3>
              </div>

              <dl className="mx-auto max-w-xs space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                  <dt className="text-sm text-gray-600">Employees created</dt>
                  <dd className="text-sm font-semibold text-gray-900">{result.created}</dd>
                </div>
                {result.skipped > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
                    <dt className="text-sm text-amber-700">Duplicates skipped</dt>
                    <dd className="text-sm font-semibold text-amber-800">{result.skipped}</dd>
                  </div>
                )}
              </dl>

              {result.created > 0 && (
                <p className="text-center text-xs text-gray-400 mt-5">
                  Placeholder emails were assigned — update them from each employee&apos;s detail panel.
                </p>
              )}
            </div>

            <div className="shrink-0 px-6 py-4 border-t border-gray-100 text-right">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
