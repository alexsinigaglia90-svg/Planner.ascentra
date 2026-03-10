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
  rawInput: string
  affectedCount: number
  resolvedTeamId: string | null   // null = No team (inc. after user clears it)
  autoMatchTeamId: string | null  // non-null when smart-matched
  autoMatchLabel: string | null   // display name of auto-match
}

type Step = 'input' | 'preview' | 'mapping' | 'confirm' | 'done'

type DoneResult = { created: number; skipped: number }

// ─── Smart team matching ────────────────────────────────────────────────────

/** Normalize separators, case and whitespace for fuzzy comparison. */
function normalizeTeamKey(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Strip leading domain-generic word ("team" / "ploeg") from a normalized string. */
function stripGenericPrefix(s: string): string {
  if (s.startsWith('team ')) return s.slice(5).trim()
  if (s.startsWith('ploeg ')) return s.slice(6).trim()
  return s
}

/**
 * Try to match a raw team input string against the list of existing teams.
 * Returns the matched team + confidence tier, or null if no confident match.
 *
 * Tiers (in priority order):
 *  'exact'  — case-insensitive exact match
 *  'smart'  — after separator/whitespace normalisation, or generic-prefix stripping
 *
 * A match is only returned when EXACTLY ONE existing team fits.
 * Ambiguous results → null (forces manual review).
 */
function matchTeam(
  rawInput: string,
  teams: TeamSummary[],
): { teamId: string; teamName: string; type: 'exact' | 'smart' } | null {
  const trimmed = rawInput.trim()
  if (!trimmed) return null

  const lc = trimmed.toLowerCase()

  // 1. Exact case-insensitive match
  const exactMatch = teams.find((t) => t.name.toLowerCase().trim() === lc)
  if (exactMatch) return { teamId: exactMatch.id, teamName: exactMatch.name, type: 'exact' }

  // 2. Normalized separators + whitespace
  const normInput = normalizeTeamKey(trimmed)
  const normMatches = teams.filter((t) => normalizeTeamKey(t.name) === normInput)
  if (normMatches.length === 1)
    return { teamId: normMatches[0].id, teamName: normMatches[0].name, type: 'smart' }

  // 3. Strip generic prefix from INPUT, match against normalized and stripped team names
  const strippedInput = stripGenericPrefix(normInput)
  if (strippedInput !== normInput) {
    const strippedMatches = [
      ...teams.filter((t) => normalizeTeamKey(t.name) === strippedInput),
      ...teams.filter((t) => stripGenericPrefix(normalizeTeamKey(t.name)) === strippedInput),
    ]
    const unique = [...new Map(strippedMatches.map((t) => [t.id, t])).values()]
    if (unique.length === 1)
      return { teamId: unique[0].id, teamName: unique[0].name, type: 'smart' }
  }

  // 4. Strip generic prefix from TEAM NAMES, match against normalized input
  const reverseMatches = teams.filter(
    (t) => stripGenericPrefix(normalizeTeamKey(t.name)) === normInput,
  )
  if (reverseMatches.length === 1)
    return { teamId: reverseMatches[0].id, teamName: reverseMatches[0].name, type: 'smart' }

  return null
}

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

function CheckIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
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
        const done   = i < currentIdx
        const active = i === currentIdx
        return (
          <div key={s.key} className="flex items-center">
            {i > 0 && (
              <div className={`h-px w-4 mx-0.5 transition-colors duration-300 ${done ? 'bg-gray-700' : 'bg-gray-200'}`} />
            )}
            <div className="flex items-center gap-1">
              <div
                className={`flex h-[18px] w-[18px] items-center justify-center rounded-full transition-all duration-200
                  ${ done   ? 'bg-gray-900 text-white'
                   : active ? 'bg-gray-900 text-white shadow-[0_0_0_3px_rgba(0,0,0,0.08)]'
                   : 'bg-gray-100 text-gray-400'} text-[9px] font-bold`}
              >
                {done ? <CheckIcon className="h-2.5 w-2.5" /> : i + 1}
              </div>
              <span className={`text-[10px] font-medium transition-colors duration-200
                ${active ? 'text-gray-900' : done ? 'text-gray-400' : 'text-gray-300'}`}>
                {s.label}
              </span>
            </div>
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
  const [contentVisible, setContentVisible] = useState(false)
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

  // Step-transition fade + slide
  useEffect(() => {
    setContentVisible(false)
    const id = requestAnimationFrame(() => setContentVisible(true))
    return () => cancelAnimationFrame(id)
  }, [step])

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
      autoMatchTeamId: null,
      autoMatchLabel: null,
    }))

    setTeamMappings(entries)
    setStep('mapping')
  }

  // ── Import ───────────────────────────────────────────────────────────────────

  function handleImport() {
    const resolutionMap = new Map<string, string | null>()
    // 1. Exact-match teams keyed by their own name
    for (const t of teams) resolutionMap.set(t.name.toLowerCase().trim(), t.id)
    // 2. Mapping-step results (smart auto-match + manual overrides)
    for (const entry of teamMappings) {
      resolutionMap.set(entry.rawInput.toLowerCase(), entry.resolvedTeamId)
    }

    const toImport: BulkImportRow[] = rows
      .filter((r) => r.name.trim().length > 0)
      .map((r) => {
        const lc = r.rawTeamInput.trim().toLowerCase()
        const fromMap = resolutionMap.has(lc) ? resolutionMap.get(lc)! : undefined
        const teamId = fromMap !== undefined
          ? fromMap
          : (matchTeam(r.rawTeamInput.trim(), teams)?.teamId ?? null)
        return { name: r.name.trim(), teamId }
      })

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

  function goBack() {
    setParseError(null)
    const prev: Partial<Record<Step, Step>> = {
      preview: 'input', mapping: 'preview', confirm: 'mapping',
    }
    const p = prev[step]
    if (p) setStep(p)
  }

  // ── Derived stats ───────────────────────────────────────────────────────────

  const rowStats = useMemo(() => {
    const total = rows.length
    const missingName = rows.filter((r) => !r.name.trim()).length
    const seenNames = new Set<string>()
    let dupCount = 0
    for (const r of rows) {
      const key = r.name.trim().toLowerCase()
      if (!key) continue
      if (seenNames.has(key)) dupCount++
      else seenNames.add(key)
    }
    return { total, missingName, dupCount }
  }, [rows])

  const validCount = rows.filter((r) => r.name.trim().length > 0).length

  /** Per-row team badge for the preview table. */
  function getRowTeamBadge(rawTeamInput: string): {
    status: 'exact' | 'smart' | 'unresolved' | 'none'
    label: string
    matchedName?: string
  } {
    const raw = rawTeamInput.trim()
    if (!raw) return { status: 'none', label: '' }
    const m = matchTeam(raw, teams)
    if (!m) return { status: 'unresolved', label: 'Review' }
    if (m.type === 'exact') return { status: 'exact', label: 'Matched' }
    return { status: 'smart', label: 'Auto-matched', matchedName: m.teamName }
  }

  /** Count of valid rows that will receive a team id after all mappings. */
  const withTeamCount = useMemo(() => {
    const resMap = new Map<string, string | null>()
    for (const t of teams) resMap.set(t.name.toLowerCase().trim(), t.id)
    for (const m of teamMappings) resMap.set(m.rawInput.toLowerCase(), m.resolvedTeamId)
    return rows.filter((r) => {
      if (!r.name.trim()) return false
      const raw = r.rawTeamInput.trim()
      if (!raw) return false
      if (resMap.has(raw.toLowerCase())) return resMap.get(raw.toLowerCase()) !== null
      return matchTeam(raw, teams) !== null
    }).length
  }, [rows, teams, teamMappings])

  // Tailwind transition class applied to all step-content wrappers
  const tx = `transition-all duration-200 ${contentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`

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
        className={`relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[88vh] transition-all duration-300 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.97]'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 tracking-tight">Import employees</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {step === 'input'   && 'Paste names or upload a file'}
                {step === 'preview' && `${rows.length} row${rows.length !== 1 ? 's' : ''} detected — review before continuing`}
                {step === 'mapping' && 'Review team assignments'}
                {step === 'confirm' && 'Confirm and start import'}
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
          <div className={`flex flex-col flex-1 min-h-0 ${tx}`}>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Paste employee names
                </label>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={9}
                  placeholder={"Jan Jansen\nPiet Pietersen, Ploeg A\nMaria de Vries, Ploeg B"}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-300 font-mono focus:border-gray-400 focus:outline-none resize-none transition-colors"
                  spellCheck={false}
                />
                <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                  One row per employee.{' '}
                  Use <code className="bg-gray-100 px-1 rounded text-gray-500">Name, Team</code> to assign a team.
                  Team names are matched against existing teams in the system.
                </p>
              </div>

              {/* File upload */}
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-5 py-4 hover:border-gray-300 transition-colors">
                <div className="flex items-center gap-3">
                  <UploadIcon />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700">Upload a file</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      .csv or .txt — for Excel, save as CSV first
                    </p>
                  </div>
                  <label className="shrink-0 cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm">
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
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-xs text-red-700">{fileError}</p>
                  </div>
                )}
              </div>

              {/* Available teams reference */}
              {teams.length > 0 && (
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3.5">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Available teams
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {teams.map((t) => (
                      <span key={t.id} className="inline-flex rounded-full bg-white border border-gray-200 px-2.5 py-0.5 text-[11px] font-medium text-gray-700 shadow-sm">
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {parseError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                  <p className="text-sm text-red-700">{parseError}</p>
                </div>
              )}
            </div>

            <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100">
              <button type="button" onClick={onClose}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleParse} disabled={!pasteText.trim()}
                className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors">
                Preview →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Preview ─────────────────────────────────────────────────── */}
        {step === 'preview' && (
          <div className={`flex flex-col flex-1 min-h-0 ${tx}`}>
            {/* Summary pill row */}
            <div className="shrink-0 px-6 py-2.5 border-b border-gray-100 bg-gray-50/80 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-gray-600">{rowStats.total} detected</span>
              {rowStats.missingName > 0 && (
                <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-medium text-amber-700">
                  {rowStats.missingName} missing name
                </span>
              )}
              {rowStats.dupCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-medium text-amber-700">
                  {rowStats.dupCount} duplicate{rowStats.dupCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white border-b border-gray-100 z-10">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-[44%]">Name</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Team</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((row) => {
                    const isEmpty = !row.name.trim()
                    const badge = getRowTeamBadge(row.rawTeamInput)
                    return (
                      <tr key={row._id} className={`${isEmpty ? 'bg-amber-50/30' : 'hover:bg-gray-50/60'} transition-colors`}>
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => updateRow(row._id, 'name', e.target.value)}
                            className={`w-full rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus:border-gray-400 transition-colors
                              ${isEmpty ? 'border-amber-300 bg-amber-50' : 'border-transparent bg-transparent hover:border-gray-200 focus:bg-white'}`}
                            placeholder="Name"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={row.rawTeamInput}
                              onChange={(e) => updateRow(row._id, 'rawTeamInput', e.target.value)}
                              className="w-full rounded-md border border-transparent bg-transparent px-2.5 py-1.5 text-sm focus:outline-none focus:border-gray-400 hover:border-gray-200 focus:bg-white transition-colors"
                              placeholder="—"
                            />
                            {badge.status === 'exact' && (
                              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-700 whitespace-nowrap">
                                <CheckIcon className="h-2.5 w-2.5" /> Matched
                              </span>
                            )}
                            {badge.status === 'smart' && (
                              <span
                                title={`Auto-matched to: ${badge.matchedName}`}
                                className="shrink-0 inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-[10px] font-medium text-sky-700 whitespace-nowrap cursor-default"
                              >
                                ✶ {badge.matchedName}
                              </span>
                            )}
                            {badge.status === 'unresolved' && (
                              <span className="shrink-0 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700 whitespace-nowrap">
                                Review
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right">
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
              <div className="px-4 py-3 border-t border-gray-50">
                <button type="button" onClick={addRow}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors">+ Add row</button>
              </div>
            </div>

            <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100">
              <button type="button" onClick={goBack}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                ← Back
              </button>
              <button type="button" onClick={handleGoToMapping} disabled={rows.length === 0}
                className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors">
                Continue →
              </button>
            </div>
          </div>
        )}
        {/* ── Step 3: Team Mapping ─────────────────────────────────────────────── */}
        {step === 'mapping' && (
          <div className={`flex flex-col flex-1 min-h-0 ${tx}`}>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
              {teamMappings.length === 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-12 text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 ring-4 ring-emerald-50">
                    <CheckIcon className="h-5 w-5 text-emerald-600" />
                  </div>
                  <p className="text-sm font-semibold text-emerald-800">All teams recognised</p>
                  <p className="text-xs text-emerald-600 mt-1">Every team value was matched — nothing to assign.</p>
                </div>
              ) : (
                <>
                  {/* Auto-matched entries */}
                  {teamMappings.some((e) => e.autoMatchTeamId !== null) && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-0.5 mb-2">
                        Auto-matched — review and confirm
                      </p>
                      {teamMappings
                        .filter((e) => e.autoMatchTeamId !== null)
                        .map((entry) => {
                          const idx = teamMappings.indexOf(entry)
                          return (
                            <div key={entry.rawInput} className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white border border-sky-200 text-sky-500 text-xs">
                                ✶
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium text-gray-700">&ldquo;{entry.rawInput}&rdquo;</span>
                                  <span className="text-xs text-gray-400">→</span>
                                  <span className="text-sm font-semibold text-gray-900">{entry.autoMatchLabel}</span>
                                </div>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                  {entry.affectedCount} employee{entry.affectedCount !== 1 ? 's' : ''} · Smart match
                                </p>
                              </div>
                              <select
                                value={entry.resolvedTeamId ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setTeamMappings((prev) =>
                                    prev.map((m, i) => i === idx ? { ...m, resolvedTeamId: val || null } : m)
                                  )
                                }}
                                className="shrink-0 rounded-lg border border-sky-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 focus:border-gray-400 focus:outline-none shadow-sm"
                              >
                                <option value="">No team</option>
                                {teams.map((t) => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                              </select>
                            </div>
                          )
                        })}
                    </div>
                  )}

                  {/* Unresolved entries */}
                  {teamMappings.some((e) => e.autoMatchTeamId === null) && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-0.5 mb-2">
                        Needs review — no match found
                      </p>
                      {teamMappings
                        .filter((e) => e.autoMatchTeamId === null)
                        .map((entry) => {
                          const idx = teamMappings.indexOf(entry)
                          return (
                            <div key={entry.rawInput} className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 font-semibold text-xs">
                                ?
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">&ldquo;{entry.rawInput}&rdquo;</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                  {entry.affectedCount} employee{entry.affectedCount !== 1 ? 's' : ''} · Unrecognised
                                </p>
                              </div>
                              <select
                                value={entry.resolvedTeamId ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setTeamMappings((prev) =>
                                    prev.map((m, i) => i === idx ? { ...m, resolvedTeamId: val || null } : m)
                                  )
                                }}
                                className="shrink-0 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 focus:border-gray-400 focus:outline-none shadow-sm"
                              >
                                <option value="">No team</option>
                                {teams.map((t) => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                              </select>
                            </div>
                          )
                        })}
                    </div>
                  )}

                  <p className="text-[11px] text-gray-400 pt-1 px-0.5">
                    New teams are never created. Employees without a team assignment will be imported without one.
                  </p>
                </>
              )}
            </div>

            <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100">
              <button type="button" onClick={goBack}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                ← Back
              </button>
              <button type="button" onClick={() => setStep('confirm')}
                className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors">
                Review import →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Confirm ─────────────────────────────────────────────────── */}
        {step === 'confirm' && (
          <div className={`flex flex-col flex-1 min-h-0 ${tx}`}>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="text-sm text-gray-500 mb-5 leading-relaxed">
                Review the summary below. Only rows with a valid name will be imported.
                Duplicates and rows without a name are skipped automatically.
              </p>

              <dl className="space-y-2">
                <SummaryRow label="Employees detected"        value={rowStats.total} />
                <SummaryRow label="Ready to import"          value={validCount}     variant="positive" />
                {rowStats.missingName > 0 && (
                  <SummaryRow label="Missing name — skipped"  value={rowStats.missingName} variant="warning" />
                )}
                {rowStats.dupCount > 0 && (
                  <SummaryRow label="Duplicates — skipped"    value={rowStats.dupCount}    variant="warning" />
                )}
                <SummaryRow label="With team assignment"      value={withTeamCount} />
              </dl>

              <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3">
                <p className="text-xs text-sky-700 leading-relaxed">
                  Placeholder emails will be assigned. Update them from each employee&apos;s detail panel after import.
                </p>
              </div>

              {parseError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-700">{parseError}</p>
                </div>
              )}
            </div>

            <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100">
              <button
                type="button"
                onClick={goBack}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={isImporting || validCount === 0}
                className="flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                {isImporting ? (
                  <>
                    <SpinnerIcon />
                    Importing…
                  </>
                ) : (
                  `Import ${validCount} employee${validCount !== 1 ? 's' : ''}`
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Done ────────────────────────────────────────────────────────────── */}
        {step === 'done' && result && (
          <div className={`flex flex-col flex-1 min-h-0 ${tx}`}>
            <div className="flex-1 overflow-y-auto px-6 py-10">
              <div className="text-center mb-8">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 ring-4 ring-emerald-50">
                  <CheckIcon className="h-7 w-7 text-emerald-600" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">Import complete</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {result.created} employee{result.created !== 1 ? 's' : ''} added successfully.
                </p>
              </div>

              <dl className="mx-auto max-w-xs space-y-2">
                <SummaryRow label="Employees created" value={result.created} variant="positive" />
                {result.skipped > 0 && (
                  <SummaryRow label="Duplicates skipped" value={result.skipped} variant="warning" />
                )}
              </dl>

              {result.created > 0 && (
                <p className="text-center text-xs text-gray-400 mt-6 leading-relaxed">
                  Placeholder emails were assigned — update them from each employee&apos;s detail panel.
                </p>
              )}
            </div>

            <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  variant = 'neutral',
}: {
  label: string
  value: number
  variant?: 'neutral' | 'positive' | 'warning'
}) {
  const bgCls = variant === 'positive'
    ? 'border-emerald-100 bg-emerald-50'
    : variant === 'warning'
    ? 'border-amber-100 bg-amber-50'
    : 'border-gray-100 bg-gray-50'
  const dtCls = variant === 'positive'
    ? 'text-emerald-700'
    : variant === 'warning'
    ? 'text-amber-700'
    : 'text-gray-600'
  const ddCls = variant === 'positive'
    ? 'text-emerald-800'
    : variant === 'warning'
    ? 'text-amber-800'
    : 'text-gray-900'
  return (
    <div className={`flex items-center justify-between rounded-lg border px-4 py-3 ${bgCls}`}>
      <dt className={`text-sm ${dtCls}`}>{label}</dt>
      <dd className={`text-sm font-semibold ${ddCls}`}>{value}</dd>
    </div>
  )
}
