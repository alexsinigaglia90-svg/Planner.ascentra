'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
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

const WEEKDAY_LABELS = ['M', 'D', 'W', 'D', 'V', 'Z', 'Z']
const MONTH_LABELS = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']

// Color intensity based on count
function tileColor(count: number, total: number): string {
  if (count === 0) return 'bg-gray-50'
  const pct = total > 0 ? count / total : 0
  if (pct > 0.15) return 'bg-red-400 text-white'
  if (pct > 0.10) return 'bg-red-300 text-white'
  if (pct > 0.05) return 'bg-amber-300'
  if (count >= 3) return 'bg-blue-300'
  if (count >= 2) return 'bg-blue-200'
  return 'bg-blue-100'
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  records: LeaveRecordRow[]
  totalEmployees: number
  onSelectRange?: (startDate: string, endDate: string) => void
}

// ── Component — 3-month compact view ─────────────────────────────────────────

export default function LeaveCalendar({ records, totalEmployees, onSelectRange }: Props) {
  const today = new Date()
  const [startMonth, setStartMonth] = useState(today.getMonth())
  const [startYear, setStartYear] = useState(today.getFullYear())

  // Drag state
  const [dragStart, setDragStart] = useState<string | null>(null)
  const [dragEnd, setDragEnd] = useState<string | null>(null)
  const isDragging = useRef(false)

  // Build leave-per-day map
  const dayMap = useMemo(() => {
    const map = new Map<string, { count: number; names: string[] }>()
    for (const r of records) {
      if (r.status === 'rejected') continue
      const start = new Date(r.startDate + 'T00:00:00')
      const end = new Date(r.endDate + 'T00:00:00')
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = isoDate(d)
        const entry = map.get(key) ?? { count: 0, names: [] }
        entry.count++
        if (!entry.names.includes(r.employeeName)) entry.names.push(r.employeeName)
        map.set(key, entry)
      }
    }
    return map
  }, [records])

  function prevPeriod() {
    if (startMonth <= 2) { setStartMonth(startMonth + 9); setStartYear(startYear - 1) }
    else setStartMonth(startMonth - 3)
  }
  function nextPeriod() {
    if (startMonth >= 9) { setStartMonth(startMonth - 9); setStartYear(startYear + 1) }
    else setStartMonth(startMonth + 3)
  }

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
      const s = dragStart < dragEnd ? dragStart : dragEnd
      const e = dragStart < dragEnd ? dragEnd : dragStart
      onSelectRange?.(s, e)
    }
    isDragging.current = false
    setDragStart(null)
    setDragEnd(null)
  }, [dragStart, dragEnd, onSelectRange])

  function isInDragRange(dateStr: string): boolean {
    if (!dragStart || !dragEnd) return false
    const s = dragStart < dragEnd ? dragStart : dragEnd
    const e = dragStart < dragEnd ? dragEnd : dragStart
    return dateStr >= s && dateStr <= e
  }

  const todayStr = isoDate(today)

  // Render 3 months side by side
  const months = [0, 1, 2].map((offset) => {
    let m = startMonth + offset
    let y = startYear
    if (m > 11) { m -= 12; y++ }
    return { month: m, year: y, days: getDaysInMonth(y, m) }
  })

  return (
    <div
      className="rounded-2xl border border-gray-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden"
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { isDragging.current = false; setDragStart(null); setDragEnd(null) }}
    >
      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
        <button onClick={prevPeriod} className="w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <span className="text-xs font-bold text-gray-900">
          {MONTH_LABELS[months[0].month]} – {MONTH_LABELS[months[2].month]} {months[0].year}
        </span>
        <button onClick={nextPeriod} className="w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      {/* 3-month grid */}
      <div className="grid grid-cols-3 divide-x divide-gray-100">
        {months.map(({ month, year, days }) => {
          const firstDayOffset = (() => { const d = days[0].getDay(); return d === 0 ? 6 : d - 1 })()
          return (
            <div key={`${year}-${month}`} className="p-2">
              <p className="text-[10px] font-bold text-gray-500 text-center mb-1.5 uppercase tracking-wider">{MONTH_LABELS[month]}</p>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-[1px] mb-[1px]">
                {WEEKDAY_LABELS.map((label, i) => (
                  <div key={i} className={`text-center text-[8px] font-bold leading-none py-0.5 ${i >= 5 ? 'text-gray-200' : 'text-gray-300'}`}>{label}</div>
                ))}
              </div>
              {/* Days */}
              <div className="grid grid-cols-7 gap-[1px] select-none">
                {Array.from({ length: firstDayOffset }, (_, i) => (
                  <div key={`e-${i}`} className="aspect-square" />
                ))}
                {days.map((day) => {
                  const dateStr = isoDate(day)
                  const entry = dayMap.get(dateStr)
                  const count = entry?.count ?? 0
                  const isToday = dateStr === todayStr
                  const inRange = isInDragRange(dateStr)
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6

                  return (
                    <div
                      key={dateStr}
                      onMouseDown={() => handleMouseDown(dateStr)}
                      onMouseEnter={() => handleMouseEnter(dateStr)}
                      className={[
                        'aspect-square rounded-[3px] flex items-center justify-center cursor-crosshair transition-all duration-100 relative group',
                        'text-[9px] font-medium leading-none',
                        inRange ? 'ring-1 ring-[#4F6BFF] bg-[#4F6BFF]/20' : tileColor(count, totalEmployees),
                        isToday && !inRange ? 'ring-1 ring-[#4F6BFF]' : '',
                        count > 0 ? 'font-bold' : isWeekend ? 'text-gray-300' : 'text-gray-400',
                        isWeekend && count === 0 && !inRange ? 'bg-gray-100/60' : '',
                      ].join(' ')}
                      title={entry ? `${count}: ${entry.names.join(', ')}` : undefined}
                    >
                      {day.getDate()}
                      {/* Hover tooltip */}
                      {entry && (
                        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block pointer-events-none">
                          <div className="rounded-md bg-gray-900 text-white px-2 py-1 text-[9px] shadow-lg whitespace-nowrap">
                            <p className="font-bold">{count} afwezig</p>
                            {entry.names.slice(0, 3).map((n) => <p key={n} className="text-gray-400">{n}</p>)}
                            {entry.names.length > 3 && <p className="text-gray-500">+{entry.names.length - 3}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend + tip */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100">
        <div className="flex items-center gap-1.5 text-[9px] text-gray-400">
          <span>0</span>
          <div className="w-3 h-3 rounded-[2px] bg-gray-50 border border-gray-200" />
          <div className="w-3 h-3 rounded-[2px] bg-blue-100" />
          <div className="w-3 h-3 rounded-[2px] bg-blue-200" />
          <div className="w-3 h-3 rounded-[2px] bg-blue-300" />
          <div className="w-3 h-3 rounded-[2px] bg-amber-300" />
          <div className="w-3 h-3 rounded-[2px] bg-red-400" />
          <span>Hoog</span>
        </div>
        <span className="text-[9px] text-gray-300">Sleep om te selecteren</span>
      </div>
    </div>
  )
}
