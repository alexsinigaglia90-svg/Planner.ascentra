'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import type { TeamSummary } from '@/lib/queries/teams'
import {
  bulkImportEmployeesAction,
  type BulkImportRow,
} from '@/app/workforce/employees/import-action'

// ─── Types ────────────────────────────────────────────────────────────────────

type PreviewRow = {
  _id: number
  name: string
  teamName: string
}

type Step = 'input' | 'preview' | 'done'

type DoneResult = { created: number; skipped: number; teamsCreated: number }

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
          teamName: line.slice(commaIdx + 1).trim(),
        }
      }
      return { _id: i, name: line.trim(), teamName: '' }
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

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  teams: TeamSummary[]
  onClose: () => void
  onImported: (summary: DoneResult) => void
}

export default function BulkImportModal({ teams, onClose, onImported }: Props) {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState<Step>('input')

  // Input step state
  const [pasteText, setPasteText] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Preview step state
  const [rows, setRows] = useState<PreviewRow[]>([])

  // Done step state
  const [result, setResult] = useState<DoneResult | null>(null)

  // Import action
  const [isImporting, startTransition] = useTransition()

  // Build set of existing team names (lowercase) for "new team" badge
  const existingTeamNames = new Set(teams.map((t) => t.name.toLowerCase().trim()))

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

  function updateRow(id: number, field: keyof Omit<PreviewRow, '_id'>, value: string) {
    setRows((prev) =>
      prev.map((r) => (r._id === id ? { ...r, [field]: value } : r)),
    )
  }

  function deleteRow(id: number) {
    setRows((prev) => prev.filter((r) => r._id !== id))
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { _id: Date.now(), name: '', teamName: '' },
    ])
  }

  // ── Import ───────────────────────────────────────────────────────────────────

  function handleImport() {
    const toImport: BulkImportRow[] = rows
      .filter((r) => r.name.trim().length > 0)
      .map((r) => ({ name: r.name.trim(), teamName: r.teamName.trim() }))

    startTransition(async () => {
      const res = await bulkImportEmployeesAction(toImport)
      if (!res.ok) {
        setParseError(res.error)
        return
      }
      setResult({ created: res.created, skipped: res.skipped, teamsCreated: res.teamsCreated })
      setStep('done')
      onImported({ created: res.created, skipped: res.skipped, teamsCreated: res.teamsCreated })
    })
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const validRowCount = rows.filter((r) => r.name.trim().length > 0).length
  const invalidRowCount = rows.filter((r) => r.name.trim().length === 0).length

  // ── Render ───────────────────────────────────────────────────────────────────

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
        <div className="shrink-0 flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">Import employees</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {step === 'input' && 'Paste names or upload a file'}
              {step === 'preview' && `Review ${rows.length} row${rows.length !== 1 ? 's' : ''} before importing`}
              {step === 'done' && 'Import complete'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* ── Step: Input ─────────────────────────────────────────────────── */}
        {step === 'input' && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Textarea */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Paste names (one per line)
                </label>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={10}
                  placeholder={`Jan Jansen\nPiet Pietersen, Team A\nMaria de Vries, Team B`}
                  className="w-full rounded-md border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-300 font-mono focus:border-gray-400 focus:outline-none resize-none"
                  spellCheck={false}
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  Format: <code className="bg-gray-100 px-1 rounded text-gray-600">Name</code> or{' '}
                  <code className="bg-gray-100 px-1 rounded text-gray-600">Name, Team</code> — one per line
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

        {/* ── Step: Preview ───────────────────────────────────────────────── */}
        {step === 'preview' && (
          <>
            <div className="flex-1 overflow-y-auto">
              {/* Summary bar */}
              <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-4 bg-gray-50">
                <span className="text-xs font-medium text-gray-700">
                  {validRowCount} employee{validRowCount !== 1 ? 's' : ''} ready
                </span>
                {invalidRowCount > 0 && (
                  <span className="text-xs text-amber-700 bg-amber-50 rounded-full px-2.5 py-0.5">
                    {invalidRowCount} row{invalidRowCount !== 1 ? 's' : ''} with missing name (will be skipped)
                  </span>
                )}
              </div>

              {/* Table */}
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/2">
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
                    const teamKey = row.teamName.trim().toLowerCase()
                    const isNewTeam = teamKey && !existingTeamNames.has(teamKey)

                    return (
                      <tr
                        key={row._id}
                        className={isEmpty ? 'bg-amber-50/40' : ''}
                      >
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
                              value={row.teamName}
                              onChange={(e) => updateRow(row._id, 'teamName', e.target.value)}
                              className="w-full rounded border border-transparent bg-transparent px-2.5 py-1.5 text-sm focus:outline-none focus:border-gray-400 hover:border-gray-200 focus:bg-white"
                              placeholder="—"
                              list={`team-suggestions-${row._id}`}
                            />
                            <datalist id={`team-suggestions-${row._id}`}>
                              {teams.map((t) => (
                                <option key={t.id} value={t.name} />
                              ))}
                            </datalist>
                            {isNewTeam && (
                              <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-600 whitespace-nowrap">
                                new
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

              {/* Add row */}
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

            {parseError && (
              <div className="shrink-0 mx-6 mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
                <p className="text-sm text-red-700">{parseError}</p>
              </div>
            )}

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
                onClick={handleImport}
                disabled={isImporting || validRowCount === 0}
                className="rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                {isImporting
                  ? 'Importing…'
                  : `Import ${validRowCount} employee${validRowCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}

        {/* ── Step: Done ──────────────────────────────────────────────────── */}
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
                {result.teamsCreated > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-violet-100 bg-violet-50 px-4 py-3">
                    <dt className="text-sm text-violet-700">New teams created</dt>
                    <dd className="text-sm font-semibold text-violet-800">{result.teamsCreated}</dd>
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
