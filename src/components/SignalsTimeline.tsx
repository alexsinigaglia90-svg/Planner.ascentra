'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Signal } from '@/lib/signals'
import { BorderBeam } from '@/components/ui/border-beam'

interface Props {
  signals: Signal[]
}

const SEVERITY_STYLES = {
  high: { border: 'border-red-200', bg: 'bg-red-50/50', dot: 'bg-red-500', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
  medium: { border: 'border-amber-200', bg: 'bg-amber-50/40', dot: 'bg-amber-500', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  low: { border: 'border-blue-200', bg: 'bg-blue-50/40', dot: 'bg-blue-500', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
  info: { border: 'border-gray-200', bg: 'bg-gray-50/40', dot: 'bg-gray-400', text: 'text-gray-600', badge: 'bg-gray-100 text-gray-600' },
}

const CATEGORY_LABELS: Record<string, string> = {
  health: 'Gezondheid',
  economy: 'Bedrijf',
  calendar: 'Kalender',
  weather: 'Weer',
  internal: 'Intern patroon',
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

function isActive(signal: Signal): boolean {
  const today = new Date().toISOString().slice(0, 10)
  return signal.startDate <= today && signal.endDate >= today
}

export default function SignalsTimeline({ signals }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!filter) return signals
    return signals.filter((s) => s.category === filter)
  }, [signals, filter])

  const activeSignals = filtered.filter(isActive)
  const upcomingSignals = filtered.filter((s) => !isActive(s))

  const categories = useMemo(() => {
    const cats = new Set(signals.map((s) => s.category))
    return Array.from(cats)
  }, [signals])

  if (signals.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
        <span className="text-3xl block mb-3">🔭</span>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Geen signalen</h3>
        <p className="text-xs text-gray-500">De radar is schoon — geen bijzonderheden in de komende 3 maanden.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="relative rounded-2xl border border-gray-200 bg-white p-5 overflow-hidden">
        <BorderBeam size={200} duration={16} colorFrom="#4F6BFF" colorTo="#22C55E" borderWidth={1.5} />
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Forecast & Signalen</h2>
            <p className="text-xs text-gray-300 mt-0.5">Externe en interne factoren die je planning beinvloeden</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${activeSignals.length > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${activeSignals.length > 0 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
              {activeSignals.length} actief
            </span>
            <span className="text-[10px] text-gray-400">{upcomingSignals.length} aankomend</span>
          </div>
        </div>

        {/* Visual timeline bar */}
        <div className="relative h-12 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden">
          {/* Month markers */}
          {(() => {
            const now = new Date()
            const months: string[] = []
            for (let i = 0; i < 4; i++) {
              const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
              months.push(d.toLocaleDateString('nl-NL', { month: 'short' }))
            }
            return months.map((m, i) => (
              <div key={m} className="absolute top-0 bottom-0 flex items-end pb-1" style={{ left: `${(i / 3) * 100}%` }}>
                <span className="text-[8px] font-bold text-gray-300 uppercase ml-1">{m}</span>
                <div className="absolute top-0 bottom-0 w-px bg-gray-200" />
              </div>
            ))
          })()}

          {/* Signal bars */}
          {filtered.slice(0, 8).map((signal, i) => {
            const now = new Date()
            const horizonMs = 90 * 24 * 60 * 60 * 1000 // 3 months
            const startMs = Math.max(0, new Date(signal.startDate + 'T00:00:00').getTime() - now.getTime())
            const endMs = Math.min(horizonMs, new Date(signal.endDate + 'T00:00:00').getTime() - now.getTime())
            const left = (startMs / horizonMs) * 100
            const width = Math.max(1, ((endMs - startMs) / horizonMs) * 100)
            const style = SEVERITY_STYLES[signal.severity]

            return (
              <motion.div key={signal.id}
                initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className={`absolute rounded-sm ${style.dot} cursor-pointer hover:brightness-110`}
                style={{ left: `${left}%`, width: `${width}%`, top: 4 + (i % 3) * 12, height: 8, opacity: isActive(signal) ? 0.9 : 0.5, originX: 0 }}
                title={signal.title}
                onClick={() => setExpandedId(expandedId === signal.id ? null : signal.id)}
              />
            )
          })}

          {/* Today marker */}
          <div className="absolute top-0 bottom-0 w-0.5 bg-[#4F6BFF] z-10" style={{ left: '0%' }}>
            <div className="absolute -top-0.5 -left-1 w-2.5 h-2.5 rounded-full bg-[#4F6BFF] border-2 border-white" />
          </div>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2">
        <button onClick={() => setFilter(null)}
          className={`text-[11px] font-medium rounded-full px-3 py-1 transition-colors ${!filter ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
          Alle
        </button>
        {categories.map((cat) => (
          <button key={cat} onClick={() => setFilter(filter === cat ? null : cat)}
            className={`text-[11px] font-medium rounded-full px-3 py-1 transition-colors ${filter === cat ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* Active signals */}
      {activeSignals.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Nu actief ({activeSignals.length})
          </h3>
          <div className="space-y-2">
            {activeSignals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} expanded={expandedId === signal.id}
                onToggle={() => setExpandedId(expandedId === signal.id ? null : signal.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming signals */}
      {upcomingSignals.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            Aankomend ({upcomingSignals.length})
          </h3>
          <div className="space-y-2">
            {upcomingSignals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} expanded={expandedId === signal.id}
                onToggle={() => setExpandedId(expandedId === signal.id ? null : signal.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SignalCard({ signal, expanded, onToggle }: { signal: Signal; expanded: boolean; onToggle: () => void }) {
  const style = SEVERITY_STYLES[signal.severity]
  const active = isActive(signal)

  return (
    <motion.div layout
      className={`rounded-xl border ${style.border} ${active ? style.bg : 'bg-white'} overflow-hidden cursor-pointer transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]`}
      onClick={onToggle}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-lg shrink-0">{signal.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{signal.title}</span>
            {active && <span className={`w-1.5 h-1.5 rounded-full ${style.dot} animate-pulse`} />}
            <span className={`text-[9px] font-bold uppercase rounded-full px-1.5 py-0.5 ${style.badge}`}>
              {CATEGORY_LABELS[signal.category]}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatShortDate(signal.startDate)} – {formatShortDate(signal.endDate)}
            {signal.expectedAbsenceIncrease && (
              <span className={`ml-2 font-bold ${style.text}`}>+{signal.expectedAbsenceIncrease}% verzuim</span>
            )}
          </p>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`} viewBox="0 0 14 14" fill="none">
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-0 border-t border-gray-100/50">
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">{signal.description}</p>
              <div className="mt-2 rounded-lg bg-white/60 border border-gray-100 px-3 py-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Impact & advies</p>
                <p className="text-xs text-gray-700 leading-relaxed">{signal.impact}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
