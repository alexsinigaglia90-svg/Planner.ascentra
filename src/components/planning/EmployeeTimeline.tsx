'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { LeaveRecordRow } from '@/lib/queries/leave'

// ── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  vacation: 'bg-blue-400',
  personal: 'bg-violet-400',
  unpaid: 'bg-gray-400',
  sick: 'bg-red-400',
  emergency: 'bg-orange-400',
  other: 'bg-gray-300',
}

const CATEGORY_LABELS: Record<string, string> = {
  vacation: 'Vakantie',
  personal: 'Persoonlijk',
  unpaid: 'Onbetaald',
  sick: 'Ziek',
  emergency: 'Noodgeval',
  other: 'Overig',
}

function dayOfYear(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d.getTime() - start.getTime()) / 86400000)
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  records: LeaveRecordRow[]
  employees: { id: string; name: string }[]
}

// ── Component ────────────────────────────────────────────────────────────────

export default function EmployeeTimeline({ records, employees }: Props) {
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null)

  const year = new Date().getFullYear()
  const totalDays = 365

  // Group records by employee
  const byEmployee = useMemo(() => {
    const map = new Map<string, LeaveRecordRow[]>()
    for (const r of records) {
      if (r.status === 'rejected') continue
      const list = map.get(r.employeeId) ?? []
      list.push(r)
      map.set(r.employeeId, list)
    }
    return map
  }, [records])

  // Only show employees who have at least 1 record
  const activeEmployees = useMemo(() => {
    return employees.filter((e) => byEmployee.has(e.id))
  }, [employees, byEmployee])

  const displayed = selectedEmployee
    ? activeEmployees.filter((e) => e.id === selectedEmployee)
    : activeEmployees.slice(0, 15)

  // Month markers
  const months = useMemo(() => {
    const result: { label: string; offset: number }[] = []
    for (let m = 0; m < 12; m++) {
      const d = new Date(year, m, 1)
      result.push({
        label: d.toLocaleDateString('nl-NL', { month: 'short' }),
        offset: dayOfYear(`${year}-${String(m + 1).padStart(2, '0')}-01`) / totalDays * 100,
      })
    }
    return result
  }, [year, totalDays])

  const todayOffset = (dayOfYear(new Date().toISOString().slice(0, 10)) / totalDays) * 100

  if (activeEmployees.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
        <p className="text-sm text-gray-400">Geen verlof/verzuim data om te tonen.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Tijdlijn {year}</h3>
          <p className="text-[10px] text-gray-300 mt-0.5">Per medewerker overzicht</p>
        </div>
        {selectedEmployee && (
          <button onClick={() => setSelectedEmployee(null)} className="text-[10px] text-[#4F6BFF] font-medium hover:underline">
            Toon alle
          </button>
        )}
      </div>

      {/* Month labels */}
      <div className="relative h-6 border-b border-gray-100 mx-5" style={{ marginLeft: 120 }}>
        {months.map((m) => (
          <div key={m.label} className="absolute top-0 text-[9px] font-bold uppercase text-gray-300" style={{ left: `${m.offset}%` }}>
            {m.label}
          </div>
        ))}
        {/* Today marker */}
        <div className="absolute top-0 bottom-0 w-px bg-[#4F6BFF]" style={{ left: `${todayOffset}%` }} />
      </div>

      {/* Employee rows */}
      <div className="max-h-[320px] overflow-y-auto">
        {displayed.map((emp) => {
          const empRecords = byEmployee.get(emp.id) ?? []
          return (
            <div
              key={emp.id}
              className="flex items-center border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
              onClick={() => setSelectedEmployee(selectedEmployee === emp.id ? null : emp.id)}
            >
              {/* Name */}
              <div className="w-[120px] shrink-0 px-4 py-2">
                <p className="text-xs font-medium text-gray-700 truncate">{emp.name}</p>
                <p className="text-[9px] text-gray-400">{empRecords.length} registratie{empRecords.length !== 1 ? 's' : ''}</p>
              </div>

              {/* Timeline bar */}
              <div className="flex-1 relative h-8 mx-1">
                {/* Background grid */}
                {months.map((m) => (
                  <div key={m.label} className="absolute top-0 bottom-0 w-px bg-gray-100" style={{ left: `${m.offset}%` }} />
                ))}

                {/* Today line */}
                <div className="absolute top-0 bottom-0 w-px bg-[#4F6BFF]/30" style={{ left: `${todayOffset}%` }} />

                {/* Leave bars */}
                {empRecords.map((r) => {
                  const startDay = dayOfYear(r.startDate)
                  const endDay = dayOfYear(r.endDate)
                  const left = (startDay / totalDays) * 100
                  const width = Math.max(0.3, ((endDay - startDay + 1) / totalDays) * 100)
                  const color = CATEGORY_COLORS[r.category] ?? 'bg-gray-300'

                  return (
                    <motion.div
                      key={r.id}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className={`absolute top-1.5 h-5 rounded-md ${color} ${r.status === 'pending' ? 'opacity-50 border border-dashed border-gray-400' : ''}`}
                      style={{ left: `${left}%`, width: `${width}%`, originX: 0 }}
                      title={`${CATEGORY_LABELS[r.category] ?? r.category}: ${formatShortDate(r.startDate)} – ${formatShortDate(r.endDate)}`}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-t border-gray-100">
        {Object.entries(CATEGORY_COLORS).map(([key, color]) => (
          <div key={key} className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
            <span className="text-[9px] text-gray-400">{CATEGORY_LABELS[key] ?? key}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
