'use client'

import { useState, useTransition, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { LeaveRecordRow } from '@/lib/queries/leave'
import { createLeaveAction, updateLeaveStatusAction, deleteLeaveAction } from '@/app/leave/actions'
import { BorderBeam } from '@/components/ui/border-beam'

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  records: LeaveRecordRow[]
  employees: { id: string; name: string; employeeType: string }[]
  mode: 'leave' | 'absence'
}

const LEAVE_CATEGORIES = [
  { value: 'vacation', label: 'Vakantie', icon: '🏖️', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'personal', label: 'Persoonlijk', icon: '🏠', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { value: 'unpaid', label: 'Onbetaald verlof', icon: '📋', color: 'bg-gray-100 text-gray-700 border-gray-200' },
]

const ABSENCE_CATEGORIES = [
  { value: 'sick', label: 'Ziek', icon: '🤒', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'emergency', label: 'Noodgeval', icon: '🚨', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'other', label: 'Overig', icon: '📝', color: 'bg-gray-100 text-gray-700 border-gray-200' },
]

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
}

function getCategoryInfo(category: string, type: 'leave' | 'absence') {
  const cats = type === 'leave' ? LEAVE_CATEGORIES : ABSENCE_CATEGORIES
  return cats.find((c) => c.value === category) ?? { value: category, label: category, icon: '📄', color: 'bg-gray-100 text-gray-600 border-gray-200' }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1
}

// ── Create form ──────────────────────────────────────────────────────────────

function CreateForm({ employees, mode, onCreated }: {
  employees: Props['employees']
  mode: 'leave' | 'absence'
  onCreated: () => void
}) {
  const [employeeId, setEmployeeId] = useState('')
  const [category, setCategory] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const categories = mode === 'leave' ? LEAVE_CATEGORIES : ABSENCE_CATEGORIES

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!employeeId || !category || !startDate || !endDate) return
    setError(null)
    startTransition(async () => {
      const res = await createLeaveAction({
        employeeId,
        type: mode,
        category,
        startDate,
        endDate,
        notes: notes || undefined,
      })
      if (!res.ok) { setError(res.error); return }
      setEmployeeId(''); setCategory(''); setStartDate(''); setEndDate(''); setNotes('')
      onCreated()
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden"
    >
      <BorderBeam size={150} duration={12} colorFrom={mode === 'leave' ? '#3B82F6' : '#EF4444'} colorTo={mode === 'leave' ? '#8B5CF6' : '#F97316'} borderWidth={1.5} />
      <h3 className="text-sm font-bold text-gray-900 mb-4">
        {mode === 'leave' ? 'Verlof registreren' : 'Verzuim melden'}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Employee */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Medewerker</label>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            required
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/30"
          >
            <option value="">Selecteer medewerker...</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Reden</label>
          <div className="grid grid-cols-3 gap-2">
            {categories.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                className={[
                  'rounded-xl border-2 px-3 py-2.5 text-center transition-all duration-200 cursor-pointer',
                  category === cat.value
                    ? `border-[#4F6BFF] bg-blue-50/60 shadow-[0_0_0_3px_rgba(79,107,255,0.10)]`
                    : 'border-gray-200 bg-white hover:border-gray-300',
                ].join(' ')}
              >
                <span className="text-lg block">{cat.icon}</span>
                <span className="text-[11px] font-medium text-gray-700 mt-0.5 block">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Van</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/30" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Tot en met</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required min={startDate} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/30" />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Notities <span className="text-gray-300 normal-case">(optioneel)</span></label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Extra toelichting..." className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/30" />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isPending || !employeeId || !category || !startDate || !endDate}
          className="w-full rounded-xl bg-gradient-to-r from-[#4F6BFF] to-[#6C83FF] text-white py-2.5 text-sm font-semibold shadow-[0_4px_14px_rgba(79,107,255,0.35)] hover:shadow-[0_6px_20px_rgba(79,107,255,0.45)] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:hover:transform-none"
        >
          {isPending ? 'Registreren...' : mode === 'leave' ? 'Verlof aanvragen' : 'Verzuim melden'}
        </button>
      </form>
    </motion.div>
  )
}

// ── Record card ──────────────────────────────────────────────────────────────

