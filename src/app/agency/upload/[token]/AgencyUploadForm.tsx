'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { agencyUploadAction, type TempImportRow } from '@/app/workforce/temps/actions'

function parseCsv(text: string): TempImportRow[] {
  const lines = text.trim().split('\n').filter((l) => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(/[,;\t]/).map((h) => h.trim().toLowerCase().replace(/"/g, ''))
  const nameIdx = headers.findIndex((h) => ['name', 'naam', 'medewerker'].includes(h))
  const emailIdx = headers.findIndex((h) => ['email', 'e-mail'].includes(h))
  const hoursIdx = headers.findIndex((h) => ['hours', 'uren', 'contracthours', 'contracturen'].includes(h))
  const deptIdx = headers.findIndex((h) => ['department', 'afdeling'].includes(h))
  const funcIdx = headers.findIndex((h) => ['function', 'functie'].includes(h))
  const locIdx = headers.findIndex((h) => ['location', 'locatie'].includes(h))
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

interface Props {
  token: string
  agencyName: string
  orgName: string
  notes: string | null
}

export default function AgencyUploadForm({ token, agencyName, orgName, notes }: Props) {
  const [step, setStep] = useState<'upload' | 'preview' | 'uploading' | 'done' | 'error'>('upload')
  const [rows, setRows] = useState<TempImportRow[]>([])
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const parsed = parseCsv(e.target?.result as string)
      if (parsed.length === 0) { setError('Geen geldige rijen gevonden.'); return }
      setRows(parsed); setStep('preview'); setError(null)
    }
    reader.readAsText(file)
  }

  function handlePaste() {
    const parsed = parseCsv(pasteText)
    if (parsed.length === 0) { setError('Geen geldige rijen gevonden.'); return }
    setRows(parsed); setStep('preview'); setError(null)
  }

  async function handleUpload() {
    setStep('uploading')
    const res = await agencyUploadAction(token, rows)
    if (res.ok) {
      setResult({ created: res.created, skipped: res.skipped })
      setStep('done')
    } else {
      setError(res.error)
      setStep('error')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-5 text-white">
          <div className="flex items-center gap-3 mb-2">
            <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="48" fill="rgba(255,255,255,0.15)" />
              <path d="M50 18L26 78C30 68 40 64 50 68C60 72 68 78 74 78L50 18Z" fill="white" />
              <path d="M50 38L40 58H60L50 38Z" fill="rgba(255,255,255,0.3)" />
            </svg>
            <div>
              <h1 className="text-lg font-bold">Planner Ascentra</h1>
              <p className="text-xs text-white/70">Temp medewerker upload</p>
            </div>
          </div>
          <p className="text-sm text-white/90">
            {agencyName} — upload uitzendkrachten voor <strong>{orgName}</strong>
          </p>
          {notes && <p className="text-xs text-white/60 mt-1.5 italic">{notes}</p>}
        </div>

        <div className="p-6">
          {step === 'upload' && (
            <div className="space-y-5">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); e.dataTransfer.files?.[0] && handleFile(e.dataTransfer.files[0]) }}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                  ${dragOver ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm font-medium text-gray-700">Sleep een CSV-bestand hierheen</p>
                <p className="text-xs text-gray-400 mt-1">of klik om te selecteren</p>
                <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" /><span className="text-xs text-gray-400">OF</span><div className="flex-1 h-px bg-gray-200" />
              </div>

              <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={5}
                placeholder={"naam,email,uren,afdeling\nJan de Vries,jan@bureau.nl,40,Warehouse"}
                className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/20" />
              <button onClick={handlePaste} disabled={!pasteText.trim()}
                className="w-full py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-40 transition-colors">
                Verwerken
              </button>

              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
                <p className="font-semibold text-gray-700 mb-1">Formaat:</p>
                <p>Kolommen: <strong>naam</strong> (verplicht), email, uren, afdeling, functie, locatie</p>
                <p>Scheidingsteken: komma, puntkomma, of tab</p>
              </div>

              {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-700">{rows.length} medewerkers gevonden</p>
              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-[250px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">Naam</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">Email</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">Uren</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">Afdeling</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-medium text-gray-900">{r.name}</td>
                        <td className="px-3 py-2 text-gray-500">{r.email || '-'}</td>
                        <td className="px-3 py-2 text-gray-500">{r.contractHours ?? '-'}</td>
                        <td className="px-3 py-2 text-gray-500">{r.department || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setStep('upload'); setRows([]) }} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Terug</button>
                <button onClick={handleUpload} className="flex-1 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700">Uploaden</button>
              </div>
            </div>
          )}

          {step === 'uploading' && (
            <div className="flex flex-col items-center py-8">
              <motion.div className="w-10 h-10 border-3 border-violet-200 border-t-violet-600 rounded-full" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
              <p className="text-sm text-gray-500 mt-4">Medewerkers uploaden...</p>
            </div>
          )}

          {step === 'done' && result && (
            <div className="flex flex-col items-center py-8 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
              </motion.div>
              <h3 className="text-xl font-bold text-gray-900">Upload geslaagd!</h3>
              <p className="text-sm text-gray-500 mt-1">
                <strong className="text-emerald-600">{result.created}</strong> uitzendkrachten toegevoegd aan {orgName}
                {result.skipped > 0 && <><br /><span className="text-gray-400">{result.skipped} overgeslagen (duplicaat)</span></>}
              </p>
              <p className="text-xs text-gray-400 mt-4">U kunt dit venster sluiten.</p>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Upload mislukt</h3>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
