'use client'

import { useMemo } from 'react'
import type { ShiftTemplate } from '@prisma/client'
import type { ProcessDetailRow } from '@/lib/queries/processes'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  shifts: ShiftTemplate[]
  processes: ProcessDetailRow[]
  breakCovers?: { sourceProcessId: string; targetProcessId: string; headcount: number }[]
}

// ─── Time helpers ────────────────────────────────────────────────────────────

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BREAK_PRIORITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: '#fef2f2', text: '#dc2626', label: 'Kritiek — mag nooit stoppen' },
  normal: { bg: '#f9fafb', text: '#6b7280', label: 'Normaal — roulerend' },
  flexible: { bg: '#ecfdf5', text: '#059669', label: 'Flexibel — levert aan kritiek' },
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function OperationsTimeline({ shifts, processes, breakCovers = [] }: Props) {
  // Calculate the operating window (earliest start to latest end)
  const { windowStart, windowEnd, totalMinutes } = useMemo(() => {
    let earliest = 24 * 60
    let latest = 0

    for (const s of shifts) {
      const start = parseTime(s.startTime)
      let end = parseTime(s.endTime)
      if (end <= start) end += 24 * 60 // overnight
      earliest = Math.min(earliest, start)
      latest = Math.max(latest, end)
    }

    for (const p of processes) {
      if (p.activeStartTime) earliest = Math.min(earliest, parseTime(p.activeStartTime))
      if (p.activeEndTime) {
        let end = parseTime(p.activeEndTime)
        if (end <= earliest) end += 24 * 60
        latest = Math.max(latest, end)
      }
    }

    // Round to nearest hour
    earliest = Math.floor(earliest / 60) * 60
    latest = Math.ceil(latest / 60) * 60

    return { windowStart: earliest, windowEnd: latest, totalMinutes: latest - earliest }
  }, [shifts, processes])

  // Generate hour markers
  const hourMarkers = useMemo(() => {
    const markers: number[] = []
    for (let m = windowStart; m <= windowEnd; m += 60) {
      markers.push(m)
    }
    return markers
  }, [windowStart, windowEnd])

  // Position helper
  function toPercent(minutes: number): number {
    return ((minutes - windowStart) / totalMinutes) * 100
  }

  function toPercentWidth(startMin: number, endMin: number): number {
    return ((endMin - startMin) / totalMinutes) * 100
  }

  if (shifts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white px-8 py-12 text-center">
        <p className="text-sm text-gray-400">Geen shifts geconfigureerd</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Operationele Tijdlijn</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {formatTime(windowStart)} — {formatTime(windowEnd % (24 * 60))} &middot; {totalMinutes / 60} uur operationeel
          </p>
        </div>
        <div className="flex items-center gap-3">
          {Object.entries(BREAK_PRIORITY_COLORS).map(([key, { bg, text, label }]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: text }} />
              <span className="text-[10px] text-gray-500">{key === 'critical' ? 'Kritiek' : key === 'normal' ? 'Normaal' : 'Flexibel'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline grid */}
      <div className="relative">
        {/* Hour markers */}
        <div className="flex items-end h-5 mb-1 relative">
          {hourMarkers.map((m) => (
            <div
              key={m}
              className="absolute text-[9px] text-gray-400 tabular-nums font-medium"
              style={{ left: `${toPercent(m)}%`, transform: 'translateX(-50%)' }}
            >
              {formatTime(m % (24 * 60))}
            </div>
          ))}
        </div>

        {/* Grid lines */}
        <div className="relative h-0 mb-0">
          {hourMarkers.map((m) => (
            <div
              key={m}
              className="absolute top-0 w-px bg-gray-100"
              style={{ left: `${toPercent(m)}%`, height: `${(shifts.length + processes.length + 1) * 36 + 20}px` }}
            />
          ))}
        </div>

        {/* Shifts row */}
        <div className="mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Shifts</p>
          <div className="space-y-1">
            {shifts.map((shift) => {
              const start = parseTime(shift.startTime)
              let end = parseTime(shift.endTime)
              if (end <= start) end += 24 * 60

              const nettoMinutes = (end - start) - (shift.breakMinutes ?? 30)
              const breakStart = shift.breakWindowStart
                ? parseTime(shift.breakWindowStart)
                : start + Math.floor((end - start) / 2) - Math.floor((shift.breakMinutes ?? 30) / 2)

              return (
                <div key={shift.id} className="relative h-8 rounded-lg bg-gray-50 border border-gray-200 overflow-hidden">
                  {/* Shift bar */}
                  <div
                    className="absolute top-0 bottom-0 bg-blue-100 border-l-2 border-blue-400 flex items-center"
                    style={{
                      left: `${toPercent(start)}%`,
                      width: `${toPercentWidth(start, end)}%`,
                    }}
                  >
                    <span className="text-[10px] font-semibold text-blue-700 ml-2 whitespace-nowrap">
                      {shift.name}
                    </span>
                    <span className="text-[9px] text-blue-500 ml-auto mr-2 tabular-nums whitespace-nowrap">
                      {nettoMinutes / 60}u netto
                    </span>
                  </div>

                  {/* Break indicator */}
                  {(shift.breakMinutes ?? 0) > 0 && (
                    <div
                      className="absolute top-0 bottom-0 bg-amber-200/40 border-x border-amber-300/50 flex items-center justify-center"
                      style={{
                        left: `${toPercent(breakStart)}%`,
                        width: `${toPercentWidth(breakStart, breakStart + (shift.breakMinutes ?? 30))}%`,
                      }}
                      title={`Pauze: ${shift.breakMinutes} min (${shift.breakMode ?? 'all'})`}
                    >
                      <span className="text-[8px] text-amber-700 font-medium">☕</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Processes row */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Processen</p>
          <div className="space-y-1">
            {processes.filter((p) => p.active).map((proc) => {
              const procStart = proc.activeStartTime ? parseTime(proc.activeStartTime) : windowStart
              let procEnd = proc.activeEndTime ? parseTime(proc.activeEndTime) : windowEnd
              if (procEnd <= procStart) procEnd += 24 * 60

              const priorityStyle = BREAK_PRIORITY_COLORS[proc.breakPriority] ?? BREAK_PRIORITY_COLORS.normal

              // Check if this process receives cover
              const incomingCovers = breakCovers.filter((c) => c.targetProcessId === proc.id)
              // Check if this process donates cover
              const outgoingCovers = breakCovers.filter((c) => c.sourceProcessId === proc.id)

              return (
                <div key={proc.id} className="relative h-8 rounded-lg overflow-hidden" style={{ backgroundColor: '#fafafa' }}>
                  {/* Process bar */}
                  <div
                    className="absolute top-0 bottom-0 rounded-lg border flex items-center"
                    style={{
                      left: `${toPercent(procStart)}%`,
                      width: `${toPercentWidth(procStart, procEnd)}%`,
                      backgroundColor: priorityStyle.bg,
                      borderColor: `${priorityStyle.text}30`,
                      borderLeftWidth: 3,
                      borderLeftColor: proc.color ?? priorityStyle.text,
                    }}
                  >
                    <span className="text-[10px] font-semibold ml-2 truncate" style={{ color: priorityStyle.text }}>
                      {proc.name}
                    </span>

                    {/* Timing label */}
                    {(proc.activeStartTime || proc.activeEndTime) && (
                      <span className="text-[8px] tabular-nums ml-auto mr-2 whitespace-nowrap" style={{ color: `${priorityStyle.text}99` }}>
                        {proc.activeStartTime ?? ''}-{proc.activeEndTime ?? ''}
                      </span>
                    )}

                    {/* Cover indicators */}
                    {incomingCovers.length > 0 && (
                      <span className="text-[8px] text-red-500 mr-1" title={`Ontvangt ${incomingCovers.reduce((s, c) => s + c.headcount, 0)} medewerkers tijdens pauze`}>
                        ◀ +{incomingCovers.reduce((s, c) => s + c.headcount, 0)}
                      </span>
                    )}
                    {outgoingCovers.length > 0 && (
                      <span className="text-[8px] text-emerald-500 mr-1" title={`Stuurt ${outgoingCovers.reduce((s, c) => s + c.headcount, 0)} medewerkers naar kritiek proces`}>
                        ▶ -{outgoingCovers.reduce((s, c) => s + c.headcount, 0)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