function RecordCard({ record, mode }: { record: LeaveRecordRow; mode: 'leave' | 'absence' }) {
  const [isPending, startTransition] = useTransition()
  const cat = getCategoryInfo(record.category, mode)
  const days = daysBetween(record.startDate, record.endDate)
  const isActive = record.status !== 'rejected' && record.endDate >= new Date().toISOString().slice(0, 10)

  function handleApprove() {
    startTransition(async () => { await updateLeaveStatusAction(record.id, 'approved') })
  }
  function handleReject() {
    startTransition(async () => { await updateLeaveStatusAction(record.id, 'rejected') })
  }
  function handleDelete() {
    if (!confirm('Weet je zeker dat je dit wilt verwijderen?')) return
    startTransition(async () => { await deleteLeaveAction(record.id) })
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={[
        'group rounded-xl border bg-white px-4 py-3 transition-all duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]',
        isActive ? 'border-gray-200' : 'border-gray-100 opacity-60',
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        {/* Category icon */}
        <span className="text-xl shrink-0">{cat.icon}</span>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 truncate">{record.employeeName}</span>
            <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cat.color}`}>{cat.label}</span>
            <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[record.status] ?? STATUS_STYLES.pending}`}>
              {record.status === 'pending' ? 'In afwachting' : record.status === 'approved' ? 'Goedgekeurd' : 'Afgewezen'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {formatDate(record.startDate)} – {formatDate(record.endDate)}
            <span className="ml-1.5 text-gray-300">({days} dag{days !== 1 ? 'en' : ''})</span>
          </p>
          {record.notes && <p className="text-xs text-gray-500 mt-1 italic">{record.notes}</p>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {mode === 'leave' && record.status === 'pending' && (
            <>
              <button onClick={handleApprove} disabled={isPending} title="Goedkeuren"
                className="flex items-center justify-center w-7 h-7 rounded-lg text-emerald-500 hover:bg-emerald-50 transition-colors disabled:opacity-40">
                <svg className="w-4 h-4" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button onClick={handleReject} disabled={isPending} title="Afwijzen"
                className="flex items-center justify-center w-7 h-7 rounded-lg text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40">
                <svg className="w-4 h-4" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </button>
            </>
          )}
          <button onClick={handleDelete} disabled={isPending} title="Verwijderen"
            className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M5 4V2.5h4V4M3.5 4v7.5a1 1 0 001 1h5a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ── Main view ────────────────────────────────────────────────────────────────

export default function LeaveAbsenceView({ records, employees, mode }: Props) {
  const [, forceUpdate] = useState(0)

  const title = mode === 'leave' ? 'Verlof' : 'Verzuim'
  const subtitle = mode === 'leave'
    ? 'Vakantiedagen, persoonlijk verlof en onbetaald verlof beheren.'
    : 'Ziekteverzuim, noodgevallen en overige afwezigheid registreren.'

  // Stats
  const now = new Date().toISOString().slice(0, 10)
  const active = records.filter((r) => r.status !== 'rejected' && r.endDate >= now)
  const pending = records.filter((r) => r.status === 'pending')
  const totalDays = active.reduce((sum, r) => sum + daysBetween(r.startDate, r.endDate), 0)
  const uniqueEmployees = new Set(active.map((r) => r.employeeId)).size

  // Group by status
  const pendingRecords = useMemo(() => records.filter((r) => r.status === 'pending'), [records])
  const approvedRecords = useMemo(() => records.filter((r) => r.status === 'approved'), [records])
  const rejectedRecords = useMemo(() => records.filter((r) => r.status === 'rejected'), [records])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 pb-5 border-b border-[#E6E8F0]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1">Planning</p>
          <h1 className="text-[22px] font-bold text-gray-900 leading-tight">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="relative rounded-xl border border-gray-200 bg-white p-4 overflow-hidden">
          <div className="text-2xl font-bold text-[#4F6BFF] tabular-nums">{active.length}</div>
          <div className="text-[11px] text-gray-400 font-medium mt-0.5">Actief</div>
        </div>
        {mode === 'leave' && (
          <div className="relative rounded-xl border border-gray-200 bg-white p-4 overflow-hidden">
            <div className={`text-2xl font-bold tabular-nums ${pending.length > 0 ? 'text-amber-500' : 'text-gray-300'}`}>{pending.length}</div>
            <div className="text-[11px] text-gray-400 font-medium mt-0.5">In afwachting</div>
          </div>
        )}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold text-gray-900 tabular-nums">{totalDays}</div>
          <div className="text-[11px] text-gray-400 font-medium mt-0.5">Dagen totaal</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold text-gray-900 tabular-nums">{uniqueEmployees}</div>
          <div className="text-[11px] text-gray-400 font-medium mt-0.5">Medewerkers</div>
        </div>
      </div>

      {/* Content: Create form + Records */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create form */}
        <div>
          <CreateForm employees={employees} mode={mode} onCreated={() => forceUpdate((n) => n + 1)} />
        </div>

        {/* Records list */}
        <div className="lg:col-span-2 space-y-4">
          {/* Pending (leave only) */}
          {mode === 'leave' && pendingRecords.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                In afwachting ({pendingRecords.length})
              </h3>
              <div className="space-y-2">
                {pendingRecords.map((r) => <RecordCard key={r.id} record={r} mode={mode} />)}
              </div>
            </div>
          )}

          {/* Approved / Active */}
          {approvedRecords.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                {mode === 'leave' ? 'Goedgekeurd' : 'Geregistreerd'} ({approvedRecords.length})
              </h3>
              <div className="space-y-2">
                {approvedRecords.map((r) => <RecordCard key={r.id} record={r} mode={mode} />)}
              </div>
            </div>
          )}

          {/* Rejected (leave only) */}
          {mode === 'leave' && rejectedRecords.length > 0 && (
            <details className="group">
              <summary className="text-xs font-medium text-gray-300 cursor-pointer hover:text-gray-500 transition-colors">
                Afgewezen ({rejectedRecords.length})
              </summary>
              <div className="space-y-2 mt-2">
                {rejectedRecords.map((r) => <RecordCard key={r.id} record={r} mode={mode} />)}
              </div>
            </details>
          )}

          {/* Empty state */}
          {records.length === 0 && (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl border border-gray-200 bg-white shadow-sm mb-4">
                <span className="text-2xl">{mode === 'leave' ? '🏖️' : '🤒'}</span>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                {mode === 'leave' ? 'Geen verlofregistraties' : 'Geen verzuimregistraties'}
              </h3>
              <p className="text-[13px] text-gray-500 max-w-[280px] mx-auto">
                {mode === 'leave' ? 'Registreer vakantie- of verlofdagen via het formulier.' : 'Meld ziekte of afwezigheid via het formulier.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
