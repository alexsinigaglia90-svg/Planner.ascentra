'use client'

import { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { LeaveRecordRow } from '@/lib/queries/leave'
import { createLeaveAction, updateLeaveStatusAction, deleteLeaveAction } from '@/app/leave/actions'
import { BorderBeam } from '@/components/ui/border-beam'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import LeaveCalendar from '@/components/planning/LeaveCalendar'
import EmployeeTimeline from '@/components/planning/EmployeeTimeline'

// ── Types ────────────────────────────────────────────────────────────────────

interface EmployeeInfo {
  id: string
  name: string
  employeeType: string
  departmentId?: string | null
  departmentName?: string | null
}

interface Props {
  records: LeaveRecordRow[]
  employees: EmployeeInfo[]
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

function CreateForm({ employees, mode, onCreated, records, totalEmployees }: {
  employees: Props['employees']
  mode: 'leave' | 'absence'
  onCreated: () => void
  records: LeaveRecordRow[]
  totalEmployees: number
}) {
  const [employeeId, setEmployeeId] = useState('')
  const [category, setCategory] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showMagic, setShowMagic] = useState(false)
  const [absenceAnim, setAbsenceAnim] = useState<number | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  const categories = mode === 'leave' ? LEAVE_CATEGORIES : ABSENCE_CATEGORIES

  // Client-side overlap detection
  const overlapWarning = useMemo(() => {
    if (!employeeId || !startDate || !endDate) return null
    const overlap = records.find((r) =>
      r.employeeId === employeeId &&
      r.status !== 'rejected' &&
      r.startDate <= endDate &&
      r.endDate >= startDate
    )
    if (!overlap) return null
    return `Deze medewerker heeft al een registratie (${overlap.category}) van ${formatDate(overlap.startDate)} t/m ${formatDate(overlap.endDate)} die overlapt.`
  }, [employeeId, startDate, endDate, records])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!employeeId || !category || !startDate || !endDate || overlapWarning) return
    setError(null)
    startTransition(async () => {
      const res = await createLeaveAction({ employeeId, type: mode, category, startDate, endDate, notes: notes || undefined })
      if (!res.ok) { setError(res.error); return }
      // Trigger celebration animation
      if (mode === 'leave') {
        setShowMagic(true)
        setTimeout(() => setShowMagic(false), 2000)
      } else {
        const randomAnim = Math.floor(Math.random() * 3)
        setAbsenceAnim(randomAnim)
        setTimeout(() => setAbsenceAnim(null), 2500)
      }
      setEmployeeId(''); setCategory(''); setStartDate(''); setEndDate(''); setNotes('')
      onCreated()
    })
  }

  return (
    <motion.div ref={formRef} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
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

        <DateRangePicker
          label="Periode"
          startDate={startDate}
          endDate={endDate}
          onChangeStart={setStartDate}
          onChangeEnd={setEndDate}
        />

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Notities <span className="text-gray-300 normal-case">(optioneel)</span></label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Extra toelichting..." className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/30" />
        </div>

        {/* Team conflict detection + impact analysis */}
        {employeeId && startDate && endDate && (() => {
          const emp = employees.find((e) => e.id === employeeId)
          const deptId = emp?.departmentId
          // Find colleagues from same department already on leave in this period
          const conflicts = records.filter((r) =>
            r.status !== 'rejected' &&
            r.employeeId !== employeeId &&
            r.startDate <= endDate &&
            r.endDate >= startDate &&
            (deptId ? employees.find((e) => e.id === r.employeeId)?.departmentId === deptId : false)
          )
          // Count total absent in this period (all departments)
          const allAbsent = records.filter((r) =>
            r.status !== 'rejected' &&
            r.employeeId !== employeeId &&
            r.startDate <= endDate &&
            r.endDate >= startDate
          )
          const absentPct = totalEmployees > 0 ? Math.round(((allAbsent.length + 1) / totalEmployees) * 100) : 0
          const isHighImpact = absentPct > 15

          return (
            <div className="space-y-2">
              {/* Team conflicts */}
              {conflicts.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <svg className="w-3.5 h-3.5 text-amber-500" viewBox="0 0 14 14" fill="none"><path d="M7 1l6 11H1L7 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M7 5.5v2.5M7 10h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                    <span className="text-[11px] font-bold text-amber-700">Team conflict</span>
                  </div>
                  <p className="text-[11px] text-amber-600">
                    {conflicts.length} collega{conflicts.length !== 1 ? "'s" : ''} uit {emp?.departmentName ?? 'dezelfde afdeling'} {conflicts.length === 1 ? 'is' : 'zijn'} al afwezig:
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {conflicts.slice(0, 5).map((c) => (
                      <span key={c.id} className="text-[10px] bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-medium">{c.employeeName}</span>
                    ))}
                    {conflicts.length > 5 && <span className="text-[10px] text-amber-500">+{conflicts.length - 5}</span>}
                  </div>
                </div>
              )}

              {/* AI impact analysis */}
              <div className={`rounded-lg border px-3 py-2.5 ${isHighImpact ? 'border-red-200 bg-red-50/50' : 'border-blue-200 bg-blue-50/40'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <svg className="w-3.5 h-3.5 text-indigo-500" viewBox="0 0 14 14" fill="none"><path d="M7 1l1.5 4.5H13l-3.5 2.5 1.5 4.5L7 10l-4 2.5 1.5-4.5L1 5.5h4.5L7 1z" stroke="currentColor" strokeWidth="1" fill="currentColor" opacity="0.15" /></svg>
                  <span className="text-[11px] font-bold text-indigo-600">Impact analyse</span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Totaal afwezig in periode</span>
                    <span className={`font-bold ${isHighImpact ? 'text-red-600' : 'text-gray-700'}`}>{allAbsent.length + 1} ({absentPct}%)</span>
                  </div>
                  {isHighImpact && (
                    <p className="text-red-600 font-medium mt-1">Hoog risico: meer dan 15% van het personeel is afwezig. Dit kan de bezetting onder druk zetten.</p>
                  )}
                  {!isHighImpact && absentPct > 10 && (
                    <p className="text-amber-600 mt-1">Let op: {absentPct}% afwezigheid. Monitor de bezettingsgraad.</p>
                  )}
                  {!isHighImpact && absentPct <= 10 && (
                    <p className="text-emerald-600 mt-1">Bezetting blijft op een gezond niveau.</p>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Overlap warning */}
        {overlapWarning && (
          <div className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2.5 flex items-center gap-2">
            <svg className="w-4 h-4 text-red-500 shrink-0" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3" /><path d="M7 4v3.5M7 10h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
            <p className="text-[11px] text-red-700">{overlapWarning}</p>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button type="submit" disabled={isPending || !employeeId || !category || !startDate || !endDate || !!overlapWarning}
          className="w-full rounded-xl bg-gradient-to-r from-[#4F6BFF] to-[#6C83FF] text-white py-2.5 text-sm font-semibold shadow-[0_4px_14px_rgba(79,107,255,0.35)] hover:shadow-[0_6px_20px_rgba(79,107,255,0.45)] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:hover:transform-none">
          {isPending ? 'Registreren...' : mode === 'leave' ? 'Verlof aanvragen' : 'Verzuim melden'}
        </button>

        {/* Magic wand celebration */}
        <AnimatePresence>
          {showMagic && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
            >
              {/* Glow */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 2.5], opacity: [0.6, 0] }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                className="absolute w-40 h-40 rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(79,107,255,0.4) 0%, rgba(251,191,36,0.15) 50%, transparent 70%)' }}
              />

              {/* Wand travels from center to right */}
              <motion.div
                initial={{ x: -20, y: 10, rotate: -30 }}
                animate={{ x: [-20, 0, 0, 140], y: [10, -5, 0, -10], rotate: [-30, 10, 0, 15] }}
                transition={{ duration: 1.4, times: [0, 0.3, 0.5, 1], ease: 'easeInOut' }}
              >
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                  {/* Swoosh trail */}
                  <motion.path
                    d="M8 42Q18 22 38 18T50 14"
                    stroke="url(#swG)" strokeWidth="2" strokeLinecap="round" fill="none"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: [0, 1], opacity: [0, 0.7, 0] }}
                    transition={{ duration: 0.6 }}
                  />
                  <defs><linearGradient id="swG" x1="8" y1="42" x2="50" y2="14" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#4F6BFF" stopOpacity="0" /><stop offset=".4" stopColor="#4F6BFF" />
                    <stop offset=".8" stopColor="#A78BFA" /><stop offset="1" stopColor="#fbbf24" />
                  </linearGradient></defs>
                  {/* Stick */}
                  <motion.path d="M16 40L38 20" stroke="#6366F1" strokeWidth="3" strokeLinecap="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.25 }} />
                  {/* Tip */}
                  <motion.circle cx="38" cy="20" r="4" fill="#fbbf24"
                    initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} transition={{ duration: 0.3, delay: 0.2 }} />
                  {/* Sparkles */}
                  {[{cx:44,cy:14,f:'#fbbf24'},{cx:46,cy:22,f:'#4F6BFF'},{cx:34,cy:12,f:'#22C55E'},{cx:48,cy:16,f:'#EC4899'}].map((s,i) => (
                    <motion.circle key={i} cx={s.cx} cy={s.cy} r="1.5" fill={s.f}
                      animate={{ scale:[0,1.5,0], opacity:[0,1,0] }}
                      transition={{ duration:0.5, delay:0.3+i*0.06 }} />
                  ))}
                </svg>
              </motion.div>

              {/* Text */}
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="absolute text-sm font-bold text-[#4F6BFF]"
              >
                Aangevraagd! ✨
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Absence animations (randomized) */}
        <AnimatePresence>
          {absenceAnim !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
            >
              {/* Anim 0: Ambulance dispatch */}
              {absenceAnim === 0 && (
                <>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ scale: [0.5, 1.5, 2], opacity: [0, 0.3, 0] }}
                    transition={{ duration: 1.2 }}
                    className="absolute w-32 h-32 rounded-full"
                    style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)' }}
                  />
                  <motion.div
                    initial={{ x: -120, y: 5 }}
                    animate={{ x: [-120, 0, 0, 160], y: [5, 0, 0, -5] }}
                    transition={{ duration: 2.0, times: [0, 0.3, 0.6, 1], ease: 'easeInOut' }}
                  >
                    <svg width="72" height="44" viewBox="0 0 72 44" fill="none">
                      {/* Body */}
                      <rect x="4" y="14" width="48" height="22" rx="4" fill="#EF4444" />
                      <rect x="4" y="14" width="48" height="4" rx="2" fill="#DC2626" />
                      {/* Cab */}
                      <rect x="48" y="18" width="18" height="18" rx="3" fill="#B91C1C" />
                      <rect x="52" y="22" width="10" height="8" rx="2" fill="#BFDBFE" opacity="0.8" />
                      {/* Cross */}
                      <rect x="22" y="20" width="12" height="3" rx="1" fill="white" />
                      <rect x="26.5" y="16" width="3" height="12" rx="1" fill="white" />
                      {/* Wheels */}
                      <circle cx="18" cy="38" r="5" fill="#1F2937" /><circle cx="18" cy="38" r="2.5" fill="#6B7280" />
                      <circle cx="56" cy="38" r="5" fill="#1F2937" /><circle cx="56" cy="38" r="2.5" fill="#6B7280" />
                      {/* Siren — pulsing */}
                      <motion.circle cx="30" cy="12" r="3" fill="#3B82F6"
                        animate={{ opacity: [1, 0.3, 1], scale: [1, 1.2, 1] }}
                        transition={{ duration: 0.4, repeat: 4 }} />
                      <motion.circle cx="30" cy="12" r="6" fill="#3B82F6" opacity="0.2"
                        animate={{ scale: [1, 1.8, 1], opacity: [0.2, 0, 0.2] }}
                        transition={{ duration: 0.4, repeat: 4 }} />
                    </svg>
                    {/* Trail plusjes */}
                    {[0,1,2,3,4].map((i) => (
                      <motion.span key={i} className="absolute text-[10px] text-red-300 font-bold"
                        style={{ left: -10 - i * 12, top: 10 + (i % 2) * 8 }}
                        initial={{ opacity: 0 }} animate={{ opacity: [0, 0.6, 0] }}
                        transition={{ duration: 0.5, delay: 0.4 + i * 0.12 }}>+</motion.span>
                    ))}
                  </motion.div>
                  <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                    className="absolute bottom-8 text-sm font-bold text-red-500">Verzuim geregistreerd 🚑</motion.p>
                </>
              )}

              {/* Anim 1: EHBO koffer */}
              {absenceAnim === 1 && (
                <>
                  <motion.div
                    initial={{ scale: 0, rotate: -10 }}
                    animate={{ scale: [0, 1.1, 1], rotate: [-10, 5, 0] }}
                    transition={{ duration: 0.5, type: 'spring', stiffness: 300 }}
                  >
                    <svg width="80" height="64" viewBox="0 0 80 64" fill="none">
                      {/* Case body */}
                      <rect x="8" y="16" width="64" height="40" rx="6" fill="white" stroke="#E5E7EB" strokeWidth="2" />
                      {/* Handle */}
                      <rect x="28" y="8" width="24" height="10" rx="4" fill="none" stroke="#D1D5DB" strokeWidth="2.5" />
                      {/* Red cross */}
                      <rect x="32" y="28" width="16" height="5" rx="1.5" fill="#EF4444" />
                      <rect x="37.5" y="23" width="5" height="16" rx="1.5" fill="#EF4444" />
                      {/* Clasp */}
                      <rect x="36" y="48" width="8" height="4" rx="1" fill="#D1D5DB" />
                    </svg>
                  </motion.div>
                  {/* Case opens — document flies out */}
                  <motion.div
                    initial={{ opacity: 0, y: 0, x: 0, scale: 0.5 }}
                    animate={{ opacity: [0, 1, 1, 0], y: [0, -15, -10, -5], x: [0, 10, 60, 140], scale: [0.5, 0.8, 0.7, 0.5] }}
                    transition={{ duration: 1.5, delay: 0.5, ease: 'easeInOut' }}
                    className="absolute"
                  >
                    <svg width="28" height="32" viewBox="0 0 28 32" fill="none">
                      <rect x="2" y="2" width="24" height="28" rx="3" fill="white" stroke="#E5E7EB" strokeWidth="1.5" />
                      <path d="M8 10h12M8 15h10M8 20h8" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" />
                      <motion.path d="M10 24l3 3 5-6" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.8, duration: 0.3 }} />
                    </svg>
                  </motion.div>
                  {/* Glow */}
                  <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 2], opacity: [0.3, 0] }}
                    transition={{ duration: 1, delay: 0.3 }}
                    className="absolute w-24 h-24 rounded-full" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.2) 0%, transparent 70%)' }} />
                  <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                    className="absolute bottom-8 text-sm font-bold text-red-500">Geregistreerd ✓</motion.p>
                </>
              )}

              {/* Anim 2: Thermometer */}
              {absenceAnim === 2 && (
                <>
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <svg width="40" height="80" viewBox="0 0 40 80" fill="none">
                      {/* Thermometer body */}
                      <rect x="14" y="8" width="12" height="48" rx="6" fill="white" stroke="#E5E7EB" strokeWidth="2" />
                      {/* Bulb */}
                      <circle cx="20" cy="62" r="10" fill="white" stroke="#E5E7EB" strokeWidth="2" />
                      <circle cx="20" cy="62" r="6" fill="#EF4444" />
                      {/* Mercury rising */}
                      <motion.rect x="17" y="50" width="6" height="0" rx="3" fill="#EF4444"
                        animate={{ height: [0, 35], y: [50, 15] }}
                        transition={{ duration: 1.0, delay: 0.2, ease: [0.22, 1, 0.36, 1] }} />
                      {/* Tick marks */}
                      <line x1="27" y1="20" x2="30" y2="20" stroke="#D1D5DB" strokeWidth="1" />
                      <line x1="27" y1="28" x2="30" y2="28" stroke="#D1D5DB" strokeWidth="1" />
                      <line x1="27" y1="36" x2="30" y2="36" stroke="#D1D5DB" strokeWidth="1" />
                      <line x1="27" y1="44" x2="30" y2="44" stroke="#D1D5DB" strokeWidth="1" />
                    </svg>
                  </motion.div>
                  {/* Ping at top */}
                  <motion.div className="absolute" style={{ top: 'calc(50% - 40px)' }}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
                    transition={{ duration: 0.6, delay: 1.2 }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" fill="#EF4444" opacity="0.2" />
                      <path d="M8 12l3 3 5-6" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </motion.div>
                  {/* Sparkles */}
                  {[0,1,2,3].map((i) => (
                    <motion.div key={i} className="absolute w-1.5 h-1.5 rounded-full bg-red-400"
                      style={{ top: `calc(50% - ${30 + i * 5}px)`, left: `calc(50% + ${(i % 2 ? 1 : -1) * (12 + i * 4)}px)` }}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: [0, 1.5, 0], opacity: [0, 0.8, 0] }}
                      transition={{ duration: 0.4, delay: 1.3 + i * 0.08 }} />
                  ))}
                  <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }}
                    className="absolute bottom-8 text-sm font-bold text-red-500">Verzuim gemeld 🌡️</motion.p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </motion.div>
  )
}

// ── Weekly leave chart ────────────────────────────────────────────────────────

function WeeklyLeaveChart({ records, totalEmployees, mode }: { records: LeaveRecordRow[]; totalEmployees: number; mode: 'leave' | 'absence' }) {
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null)

  const weekData = useMemo(() => {
    const year = new Date().getFullYear()
    const weeks: { week: number; count: number; pct: number; alert: boolean }[] = []
    for (let w = 1; w <= 52; w++) {
      const jan4 = new Date(year, 0, 4)
      const dayOfWeek = jan4.getDay() || 7
      const monday = new Date(jan4)
      monday.setDate(jan4.getDate() - dayOfWeek + 1 + (w - 1) * 7)
      const employeesOnLeave = new Set<string>()
      for (const r of records) {
        if (r.status === 'rejected') continue
        for (let d = 0; d < 7; d++) {
          const checkDate = new Date(monday)
          checkDate.setDate(monday.getDate() + d)
          const iso = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`
          if (iso >= r.startDate && iso <= r.endDate) employeesOnLeave.add(r.employeeId)
        }
      }
      const count = employeesOnLeave.size
      const pct = totalEmployees > 0 ? count / totalEmployees : 0
      weeks.push({ week: w, count, pct, alert: pct > ALERT_THRESHOLD })
    }
    return weeks
  }, [records, totalEmployees])

  const currentWeek = getWeekNumber(new Date())

  // SVG dimensions
  const W = 700
  const H = 160
  const PAD_L = 36
  const PAD_R = 8
  const PAD_T = 8
  const PAD_B = 24
  const chartW = W - PAD_L - PAD_R
  const chartH = H - PAD_T - PAD_B

  // Y-axis: fixed percentage scale 0-25%
  const maxPct = Math.max(0.25, Math.ceil(Math.max(...weekData.map((w) => w.pct)) * 20) / 20 + 0.05)
  const ySteps = [0, 0.05, 0.10, 0.15, 0.20, 0.25].filter((v) => v <= maxPct)

  function xPos(week: number): number { return PAD_L + ((week - 1) / 51) * chartW }
  function yPos(pct: number): number { return PAD_T + chartH - (pct / maxPct) * chartH }

  // Build line path
  const linePath = weekData.map((w, i) => `${i === 0 ? 'M' : 'L'}${xPos(w.week).toFixed(1)},${yPos(w.pct).toFixed(1)}`).join(' ')
  // Area path (line + close to bottom)
  const areaPath = `${linePath} L${xPos(52).toFixed(1)},${yPos(0).toFixed(1)} L${xPos(1).toFixed(1)},${yPos(0).toFixed(1)} Z`

  // Threshold Y
  const thresholdY = yPos(ALERT_THRESHOLD)
  // Current week X
  const currentX = xPos(currentWeek)

  // Month label positions
  const monthLabels = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']
  const monthWeeks = [1, 5, 9, 14, 18, 22, 27, 31, 36, 40, 44, 49]

  const hovered = hoveredWeek !== null ? weekData[hoveredWeek - 1] : null

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Jaaroverzicht {new Date().getFullYear()}</p>
          <p className="text-xs text-gray-300 mt-0.5">Afwezigheid als % van het personeelsbestand</p>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1.5"><span className="w-6 h-[2px] bg-[#4F6BFF] rounded-full" />Afwezigheid</span>
          <span className="flex items-center gap-1.5"><span className="w-6 h-[2px] bg-red-400 rounded-full border-t border-dashed" />Drempel</span>
          <span className="flex items-center gap-1.5"><span className="w-[2px] h-3 bg-[#4F6BFF] rounded-full" />Nu</span>
        </div>
      </div>

      {/* SVG Area Chart */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 180 }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4F6BFF" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#4F6BFF" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="areaGradAlert" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {ySteps.map((step) => (
          <g key={step}>
            <line x1={PAD_L} y1={yPos(step)} x2={W - PAD_R} y2={yPos(step)} stroke="#f3f4f6" strokeWidth="1" />
            <text x={PAD_L - 6} y={yPos(step) + 3} textAnchor="end" className="text-[9px] fill-gray-300" style={{ fontSize: 9 }}>
              {Math.round(step * 100)}%
            </text>
          </g>
        ))}

        {/* Threshold zone (above 15%) */}
        <rect x={PAD_L} y={PAD_T} width={chartW} height={thresholdY - PAD_T} fill="#FEF2F2" opacity="0.6" />
        <line x1={PAD_L} y1={thresholdY} x2={W - PAD_R} y2={thresholdY} stroke="#FCA5A5" strokeWidth="1" strokeDasharray="4 3" />
        <text x={W - PAD_R - 2} y={thresholdY - 4} textAnchor="end" className="fill-red-400" style={{ fontSize: 8, fontWeight: 600 }}>
          {Math.round(ALERT_THRESHOLD * 100)}%
        </text>

        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGrad)" />

        {/* Line */}
        <path d={linePath} fill="none" stroke="#4F6BFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Alert segments (red where above threshold) */}
        {weekData.map((w, i) => {
          if (!w.alert || i === 0) return null
          const prev = weekData[i - 1]
          return (
            <line key={`alert-${i}`} x1={xPos(prev.week)} y1={yPos(prev.pct)} x2={xPos(w.week)} y2={yPos(w.pct)} stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />
          )
        })}

        {/* Current week marker */}
        <line x1={currentX} y1={PAD_T} x2={currentX} y2={H - PAD_B} stroke="#4F6BFF" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.5" />
        <circle cx={currentX} cy={yPos(weekData[currentWeek - 1]?.pct ?? 0)} r="4" fill="#4F6BFF" stroke="white" strokeWidth="2" />

        {/* Data point dots */}
        {weekData.map((w) => (
          w.count > 0 && w.week !== currentWeek ? (
            <circle key={`dot-${w.week}`} cx={xPos(w.week)} cy={yPos(w.pct)} r="2.5" fill={w.alert ? '#EF4444' : '#4F6BFF'} opacity="0.6" />
          ) : null
        ))}

        {/* Hover zones */}
        {weekData.map((w) => (
          <rect
            key={`hover-${w.week}`}
            x={xPos(w.week) - chartW / 104}
            y={PAD_T}
            width={chartW / 52}
            height={chartH}
            fill="transparent"
            onMouseEnter={() => setHoveredWeek(w.week)}
            onMouseLeave={() => setHoveredWeek(null)}
            className="cursor-crosshair"
          />
        ))}

        {/* Hover indicator */}
        {hovered && hoveredWeek && (
          <>
            <line x1={xPos(hoveredWeek)} y1={PAD_T} x2={xPos(hoveredWeek)} y2={H - PAD_B} stroke="#9CA3AF" strokeWidth="1" strokeDasharray="2 2" />
            <circle cx={xPos(hoveredWeek)} cy={yPos(hovered.pct)} r="5" fill={hovered.alert ? '#EF4444' : '#4F6BFF'} stroke="white" strokeWidth="2" />
          </>
        )}

        {/* Month labels */}
        {monthLabels.map((label, i) => (
          <text key={label} x={xPos(monthWeeks[i])} y={H - 4} textAnchor="middle" className="fill-gray-400" style={{ fontSize: 9, fontWeight: 500 }}>
            {label}
          </text>
        ))}
      </svg>

      {/* Hover tooltip */}
      {hovered && hoveredWeek && (
        <div className="flex items-center justify-center gap-4 mt-1 text-[11px]">
          <span className="font-bold text-gray-700">W{hoveredWeek}</span>
          <span className="text-gray-500">{hovered.count} medewerker{hovered.count !== 1 ? 's' : ''}</span>
          <span className={`font-bold ${hovered.alert ? 'text-red-500' : 'text-[#4F6BFF]'}`}>{Math.round(hovered.pct * 100)}%</span>
        </div>
      )}

      {/* Alert */}
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
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'timeline'>('list')
  const [calendarDates, setCalendarDates] = useState<{ start: string; end: string } | null>(null)

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

      {/* View mode toggle */}
      <div className="flex items-center gap-3">
        <div className="flex gap-0.5 bg-gray-100 rounded-xl p-0.5">
          {([
            { id: 'list' as const, label: 'Lijst', icon: <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M2 7h10M2 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg> },
            { id: 'calendar' as const, label: 'Kalender', icon: <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"><rect x="1" y="2.5" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" /><path d="M4.5 1v2M9.5 1v2M1 6h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg> },
            { id: 'timeline' as const, label: 'Tijdlijn', icon: <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"><path d="M1 3h4M5 7h5M3 11h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg> },
          ]).map((v) => (
            <button
              key={v.id}
              onClick={() => setViewMode(v.id)}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                viewMode === v.id ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {v.icon}{v.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />

        {/* Smart suggestion */}
        {mode === 'leave' && (() => {
          // Find weeks with lowest leave count = best periods for new leave
          const now = new Date()
          const currentWeekNum = getWeekNumber(now)
          const lowLeaveWeeks: number[] = []
          for (let w = currentWeekNum + 1; w <= Math.min(currentWeekNum + 12, 52); w++) {
            const jan4 = new Date(now.getFullYear(), 0, 4)
            const dayOfWeek = jan4.getDay() || 7
            const monday = new Date(jan4)
            monday.setDate(jan4.getDate() - dayOfWeek + 1 + (w - 1) * 7)
            let count = 0
            for (const r of records) {
              if (r.status === 'rejected') continue
              const rs = new Date(r.startDate + 'T00:00:00')
              const re = new Date(r.endDate + 'T00:00:00')
              const wEnd = new Date(monday); wEnd.setDate(monday.getDate() + 6)
              if (rs <= wEnd && re >= monday) count++
            }
            if (count <= 1) lowLeaveWeeks.push(w)
          }
          if (lowLeaveWeeks.length === 0) return null
          return (
            <div className="flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 14 14" fill="none"><path d="M7 1l1.5 4.5H13l-3.5 2.5 1.5 4.5L7 10l-4 2.5 1.5-4.5L1 5.5h4.5L7 1z" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="0.8" /></svg>
              <span className="text-[10px] font-medium text-emerald-700">
                Tip: W{lowLeaveWeeks.slice(0, 3).join(', W')} {lowLeaveWeeks.length > 3 ? `+${lowLeaveWeeks.length - 3}` : ''} zijn ideaal voor verlof
              </span>
            </div>
          )
        })()}
      </div>

      {/* Calendar view */}
      {viewMode === 'calendar' && (
        <LeaveCalendar
          records={records}
          totalEmployees={totalEmployeeCount}
          onSelectRange={(start, end) => setCalendarDates({ start, end })}
        />
      )}

      {/* Timeline view */}
      {viewMode === 'timeline' && (
        <EmployeeTimeline records={records} employees={employees} />
      )}

      {/* Annual chart (visible in list and calendar views) */}
      {viewMode !== 'timeline' && (
        <WeeklyLeaveChart records={records} totalEmployees={totalEmployeeCount} mode={mode} />
      )}

      {/* Calendar drag selection → prefill form */}
      {calendarDates && viewMode === 'calendar' && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-[#4F6BFF]/30 bg-[#4F6BFF]/5 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#4F6BFF]" viewBox="0 0 14 14" fill="none"><rect x="1" y="2.5" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" /><path d="M4.5 1v2M9.5 1v2M1 6h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
            <span className="text-sm font-medium text-[#4F6BFF]">
              {new Date(calendarDates.start + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} – {new Date(calendarDates.end + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
            </span>
            <span className="text-xs text-gray-400">geselecteerd</span>
          </div>
          <button onClick={() => setCalendarDates(null)} className="text-xs text-gray-400 hover:text-gray-600">Wissen</button>
        </motion.div>
      )}

      {/* Search + Form + Records (list view only) */}
      {viewMode === 'list' && (<>
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
          <CreateForm employees={employees} mode={mode} onCreated={() => forceUpdate((n) => n + 1)} records={records} totalEmployees={totalEmployeeCount} />
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
      </>)}
    </div>
  )
}
