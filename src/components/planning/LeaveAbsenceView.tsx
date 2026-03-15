'use client'

import { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { LeaveRecordRow } from '@/lib/queries/leave'
import { createLeaveAction, updateLeaveStatusAction, deleteLeaveAction } from '@/app/leave/actions'
import { BorderBeam } from '@/components/ui/border-beam'

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  records: LeaveRecordRow[]
  employees: { id: string; name: string; employeeType: string }[]
  totalEmployeeCount: number
  mode: 'leave' | 'absence'
}

const LEAVE_CATEGORIES = [
  { value: 'vacation', label: 'Vakantie', icon: '🏖️', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'personal', label: 'Persoonlijk', icon: '🏠', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { value: 'unpaid', label: 'Onbetaald', icon: '📋', color: 'bg-gray-100 text-gray-700 border-gray-200' },
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

const ALERT_THRESHOLD = 0.15 // 15% of workforce on leave = alert

function getCategoryInfo(category: string, type: 'leave' | 'absence') {
  const cats = type === 'leave' ? LEAVE_CATEGORIES : ABSENCE_CATEGORIES
  return cats.find((c) => c.value === category) ?? { value: category, label: category, icon: '📄', color: 'bg-gray-100 text-gray-600 border-gray-200' }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1
}

function getWeekNumber(date: Date): number {
  const d = new Date(date)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}

// ── Searchable employee selector ─────────────────────────────────────────────

function EmployeeSearch({ employees, value, onChange }: {
  employees: Props['employees']
  value: string
  onChange: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = employees.find((e) => e.id === value)
  const filtered = useMemo(() => {
    if (!query) return employees.slice(0, 20)
    const q = query.toLowerCase()
    return employees.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 20)
  }, [employees, query])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <div
        onClick={() => setOpen(true)}
        className={[
          'flex items-center gap-2 w-full rounded-xl border bg-white px-3 py-2.5 text-sm cursor-pointer transition-colors',
          open ? 'border-[#4F6BFF] ring-2 ring-[#4F6BFF]/20' : 'border-gray-200 hover:border-gray-300',
        ].join(' ')}
      >
        {selected ? (
          <>
            <span className="flex-1 text-gray-900 font-medium">{selected.name}</span>
            <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${selected.employeeType === 'internal' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
              {selected.employeeType}
            </span>
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(''); setQuery('') }} className="text-gray-400 hover:text-gray-600">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10 4L4 10M4 4l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          </>
        ) : (
          <span className="text-gray-400">Zoek medewerker...</span>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full mt-1 left-0 right-0 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden"
          >
            <div className="p-2 border-b border-gray-100">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Typ om te zoeken..."
                className="w-full rounded-lg bg-gray-50 px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Geen resultaten</p>
              ) : (
                filtered.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => { onChange(emp.id); setOpen(false); setQuery('') }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="flex-1 text-gray-900">{emp.name}</span>
                    <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${emp.employeeType === 'internal' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                      {emp.employeeType}
                    </span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
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
      const res = await createLeaveAction({ employeeId, type: mode, category, startDate, endDate, notes: notes || undefined })
      if (!res.ok) { setError(res.error); return }
      setEmployeeId(''); setCategory(''); setStartDate(''); setEndDate(''); setNotes('')
      onCreated()
    })
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <BorderBeam size={150} duration={12} colorFrom={mode === 'leave' ? '#3B82F6' : '#EF4444'} colorTo={mode === 'leave' ? '#8B5CF6' : '#F97316'} borderWidth={1.5} />
      <h3 className="text-sm font-bold text-gray-900 mb-4">{mode === 'leave' ? 'Verlof registreren' : 'Verzuim melden'}</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Medewerker</label>
          <EmployeeSearch employees={employees} value={employeeId} onChange={setEmployeeId} />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Reden</label>
          <div className="grid grid-cols-3 gap-2">
            {categories.map((cat) => (
              <button key={cat.value} type="button" onClick={() => setCategory(cat.value)}
                className={['rounded-xl border-2 px-3 py-2.5 text-center transition-all duration-200 cursor-pointer',
                  category === cat.value ? 'border-[#4F6BFF] bg-blue-50/60 shadow-[0_0_0_3px_rgba(79,107,255,0.10)]' : 'border-gray-200 bg-white hover:border-gray-300',
                ].join(' ')}>
                <span className="text-lg block">{cat.icon}</span>
                <span className="text-[11px] font-medium text-gray-700 mt-0.5 block">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

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

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Notities <span className="text-gray-300 normal-case">(optioneel)</span></label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Extra toelichting..." className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/30" />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button type="submit" disabled={isPending || !employeeId || !category || !startDate || !endDate}
          className="w-full rounded-xl bg-gradient-to-r from-[#4F6BFF] to-[#6C83FF] text-white py-2.5 text-sm font-semibold shadow-[0_4px_14px_rgba(79,107,255,0.35)] hover:shadow-[0_6px_20px_rgba(79,107,255,0.45)] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:hover:transform-none">
          {isPending ? 'Registreren...' : mode === 'leave' ? 'Verlof aanvragen' : 'Verzuim melden'}
        </button>
      </form>
    </motion.div>
  )
}

// ── Weekly leave chart ────────────────────────────────────────────────────────

function WeeklyLeaveChart({ records, totalEmployees, mode }: { records: LeaveRecordRow[]; totalEmployees: number; mode: 'leave' | 'absence' }) {
  // Compute leave count per ISO week for the current year
  const weekData = useMemo(() => {
    const year = new Date().getFullYear()
    const weeks: { week: number; count: number; pct: number; alert: boolean }[] = []

    for (let w = 1; w <= 52; w++) {
      // Get Monday of this ISO week
      const jan4 = new Date(year, 0, 4)
      const dayOfWeek = jan4.getDay() || 7
      const monday = new Date(jan4)
      monday.setDate(jan4.getDate() - dayOfWeek + 1 + (w - 1) * 7)

      // Count unique employees on leave during this week
      const employeesOnLeave = new Set<string>()
      for (const r of records) {
        if (r.status === 'rejected') continue
        for (let d = 0; d < 7; d++) {
          const checkDate = new Date(monday)
          checkDate.setDate(monday.getDate() + d)
          const iso = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`
          if (iso >= r.startDate && iso <= r.endDate) {
            employeesOnLeave.add(r.employeeId)
          }
        }
      }

      const count = employeesOnLeave.size
      const pct = totalEmployees > 0 ? count / totalEmployees : 0
      weeks.push({ week: w, count, pct, alert: pct > ALERT_THRESHOLD })
    }
    return weeks
  }, [records, totalEmployees])

  const maxCount = Math.max(1, ...weekData.map((w) => w.count))
  const currentWeek = getWeekNumber(new Date())

  return (
    <div className="relative rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <BorderBeam size={200} duration={18} colorFrom={mode === 'leave' ? '#3B82F6' : '#EF4444'} colorTo="#22C55E" borderWidth={1} delay={4} />
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Jaaroverzicht {new Date().getFullYear()}</p>
          <p className="text-xs text-gray-300 mt-0.5">Medewerkers op {mode === 'leave' ? 'verlof' : 'verzuim'} per week</p>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#4F6BFF]" />Normaal</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400" />&gt;{Math.round(ALERT_THRESHOLD * 100)}%</span>
          <span className="flex items-center gap-1"><span className="w-1 h-3 border-l-2 border-dashed border-blue-400" />Nu</span>
        </div>
      </div>

      <div className="flex items-end gap-px h-24 overflow-x-auto">
        {weekData.map((w) => (
          <div key={w.week} className="flex-1 min-w-[4px] flex flex-col items-center group relative" title={`W${w.week}: ${w.count} (${Math.round(w.pct * 100)}%)`}>
            <div
              className={`w-full rounded-t-sm transition-all duration-300 ${w.alert ? 'bg-red-400' : 'bg-[#4F6BFF]'} ${w.week === currentWeek ? 'ring-1 ring-blue-400 ring-offset-1' : ''}`}
              style={{ height: `${Math.max(2, (w.count / maxCount) * 100)}%`, opacity: w.count > 0 ? 1 : 0.15 }}
            />
          </div>
        ))}
      </div>

      {/* Week labels */}
      <div className="flex justify-between mt-1.5 text-[9px] text-gray-300">
        <span>W1</span><span>W13</span><span>W26</span><span>W39</span><span>W52</span>
      </div>

      {/* Alerts */}
      {weekData.some((w) => w.alert && w.week >= currentWeek) && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-500 shrink-0" viewBox="0 0 14 14" fill="none"><path d="M7 1l6 11H1L7 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M7 5.5v2.5M7 10h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
          <p className="text-[11px] text-amber-700">
            <strong>{weekData.filter((w) => w.alert && w.week >= currentWeek).length} weken</strong> met &gt;{Math.round(ALERT_THRESHOLD * 100)}% afwezigheid gepland
          </p>
        </div>
      )}
    </div>
  )
}

// ── Record card (with edit support) ──────────────────────────────────────────

function RecordCard({ record, mode, employees }: { record: LeaveRecordRow; mode: 'leave' | 'absence'; employees: Props['employees'] }) {
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [editStart, setEditStart] = useState(record.startDate)
  const [editEnd, setEditEnd] = useState(record.endDate)
  const [editNotes, setEditNotes] = useState(record.notes ?? '')

  const cat = getCategoryInfo(record.category, mode)
  const days = daysBetween(record.startDate, record.endDate)
  const now = new Date().toISOString().slice(0, 10)
  const isActive = record.status !== 'rejected' && record.endDate >= now

  function handleApprove() { startTransition(async () => { await updateLeaveStatusAction(record.id, 'approved') }) }
  function handleReject() { startTransition(async () => { await updateLeaveStatusAction(record.id, 'rejected') }) }
  function handleDelete() {
    if (!confirm('Weet je zeker dat je dit wilt verwijderen?')) return
    startTransition(async () => { await deleteLeaveAction(record.id) })
  }

  function handleSaveEdit() {
    startTransition(async () => {
      // Delete and recreate with new dates (simplest approach without adding an update action)
      await deleteLeaveAction(record.id)
      await createLeaveAction({
        employeeId: record.employeeId,
        type: record.type,
        category: record.category,
        startDate: editStart,
        endDate: editEnd,
        notes: editNotes || undefined,
      })
      setEditing(false)
    })
  }

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={['group rounded-xl border bg-white px-4 py-3 transition-all duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]', isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'].join(' ')}>

      {editing ? (
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Wijzigen: {record.employeeName}</p>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/30" />
            <input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} min={editStart} className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/30" />
          </div>
          <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} placeholder="Notities..." className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/30" />
          <div className="flex gap-2">
            <button onClick={handleSaveEdit} disabled={isPending} className="text-[11px] font-semibold bg-gray-900 text-white rounded-lg px-3 py-1.5 hover:bg-gray-700 disabled:opacity-50">
              {isPending ? '...' : 'Opslaan'}
            </button>
            <button onClick={() => { setEditing(false); setEditStart(record.startDate); setEditEnd(record.endDate); setEditNotes(record.notes ?? '') }}
              className="text-[11px] text-gray-500 rounded-lg px-3 py-1.5 border border-gray-200 hover:bg-gray-50">Annuleren</button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-xl shrink-0">{cat.icon}</span>
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

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {/* Edit button */}
            <button onClick={() => setEditing(true)} title="Wijzigen"
              className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"><path d="M10 2l2 2-7 7H3v-2l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
            </button>
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
      )}
    </motion.div>
  )
}

// ── Main view ────────────────────────────────────────────────────────────────

export default function LeaveAbsenceView({ records, employees, totalEmployeeCount, mode }: Props) {
  const [, forceUpdate] = useState(0)
  const [search, setSearch] = useState('')

  const title = mode === 'leave' ? 'Verlof' : 'Verzuim'
  const subtitle = mode === 'leave'
    ? 'Vakantiedagen, persoonlijk verlof en onbetaald verlof beheren.'
    : 'Ziekteverzuim, noodgevallen en overige afwezigheid registreren.'

  const now = new Date().toISOString().slice(0, 10)
  const active = records.filter((r) => r.status !== 'rejected' && r.endDate >= now)
  const pending = records.filter((r) => r.status === 'pending')
  const totalDays = active.reduce((sum, r) => sum + daysBetween(r.startDate, r.endDate), 0)
  const uniqueEmployees = new Set(active.map((r) => r.employeeId)).size
  const currentPct = totalEmployeeCount > 0 ? uniqueEmployees / totalEmployeeCount : 0

  // Search/filter records
  const filteredRecords = useMemo(() => {
    if (!search) return records
    const q = search.toLowerCase()
    return records.filter((r) =>
      r.employeeName.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.startDate.includes(q) ||
      r.endDate.includes(q)
    )
  }, [records, search])

  const pendingRecords = useMemo(() => filteredRecords.filter((r) => r.status === 'pending'), [filteredRecords])
  const approvedRecords = useMemo(() => filteredRecords.filter((r) => r.status === 'approved'), [filteredRecords])
  const rejectedRecords = useMemo(() => filteredRecords.filter((r) => r.status === 'rejected'), [filteredRecords])

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
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold text-[#4F6BFF] tabular-nums">{active.length}</div>
          <div className="text-[11px] text-gray-400 font-medium mt-0.5">Actief</div>
        </div>
        {mode === 'leave' && (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className={`text-2xl font-bold tabular-nums ${pending.length > 0 ? 'text-amber-500' : 'text-gray-300'}`}>{pending.length}</div>
            <div className="text-[11px] text-gray-400 font-medium mt-0.5">In afwachting</div>
          </div>
        )}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold text-gray-900 tabular-nums">{totalDays}</div>
          <div className="text-[11px] text-gray-400 font-medium mt-0.5">Dagen totaal</div>
        </div>
        <div className={`rounded-xl border bg-white p-4 ${currentPct > ALERT_THRESHOLD ? 'border-red-200' : 'border-gray-200'}`}>
          <div className={`text-2xl font-bold tabular-nums ${currentPct > ALERT_THRESHOLD ? 'text-red-500' : 'text-gray-900'}`}>
            {Math.round(currentPct * 100)}%
          </div>
          <div className="text-[11px] text-gray-400 font-medium mt-0.5">Van personeelsbestand</div>
        </div>
      </div>

      {/* Annual chart */}
      <WeeklyLeaveChart records={records} totalEmployees={totalEmployeeCount} mode={mode} />

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 14 14" fill="none">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Zoek op naam, categorie of datum..."
          className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/20 focus:border-[#4F6BFF]/40 transition-[border-color,box-shadow]"
        />
      </div>

      {/* Content: Form + Records */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div>
          <CreateForm employees={employees} mode={mode} onCreated={() => forceUpdate((n) => n + 1)} />
        </div>

        <div className="lg:col-span-2 space-y-4">
          {mode === 'leave' && pendingRecords.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                In afwachting ({pendingRecords.length})
              </h3>
              <div className="space-y-2">
                {pendingRecords.map((r) => <RecordCard key={r.id} record={r} mode={mode} employees={employees} />)}
              </div>
            </div>
          )}

          {approvedRecords.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                {mode === 'leave' ? 'Goedgekeurd' : 'Geregistreerd'} ({approvedRecords.length})
              </h3>
              <div className="space-y-2">
                {approvedRecords.map((r) => <RecordCard key={r.id} record={r} mode={mode} employees={employees} />)}
              </div>
            </div>
          )}

          {mode === 'leave' && rejectedRecords.length > 0 && (
            <details className="group">
              <summary className="text-xs font-medium text-gray-300 cursor-pointer hover:text-gray-500 transition-colors">
                Afgewezen ({rejectedRecords.length})
              </summary>
              <div className="space-y-2 mt-2">
                {rejectedRecords.map((r) => <RecordCard key={r.id} record={r} mode={mode} employees={employees} />)}
              </div>
            </details>
          )}

          {filteredRecords.length === 0 && (
            <div className="text-center py-16">
              <span className="text-3xl block mb-3">{mode === 'leave' ? '🏖️' : '🤒'}</span>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                {search ? 'Geen resultaten' : mode === 'leave' ? 'Geen verlofregistraties' : 'Geen verzuimregistraties'}
              </h3>
              <p className="text-[13px] text-gray-500 max-w-[280px] mx-auto">
                {search ? 'Probeer een andere zoekterm.' : mode === 'leave' ? 'Registreer verlof via het formulier.' : 'Meld afwezigheid via het formulier.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
