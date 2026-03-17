'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { TempEmployee, TempStats, AgencyToken, TempImportRow } from '@/app/workforce/temps/actions'
import {
  createTempAction,
  bulkImportTempsAction,
  createAgencyTokenAction,
  revokeAgencyTokenAction,
  deactivateTempAction,
  activateTempAction,
} from '@/app/workforce/temps/actions'
import { HoldButton } from '@/components/ui/hold-button'
import {
  Plus,
  Upload,
  Link2,
  Users,
  UserCheck,
  UserX,
  Clock,
  Search,
  X,
  FileSpreadsheet,
  Building,
  Copy,
  Trash2,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Shield,
} from 'lucide-react'
import { fileToText, isSupportedFile } from '@/lib/import/excelToText'

// ── Props ───────────────────────────────────────────────────────────────────

interface Props {
  temps: TempEmployee[]
  stats: TempStats
  tokens: AgencyToken[]
  departments: { id: string; name: string }[]
  functions: { id: string; name: string }[]
  locations: { id: string; name: string }[]
  canManage: boolean
}

// ── CSV parser ──────────────────────────────────────────────────────────────

function parseCsv(text: string): TempImportRow[] {
  const lines = text.trim().split('\n').filter((l) => l.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(/[,;\t]/).map((h) => h.trim().toLowerCase().replace(/"/g, ''))
  const nameIdx = headers.findIndex((h) => ['name', 'naam', 'medewerker'].includes(h))
  const emailIdx = headers.findIndex((h) => ['email', 'e-mail'].includes(h))
  const hoursIdx = headers.findIndex((h) => ['hours', 'uren', 'contracthours', 'contract_hours', 'contracturen'].includes(h))
  const deptIdx = headers.findIndex((h) => ['department', 'afdeling', 'dept'].includes(h))
  const funcIdx = headers.findIndex((h) => ['function', 'functie', 'role', 'rol'].includes(h))
  const locIdx = headers.findIndex((h) => ['location', 'locatie', 'vestiging'].includes(h))

  if (nameIdx === -1) return []

  return lines.slice(1).map((line) => {
    const cols = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''))
    return {
      name: cols[nameIdx] ?? '',
      email: emailIdx >= 0 ? cols[emailIdx] : undefined,
      contractHours: hoursIdx >= 0 ? parseFloat(cols[hoursIdx]) || 0 : undefined,
      department: deptIdx >= 0 ? cols[deptIdx] : undefined,
      function: funcIdx >= 0 ? cols[funcIdx] : undefined,
      location: locIdx >= 0 ? cols[locIdx] : undefined,
    }
  }).filter((r) => r.name.trim().length > 0)
}

// ── Import modal ────────────────────────────────────────────────────────────

function ImportModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [rows, setRows] = useState<TempImportRow[]>([])
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [pasteText, setPasteText] = useState('')

  async function handleFile(file: File) {
    if (!isSupportedFile(file.name)) {
      setError('Ondersteunde formaten: .csv, .txt, .tsv, .xlsx, .xls')
      return
    }
    try {
      const text = await fileToText(file)
      const parsed = parseCsv(text)
      if (parsed.length === 0) {
        setError('Geen geldige rijen gevonden. Zorg dat de eerste rij kolomnamen bevat (minimaal "naam" of "name").')
        return
      }
      setRows(parsed)
      setStep('preview')
      setError(null)
    } catch {
      setError('Kan bestand niet lezen.')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function handlePaste() {
    if (!pasteText.trim()) return
    const parsed = parseCsv(pasteText)
    if (parsed.length === 0) {
      setError('Geen geldige rijen gevonden.')
      return
    }
    setRows(parsed)
    setStep('preview')
    setError(null)
  }

  async function handleImport() {
    setImporting(true)
    const res = await bulkImportTempsAction(rows)
    setImporting(false)
    if (res.ok) {
      setResult({ created: res.created, skipped: res.skipped })
      setStep('done')
    } else {
      setError(res.error)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Upload className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Temps importeren</h2>
              <p className="text-xs text-gray-400">Upload een CSV of plak data</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 'upload' && (
            <div className="space-y-5">
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                  ${dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
              >
                <FileSpreadsheet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Sleep een bestand hierheen</p>
                <p className="text-xs text-gray-400 mt-1">CSV, Excel (.xlsx, .xls) of klik om te selecteren</p>
                <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">OF</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Paste area */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Plak CSV data</label>
                <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={6}
                  placeholder={"naam,email,uren,afdeling\nJan de Vries,jan@bureau.nl,40,Warehouse\nPiet Bakker,,32,Logistics"}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 resize-none" />
                <button onClick={handlePaste} disabled={!pasteText.trim()}
                  className="mt-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                  Verwerken
                </button>
              </div>

              {/* Format hint */}
              <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-1">
                <p className="font-semibold text-gray-700">Ondersteunde kolommen:</p>
                <p><span className="font-medium">naam</span> (verplicht), email, uren, afdeling, functie, locatie</p>
                <p>Scheidingsteken: komma, puntkomma, of tab. Eerste rij = kolomnamen.</p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">{rows.length} rijen gevonden</p>
                <button onClick={() => { setStep('upload'); setRows([]); setPasteText('') }}
                  className="text-xs text-gray-500 hover:text-gray-700">Opnieuw beginnen</button>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">#</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Naam</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Email</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Uren</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Afdeling</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Functie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-400 tabular-nums">{i + 1}</td>
                          <td className="px-3 py-2 font-medium text-gray-900">{r.name}</td>
                          <td className="px-3 py-2 text-gray-500">{r.email || '-'}</td>
                          <td className="px-3 py-2 text-gray-500 tabular-nums">{r.contractHours ?? '-'}</td>
                          <td className="px-3 py-2 text-gray-500">{r.department || '-'}</td>
                          <td className="px-3 py-2 text-gray-500">{r.function || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
            </div>
          )}

          {step === 'done' && result && (
            <div className="flex flex-col items-center py-8 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
              </motion.div>
              <h3 className="text-lg font-bold text-gray-900">Import voltooid!</h3>
              <p className="text-sm text-gray-500 mt-1">
                <span className="font-semibold text-emerald-600">{result.created}</span> temps aangemaakt
                {result.skipped > 0 && <>, <span className="font-semibold text-gray-600">{result.skipped}</span> overgeslagen (duplicaat)</>}
              </p>
            </div>
          )}
        </div>

        {step === 'preview' && (
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
            <button onClick={() => { setStep('upload'); setRows([]) }} className="text-sm text-gray-500 hover:text-gray-700">Annuleren</button>
            <HoldButton
              onConfirm={handleImport}
              holdDuration={1200}
              label={`${rows.length} temps importeren`}
              holdLabel="Vasthouden..."
              confirmedLabel="Geimporteerd!"
              disabled={importing}
              className="px-4 py-2 text-sm"
            />
          </div>
        )}

        {step === 'done' && (
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end shrink-0">
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">Sluiten</button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ── Create single temp modal ────────────────────────────────────────────────

function CreateTempModal({ onClose, departments, functions, locations }: {
  onClose: () => void
  departments: Props['departments']
  functions: Props['functions']
  locations: Props['locations']
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [hours, setHours] = useState(0)
  const [deptId, setDeptId] = useState('')
  const [funcId, setFuncId] = useState('')
  const [locId, setLocId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleCreate() {
    setSubmitting(true)
    await createTempAction({ name, email: email || undefined, contractHours: hours, departmentId: deptId || undefined, functionId: funcId || undefined, locationId: locId || undefined })
    setSubmitting(false)
    onClose()
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Nieuwe uitzendkracht</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Naam *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Volledige naam"
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optioneel"
                className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contract uren</label>
              <input type="number" value={hours} onChange={(e) => setHours(parseFloat(e.target.value) || 0)} min={0}
                className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Afdeling</label>
              <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-2 py-2.5 text-sm">
                <option value="">—</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Functie</label>
              <select value={funcId} onChange={(e) => setFuncId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-2 py-2.5 text-sm">
                <option value="">—</option>
                {functions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Locatie</label>
              <select value={locId} onChange={(e) => setLocId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-2 py-2.5 text-sm">
                <option value="">—</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">Annuleren</button>
          <button onClick={handleCreate} disabled={submitting || !name.trim()}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors">
            <Plus className="w-4 h-4 inline mr-1 -mt-0.5" /> Aanmaken
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Agency link modal ───────────────────────────────────────────────────────

function AgencyLinkModal({ onClose }: { onClose: () => void }) {
  const [agencyName, setAgencyName] = useState('')
  const [agencyEmail, setAgencyEmail] = useState('')
  const [days, setDays] = useState(7)
  const [notes, setNotes] = useState('')
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleCreate() {
    if (!agencyName.trim()) return
    setSubmitting(true)
    const res = await createAgencyTokenAction({ agencyName, agencyEmail: agencyEmail || undefined, expiresInDays: days, notes: notes || undefined })
    setSubmitting(false)
    if (res.ok) {
      setGeneratedUrl(`${window.location.origin}/agency/upload/${res.token}`)
    }
  }

  async function handleCopy() {
    if (!generatedUrl) return
    await navigator.clipboard.writeText(generatedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Bureau upload link</h2>
              <p className="text-xs text-gray-400">Maak een eenmalige link voor het uitzendbureau</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {!generatedUrl ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bureau naam *</label>
                <input value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="bijv. Randstad"
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email bureau</label>
                <input value={agencyEmail} onChange={(e) => setAgencyEmail(e.target.value)} placeholder="optioneel"
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Geldig voor</label>
                <select value={days} onChange={(e) => setDays(parseInt(e.target.value))}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm">
                  <option value={1}>1 dag</option>
                  <option value={3}>3 dagen</option>
                  <option value={7}>7 dagen</option>
                  <option value={14}>14 dagen</option>
                  <option value={30}>30 dagen</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notities</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Extra instructies voor het bureau..."
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none resize-none" />
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-emerald-700">Link aangemaakt!</p>
                <p className="text-xs text-emerald-600 mt-1">Deel deze link met {agencyName}</p>
              </div>
              <div className="flex items-center gap-2">
                <input readOnly value={generatedUrl}
                  className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs font-mono text-gray-600 truncate" />
                <button onClick={handleCopy}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-700 transition-colors">
                  <Copy className="w-3.5 h-3.5" /> {copied ? 'Gekopieerd!' : 'Kopieer'}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 text-center">
                <Shield className="w-3 h-3 inline mr-1" />
                Eenmalig gebruik &#8226; Verloopt na {days} dag{days > 1 ? 'en' : ''}
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          {!generatedUrl ? (
            <>
              <button onClick={onClose} className="text-sm text-gray-500">Annuleren</button>
              <button onClick={handleCreate} disabled={submitting || !agencyName.trim()}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-40 transition-colors">
                <Link2 className="w-4 h-4 inline mr-1 -mt-0.5" /> Link aanmaken
              </button>
            </>
          ) : (
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">Sluiten</button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function TempEmployeesView({ temps, stats, tokens, departments, functions, locations, canManage }: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [showImport, setShowImport] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showAgencyLink, setShowAgencyLink] = useState(false)
  const [expandedTokens, setExpandedTokens] = useState(false)

  const filtered = useMemo(() => {
    let list = temps
    if (statusFilter !== 'all') list = list.filter((t) => t.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((t) => t.name.toLowerCase().includes(q) || t.department?.toLowerCase().includes(q) || t.team?.toLowerCase().includes(q))
    }
    return list
  }, [temps, search, statusFilter])

  const handleRevoke = useCallback(async (id: string) => {
    await revokeAgencyTokenAction(id)
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-5 border-b border-[#E6E8F0] flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1">Workforce</p>
          <h1 className="text-[22px] font-bold text-gray-900 leading-tight">Uitzendkrachten</h1>
          <p className="mt-1 text-sm text-gray-500">Beheer je temp pool: importeer, volg en plan uitzendkrachten.</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAgencyLink(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-violet-200 text-violet-600 hover:bg-violet-50 transition-colors">
              <Link2 className="w-4 h-4" /> Bureau link
            </button>
            <button onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
              <Upload className="w-4 h-4" /> Importeren
            </button>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200">
              <Plus className="w-4 h-4" /> Nieuwe temp
            </button>
          </div>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Totaal', value: stats.total, icon: <Users className="w-4 h-4" />, color: 'text-indigo-600 bg-indigo-50' },
          { label: 'Actief', value: stats.active, icon: <UserCheck className="w-4 h-4" />, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Inactief', value: stats.inactive, icon: <UserX className="w-4 h-4" />, color: 'text-gray-600 bg-gray-50' },
          { label: 'Met shifts', value: stats.withAssignments, icon: <Clock className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50' },
          { label: 'Gem. uren', value: stats.avgContractHours, icon: <Clock className="w-4 h-4" />, color: 'text-violet-600 bg-violet-50' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className={`w-8 h-8 rounded-lg ${kpi.color} flex items-center justify-center mb-2`}>{kpi.icon}</div>
            <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Agency upload tokens */}
      {tokens.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <button onClick={() => setExpandedTokens(!expandedTokens)}
            className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-violet-500" />
              <span className="text-sm font-medium text-gray-700">Bureau upload links</span>
              <span className="text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full font-semibold">{tokens.length}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedTokens ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {expandedTokens && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="px-5 pb-4 space-y-2">
                  {tokens.map((t) => {
                    const expired = new Date(t.expiresAt) < new Date()
                    const used = !!t.usedAt
                    return (
                      <div key={t.id} className={`flex items-center justify-between rounded-lg border px-4 py-3 text-xs
                        ${used ? 'bg-emerald-50 border-emerald-200' : expired ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-gray-900">{t.agencyName}</span>
                          {used ? (
                            <span className="ml-2 text-emerald-600">Gebruikt &#8226; {t.uploadedCount} temps</span>
                          ) : expired ? (
                            <span className="ml-2 text-red-500">Verlopen</span>
                          ) : (
                            <span className="ml-2 text-gray-400">Verloopt {new Date(t.expiresAt).toLocaleDateString('nl-NL')}</span>
                          )}
                          <span className="ml-2 text-gray-400">door {t.createdByName}</span>
                        </div>
                        {!used && !expired && canManage && (
                          <div className="flex items-center gap-2">
                            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/agency/upload/${t.token}`) }}
                              className="p-1 rounded text-gray-400 hover:text-gray-600"><Copy className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleRevoke(t.id)}
                              className="p-1 rounded text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Zoek op naam, afdeling, team..."
            className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(['all', 'active', 'inactive'] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${statusFilter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {s === 'all' ? 'Alles' : s === 'active' ? 'Actief' : 'Inactief'}
            </button>
          ))}
        </div>
      </div>

      {/* Employee table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-gray-200">
          <Users className="w-10 h-10 text-gray-200 mb-3" />
          <h3 className="text-lg font-bold text-gray-900 mb-1">Geen uitzendkrachten</h3>
          <p className="text-sm text-gray-500 max-w-xs">
            {temps.length === 0 ? 'Importeer of maak uitzendkrachten aan om te beginnen.' : 'Geen resultaten voor deze zoekopdracht.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Medewerker</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Afdeling</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Functie</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Uren</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Shifts</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  {canManage && <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Acties</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => (
                  <tr key={t.id} className={`border-t border-gray-100 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                          {t.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                          {t.team && <p className="text-[11px] text-gray-400 truncate">{t.team}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{t.department ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{t.employeeFunction ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center tabular-nums">{t.contractHours}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-full text-[10px] font-semibold
                        ${t.assignmentCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                        {t.assignmentCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold
                        ${t.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${t.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        {t.status === 'active' ? 'Actief' : 'Inactief'}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        {t.status === 'active' ? (
                          <button onClick={() => deactivateTempAction(t.id)}
                            className="text-[11px] font-medium text-gray-400 hover:text-red-600 transition-colors">Deactiveren</button>
                        ) : (
                          <button onClick={() => activateTempAction(t.id)}
                            className="text-[11px] font-medium text-gray-400 hover:text-emerald-600 transition-colors">Activeren</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            {filtered.length} van {temps.length} uitzendkrachten
          </div>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showImport && <ImportModal onClose={() => setShowImport(false)} />}
        {showCreate && <CreateTempModal onClose={() => setShowCreate(false)} departments={departments} functions={functions} locations={locations} />}
        {showAgencyLink && <AgencyLinkModal onClose={() => setShowAgencyLink(false)} />}
      </AnimatePresence>
    </div>
  )
}
