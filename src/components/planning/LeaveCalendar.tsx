'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import type { LeaveRecordRow } from '@/lib/queries/leave'

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

const WEEKDAY_LABELS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
const MONTH_LABELS = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December']

const HEAT_COLORS = [
  'bg-gray-50',      // 0
  'bg-blue-100',     // 1
  'bg-blue-200',     // 2-3
  'bg-blue-300',     // 4-5
  'bg-amber-200',    // 6-8
  'bg-red-300',      // 9+
]

function heatColor(count: number): string {
  if (count === 0) return HEAT_COLORS[0]
  if (count === 1) return HEAT_COLORS[1]
  if (count <= 3) return HEAT_COLORS[2]
  if (count <= 5) return HEAT_COLORS[3]
  if (count <= 8) return HEAT_COLORS[4]
  return HEAT_COLORS[5]
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  records: LeaveRecordRow[]
  totalEmployees: number
  onSelectRange?: (startDate: string, endDate: string) => void
}

// ── Component ────────────────────────────────────────────────────────────────

export default function LeaveCalendar({ records, totalEmployees, onSelectRange }: Props) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  // Drag-to-select state
  const [dragStart, setDragStart] = useState<string | null>(null)
  const [dragEnd, setDragEnd] = useState<string | null>(null)
  const isDragging = useRef(false)

  // Build leave-per-day map
  const dayMap = useMemo(() => {
    const map = new Map<string, { count: number; names: string[]; categories: string[] }>()
    for (const r of records) {
      if (r.status === 'rejected') continue
      const start = new Date(r.startDate + 'T00:00:00')
      const end = new Date(r.endDate + 'T00:00:00')
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = isoDate(d)
        const entry = map.get(key) ?? { count: 0, names: [], categories: [] }
        entry.count++
        if (!entry.names.includes(r.employeeName)) entry.names.push(r.employeeName)
        if (!entry.categories.includes(r.category)) entry.categories.push(r.category)
        map.set(key, entry)
      }
    }
    return map
  }, [records])

  const days = useMemo(() => getDaysInMonth(viewYear, viewMonth), [viewYear, viewMonth])

  // First day offset (Monday = 0)
  const firstDayOffset = useMemo(() => {
    const d = days[0].getDay()
    return d === 0 ? 6 : d - 1 // Convert Sunday=0 to Monday-based
  }, [days])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1) }
    else setViewMonth((m) => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1) }
    else setViewMonth((m) => m + 1)
  }

  function goToday() {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
  }

  // Drag handlers
  const handleMouseDown = useCallback((dateStr: string) => {
    isDragging.current = true
    setDragStart(dateStr)
    setDragEnd(dateStr)
  }, [])

  const handleMouseEnter = useCallback((dateStr: string) => {
    if (isDragging.current) setDragEnd(dateStr)
  }, [])

  const handleMouseUp = useCallback(() => {
    if (isDragging.current && dragStart && dragEnd) {
      const start = dragStart < dragEnd ? dragStart : dragEnd
      const end = dragStart < dragEnd ? dragEnd : dragStart
      onSelectRange?.(start, end)
    }
    isDragging.current = false
    setDragStart(null)
    setDragEnd(null)
  }, [dragStart, dragEnd, onSelectRange])

  function isInDragRange(dateStr: string): boolean {
    if (!dragStart || !dragEnd) return false
    const start = dragStart < dragEnd ? dragStart : dragEnd
    const end = dragStart < dragEnd ? dragEnd : dragStart
    return dateStr >= start && dateStr <= end
  }

  const todayStr = isoDate(today)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden" onMouseUp={handleMouseUp} onMouseLeave={() => { isDragging.current = false; setDragStart(null); setDragEnd(null) }}>
      {/* Navigation */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <button onClick={prevMonth} className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-gray-900">{MONTH_LABELS[viewMonth]} {viewYear}</h3>
          <button onClick={goToday} className="text-[10px] font-semibold text-[#4F6BFF] hover:underline">Vandaag</button>
        </div>
        <button onClick={nextMonth} className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 select-none">
        {/* Empty cells for offset */}
        {Array.from({ length: firstDayOffset }, (_, i) => (
          <div key={`empty-${i}`} className="aspect-square border-b border-r border-gray-50" />
        ))}

        {days.map((day) => {
          const dateStr = isoDate(day)
          const entry = dayMap.get(dateStr)
          const count = entry?.count ?? 0
          const isToday = dateStr === todayStr
          const isWeekend = day.getDay() === 0 || day.getDay() === 6
          const inDragRange = isInDragRange(dateStr)
          const pct = totalEmployees > 0 && count > 0 ? Math.round((count / totalEmployees) * 100) : 0

          return (
            <div
              key={dateStr}
              onMouseDown={() => handleMouseDown(dateStr)}
              onMouseEnter={() => handleMouseEnter(dateStr)}
              className={[
                'relative aspect-square border-b border-r border-gray-50 p-1 cursor-crosshair transition-colors group',
                inDragRange ? 'bg-[#4F6BFF]/10 ring-1 ring-inset ring-[#4F6BFF]/30' : '',
                isWeekend && !inDragRange ? 'bg-gray-50/50' : '',
              ].join(' ')}
              title={entry ? `${entry.names.join(', ')} (${pct}% afwezig)` : undefined}
            >
              {/* Day number */}
              <div className={[
                'text-[11px] font-semibold leading-none',
                isToday ? 'text-white bg-[#4F6BFF] rounded-full w-5 h-5 flex items-center justify-center' : 'text-gray-600',
              ].join(' ')}>
                {day.getDate()}
              </div>

              {/* Heat indicator */}
              {count > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`absolute bottom-1 left-1 right-1 h-1.5 rounded-full ${heatColor(count)}`}
                />
              )}

              {/* Count badge */}
              {count > 0 && (
                <div className="absolute top-1 right-1 text-[9px] font-bold text-gray-400 tabular-nums">
                  {count}
                </div>
              )}

              {/* Hover tooltip */}
              {entry && entry.names.length > 0 && (
                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block pointer-events-none">
                  <div className="rounded-lg bg-gray-900 text-white px-2.5 py-1.5 text-[10px] shadow-lg whitespace-nowrap max-w-[160px]">
                    <p className="font-bold mb-0.5">{count} afwezig ({pct}%)</p>
                    {entry.names.slice(0, 4).map((name) => (
                      <p key={name} className="text-gray-300 truncate">{name}</p>
                    ))}
                    {entry.names.length > 4 && <p className="text-gray-500">+{entry.names.length - 4} meer</p>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
        <div className="flex items-center gap-2 text-[10px] text-gray-400">
          <span>Minder</span>
          {HEAT_COLORS.map((c, i) => <div key={i} className={`w-3 h-3 rounded-sm ${c} border border-gray-200/50`} />)}
          <span>Meer</span>
        </div>
        <p className="text-[10px] text-gray-300">Sleep over dagen om verlof te selecteren</p>
      </div>
    </div>
  )
}
