'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

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

function formatDisplay(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()
  if (start === end) {
    return s.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  if (sameMonth) {
    return `${s.getDate()} – ${e.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }
  return `${s.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

const WEEKDAYS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
const MONTHS = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December']

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  startDate: string
  endDate: string
  onChangeStart: (date: string) => void
  onChangeEnd: (date: string) => void
  label?: string
  className?: string
  minDate?: string
}

// ── Component ────────────────────────────────────────────────────────────────

export function DateRangePicker({ startDate, endDate, onChangeStart, onChangeEnd, label, className, minDate }: Props) {
  const [open, setOpen] = useState(false)
  const [selectingEnd, setSelectingEnd] = useState(false)
  const [hoverDate, setHoverDate] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const today = isoDate(new Date())
  const [viewYear, setViewYear] = useState(() => {
    if (startDate) return new Date(startDate + 'T00:00:00').getFullYear()
    return new Date().getFullYear()
  })
  const [viewMonth, setViewMonth] = useState(() => {
    if (startDate) return new Date(startDate + 'T00:00:00').getMonth()
    return new Date().getMonth()
  })

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const days = useMemo(() => getDaysInMonth(viewYear, viewMonth), [viewYear, viewMonth])
  const firstDayOffset = useMemo(() => {
    const d = days[0].getDay()
    return d === 0 ? 6 : d - 1
  }, [days])

  // Second month
  const month2 = viewMonth === 11 ? 0 : viewMonth + 1
  const year2 = viewMonth === 11 ? viewYear + 1 : viewYear
  const days2 = useMemo(() => getDaysInMonth(year2, month2), [year2, month2])
  const firstDayOffset2 = useMemo(() => {
    const d = days2[0].getDay()
    return d === 0 ? 6 : d - 1
  }, [days2])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
    else setViewMonth(viewMonth - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
    else setViewMonth(viewMonth + 1)
  }

  function handleDayClick(dateStr: string) {
    if (minDate && dateStr < minDate) return

    if (!selectingEnd) {
      // Selecting start date
      onChangeStart(dateStr)
      onChangeEnd('')
      setSelectingEnd(true)
      setHoverDate(null)
    } else {
      // Selecting end date
      if (dateStr >= startDate) {
        onChangeEnd(dateStr)
      } else {
        // Clicked before start — swap
        onChangeEnd(startDate)
        onChangeStart(dateStr)
      }
      setSelectingEnd(false)
      setHoverDate(null)
      setOpen(false)
    }
  }

  function isInRange(dateStr: string): boolean {
    if (!startDate) return false
    const end = selectingEnd && hoverDate ? hoverDate : endDate
    if (!end) return false
    const rangeStart = startDate < end ? startDate : end
    const rangeEnd = startDate < end ? end : startDate
    return dateStr > rangeStart && dateStr < rangeEnd
  }

  function isRangeStart(dateStr: string): boolean {
    return dateStr === startDate
  }

  function isRangeEnd(dateStr: string): boolean {
    if (selectingEnd && hoverDate) return dateStr === hoverDate
    return dateStr === endDate
  }

  function renderDay(day: Date, isCurrentMonth: boolean) {
    const dateStr = isoDate(day)
    const isToday = dateStr === today
    const isDisabled = !!(minDate && dateStr < minDate)
    const inRange = isInRange(dateStr)
    const isStart = isRangeStart(dateStr)
    const isEnd = isRangeEnd(dateStr)
    const isSelected = isStart || isEnd

    return (
      <div
        key={dateStr}
        onClick={() => !isDisabled && handleDayClick(dateStr)}
        onMouseEnter={() => selectingEnd && !isDisabled && setHoverDate(dateStr)}
        className={cn(
          'relative flex items-center justify-center h-8 text-[13px] transition-colors cursor-pointer',
          inRange && 'bg-[#4F6BFF]/10',
          isStart && 'rounded-l-lg',
          isEnd && 'rounded-r-lg',
          !isCurrentMonth && 'opacity-30',
          isDisabled && 'opacity-20 cursor-not-allowed',
        )}
      >
        <span
          className={cn(
            'relative z-10 flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150',
            isSelected && 'bg-[#4F6BFF] text-white font-bold shadow-[0_2px_8px_rgba(79,107,255,0.35)]',
            !isSelected && !isDisabled && 'hover:bg-gray-100',
            isToday && !isSelected && 'font-bold text-[#4F6BFF] ring-1 ring-[#4F6BFF]/30',
            isDisabled && 'hover:bg-transparent',
          )}
        >
          {day.getDate()}
        </span>
      </div>
    )
  }

  function renderMonth(monthDays: Date[], offset: number, monthIdx: number, yearIdx: number) {
    return (
      <div>
        <p className="text-sm font-bold text-gray-900 text-center mb-3">{MONTHS[monthIdx]} {yearIdx}</p>
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="text-center text-[10px] font-bold uppercase text-gray-400 py-1">{wd}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: offset }, (_, i) => <div key={`e-${i}`} className="h-8" />)}
          {monthDays.map((day) => renderDay(day, true))}
        </div>
      </div>
    )
  }

  const hasValue = startDate && endDate

  return (
    <div className={cn('relative', className)} ref={ref}>
      {label && (
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">{label}</label>
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center gap-2.5 rounded-xl border bg-white px-3 py-2.5 text-sm text-left transition-colors',
          open ? 'border-[#4F6BFF] ring-2 ring-[#4F6BFF]/20' : 'border-gray-200 hover:border-gray-300',
        )}
      >
        <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="2.5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
          <path d="M5 1v2.5M11 1v2.5M1 6.5h14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        {hasValue ? (
          <span className="text-gray-900 font-medium flex-1">{formatDisplay(startDate, endDate)}</span>
        ) : (
          <span className="text-gray-400 flex-1">{selectingEnd ? 'Selecteer einddatum...' : 'Selecteer periode...'}</span>
        )}
        {selectingEnd && (
          <span className="text-[9px] font-bold text-[#4F6BFF] bg-blue-50 rounded-full px-2 py-0.5 shrink-0">Kies eind</span>
        )}
      </button>

      {/* Calendar dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full mt-2 left-0 rounded-2xl border border-gray-200 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.12)] p-4"
            style={{ width: 540 }}
          >
            {/* Navigation */}
            <div className="flex items-center justify-between mb-3 px-1">
              <button type="button" onClick={prevMonth} className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button type="button" onClick={() => { setViewMonth(new Date().getMonth()); setViewYear(new Date().getFullYear()) }} className="text-[10px] font-semibold text-[#4F6BFF] hover:underline">
                Vandaag
              </button>
              <button type="button" onClick={nextMonth} className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>

            {/* Two month grid */}
            <div className="grid grid-cols-2 gap-6">
              {renderMonth(days, firstDayOffset, viewMonth, viewYear)}
              {renderMonth(days2, firstDayOffset2, month2, year2)}
            </div>

            {/* Quick presets */}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
              <span className="text-[10px] text-gray-400 shrink-0">Snel:</span>
              {[
                { label: 'Vandaag', start: today, end: today },
                { label: 'Deze week', start: (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoDate(d) })(), end: (() => { const d = new Date(); d.setDate(d.getDate() + (7 - d.getDay()) % 7); return isoDate(d) })() },
                { label: '1 week', start: today, end: (() => { const d = new Date(); d.setDate(d.getDate() + 6); return isoDate(d) })() },
                { label: '2 weken', start: today, end: (() => { const d = new Date(); d.setDate(d.getDate() + 13); return isoDate(d) })() },
                { label: '1 maand', start: today, end: (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(d.getDate() - 1); return isoDate(d) })() },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    onChangeStart(preset.start)
                    onChangeEnd(preset.end)
                    setSelectingEnd(false)
                    setOpen(false)
                  }}
                  className="text-[11px] font-medium text-gray-500 hover:text-[#4F6BFF] bg-gray-50 hover:bg-blue-50 rounded-lg px-2.5 py-1 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
