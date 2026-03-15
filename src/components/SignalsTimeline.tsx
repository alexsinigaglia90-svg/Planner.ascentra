'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Signal } from '@/lib/signals'

interface Props { signals: Signal[] }

const SEV = {
  high:   { dot: '#EF4444', bg: 'bg-red-50/50',    border: 'border-red-200',   badge: 'bg-red-100 text-red-700',   text: 'text-red-600' },
  medium: { dot: '#F59E0B', bg: 'bg-amber-50/40',   border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', text: 'text-amber-600' },
  low:    { dot: '#3B82F6', bg: 'bg-blue-50/40',    border: 'border-blue-200',  badge: 'bg-blue-100 text-blue-700',  text: 'text-blue-600' },
  info:   { dot: '#9CA3AF', bg: 'bg-gray-50/40',    border: 'border-gray-200',  badge: 'bg-gray-100 text-gray-600',  text: 'text-gray-500' },
}

const CAT_LABELS: Record<string, string> = { health: 'Gezondheid', economy: 'Bedrijf', calendar: 'Kalender', weather: 'Weer', internal: 'Intern' }

function fmtShort(d: string) { return new Date(d + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) }
function isNow(s: Signal) { const t = new Date().toISOString().slice(0, 10); return s.startDate <= t && s.endDate >= t }
function daysUntil(d: string) { return Math.max(0, Math.ceil((new Date(d + 'T00:00:00').getTime() - Date.now()) / 86400000)) }

// ── Radar Sweep ──────────────────────────────────────────────────────────────

function RadarSweep({ signals }: { signals: Signal[] }) {
  const now = Date.now()
  const threeMonths = 90 * 24 * 60 * 60 * 1000

  const blips = useMemo(() => signals.map((s, i) => {
    const startMs = new Date(s.startDate + 'T00:00:00').getTime()
    const midMs = startMs + (new Date(s.endDate + 'T00:00:00').getTime() - startMs) / 2
    const timeFrac = Math.min(1, Math.max(0, (midMs - now) / threeMonths))
    const dist = 0.2 + timeFrac * 0.7 // closer to center = sooner
    const angle = ((i * 137.5) % 360) * (Math.PI / 180) // golden angle spread
    return { ...s, x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, dist, active: isNow(s) }
  }), [signals, now, threeMonths])

  const R = 140
  return (
    <div className="relative flex items-center justify-center" style={{ width: R * 2, height: R * 2 }}>
      <svg width={R * 2} height={R * 2} viewBox={`0 0 ${R * 2} ${R * 2}`}>
        <defs>
          <radialGradient id="radarBg" cx="50%" cy="50%"><stop offset="0%" stopColor="#4F6BFF" stopOpacity="0.03" /><stop offset="100%" stopColor="#4F6BFF" stopOpacity="0" /></radialGradient>
          <linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#4F6BFF" stopOpacity="0" /><stop offset="100%" stopColor="#4F6BFF" stopOpacity="0.15" /></linearGradient>
          <filter id="blipGlow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        {/* Background */}
        <circle cx={R} cy={R} r={R - 2} fill="url(#radarBg)" stroke="#E5E7EB" strokeWidth="1" />

        {/* Range rings — 1m, 2m, 3m */}
        {[0.33, 0.66, 1].map((f, i) => (
          <g key={i}>
            <circle cx={R} cy={R} r={(R - 10) * f} fill="none" stroke="#E5E7EB" strokeWidth="0.5" strokeDasharray="3 4" />
            <text x={R + 4} y={R - (R - 10) * f + 4} fill="#D1D5DB" fontSize="8" fontWeight="600">{i + 1}m</text>
          </g>
        ))}

        {/* Cross lines */}
        <line x1={R} y1={10} x2={R} y2={R * 2 - 10} stroke="#F3F4F6" strokeWidth="0.5" />
        <line x1={10} y1={R} x2={R * 2 - 10} y2={R} stroke="#F3F4F6" strokeWidth="0.5" />

        {/* Sweep line — rotating */}
        <motion.line
          x1={R} y1={R} x2={R + (R - 10)} y2={R}
          stroke="url(#sweepGrad)" strokeWidth="1.5"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: `${R}px ${R}px` }}
        />

        {/* Sweep wedge — trailing glow */}
        <motion.path
          d={`M ${R} ${R} L ${R + (R - 10)} ${R} A ${R - 10} ${R - 10} 0 0 0 ${R + Math.cos(-0.4) * (R - 10)} ${R + Math.sin(-0.4) * (R - 10)} Z`}
          fill="#4F6BFF" opacity="0.04"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: `${R}px ${R}px` }}
        />

        {/* Signal blips */}
        {blips.map((b) => {
          const bx = R + b.x * (R - 15)
          const by = R + b.y * (R - 15)
          const color = SEV[b.severity].dot
          return (
            <g key={b.id}>
              {b.active && <circle cx={bx} cy={by} r="8" fill={color} opacity="0.15" filter="url(#blipGlow)">
                <animate attributeName="r" values="8;14;8" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.15;0.05;0.15" dur="2s" repeatCount="indefinite" />
              </circle>}
              <circle cx={bx} cy={by} r={b.active ? 4 : 3} fill={color} filter="url(#blipGlow)" opacity={b.active ? 1 : 0.6} />
              <text x={bx + 6} y={by + 3} fill="#6B7280" fontSize="7" fontWeight="500">{b.icon}</text>
            </g>
          )
        })}

        {/* Center dot */}
        <circle cx={R} cy={R} r="4" fill="#4F6BFF" />
        <circle cx={R} cy={R} r="7" fill="none" stroke="#4F6BFF" strokeWidth="1" opacity="0.3" />
        <text x={R} y={R + 18} textAnchor="middle" fill="#9CA3AF" fontSize="7" fontWeight="700">NU</text>
      </svg>
    </div>
  )
}

// ── Risk Heatmap ─────────────────────────────────────────────────────────────

function RiskHeatmap({ signals }: { signals: Signal[] }) {
  const year = new Date().getFullYear()

  const weekRisks = useMemo(() => {
    const risks: { week: number; month: number; score: number; signals: string[] }[] = []
    for (let w = 0; w < 52; w++) {
      const jan1 = new Date(year, 0, 1)
      const weekStart = new Date(jan1.getTime() + w * 7 * 86400000)
      const weekEnd = new Date(weekStart.getTime() + 6 * 86400000)
      const ws = weekStart.toISOString().slice(0, 10)
      const we = weekEnd.toISOString().slice(0, 10)

      let score = 0
      const names: string[] = []
      for (const s of signals) {
        if (s.startDate <= we && s.endDate >= ws) {
          score += s.severity === 'high' ? 30 : s.severity === 'medium' ? 15 : s.severity === 'low' ? 5 : 2
          if (s.expectedAbsenceIncrease) score += s.expectedAbsenceIncrease
          names.push(s.icon + ' ' + s.title)
        }
      }
      risks.push({ week: w + 1, month: weekStart.getMonth(), score: Math.min(100, score), signals: names })
    }
    return risks
  }, [signals, year])

  const months = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']

  function heatColor(score: number): string {
    if (score >= 60) return 'bg-red-400'
    if (score >= 40) return 'bg-red-300'
    if (score >= 25) return 'bg-amber-300'
    if (score >= 10) return 'bg-amber-200'
    if (score >= 3) return 'bg-blue-100'
    return 'bg-gray-50'
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">Risico heatmap — {year}</h3>
      <div className="flex gap-px">
        {months.map((m, mi) => {
          const monthWeeks = weekRisks.filter((w) => w.month === mi)
          return (
            <div key={m} className="flex-1 flex flex-col gap-px">
              <span className="text-[8px] font-bold text-gray-300 text-center mb-0.5">{m}</span>
              {monthWeeks.map((w) => (
                <div key={w.week}
                  className={`h-3 rounded-[2px] ${heatColor(w.score)} transition-colors cursor-default`}
                  title={w.signals.length > 0 ? `W${w.week} (risico: ${w.score})\n${w.signals.join('\n')}` : `W${w.week}: geen signalen`}
                />
              ))}
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-1.5 mt-2 justify-end text-[8px] text-gray-400">
        <span>Laag</span>
        {['bg-gray-50', 'bg-blue-100', 'bg-amber-200', 'bg-amber-300', 'bg-red-300', 'bg-red-400'].map((c, i) => (
          <div key={i} className={`w-3 h-3 rounded-[2px] ${c} border border-gray-200/50`} />
        ))}
        <span>Hoog</span>
      </div>
    </div>
  )
}

// ── Impact Score Chart ───────────────────────────────────────────────────────

function ImpactChart({ signals }: { signals: Signal[] }) {
  const year = new Date().getFullYear()
  const currentWeek = Math.ceil((Date.now() - new Date(year, 0, 1).getTime()) / (7 * 86400000))

  const weekScores = useMemo(() => {
    return Array.from({ length: 52 }, (_, w) => {
      const jan1 = new Date(year, 0, 1)
      const ws = new Date(jan1.getTime() + w * 7 * 86400000).toISOString().slice(0, 10)
      const we = new Date(jan1.getTime() + (w + 1) * 7 * 86400000 - 86400000).toISOString().slice(0, 10)
      let score = 0
      for (const s of signals) {
        if (s.startDate <= we && s.endDate >= ws) {
          score += s.expectedAbsenceIncrease ?? (s.severity === 'high' ? 20 : s.severity === 'medium' ? 10 : 5)
        }
      }
      return Math.min(50, score)
    })
  }, [signals, year])

  const maxScore = Math.max(10, ...weekScores)
  const W = 700, H = 100, PL = 30, PR = 5, PT = 5, PB = 18
  const cW = W - PL - PR, cH = H - PT - PB
  const xP = (i: number) => PL + (i / 51) * cW
  const yP = (v: number) => PT + cH - (v / maxScore) * cH

  const linePath = weekScores.map((s, i) => `${i === 0 ? 'M' : 'L'}${xP(i).toFixed(1)},${yP(s).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${xP(51).toFixed(1)},${yP(0).toFixed(1)} L${xP(0).toFixed(1)},${yP(0).toFixed(1)} Z`

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Impact score — workforce weather forecast</h3>
        <span className="text-[9px] text-gray-300">Hoger = meer risico op verzuim/onderbezetting</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
        <defs>
          <linearGradient id="impactGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#22C55E" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Grid */}
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={PL} y1={yP(f * maxScore)} x2={W - PR} y2={yP(f * maxScore)} stroke="#F3F4F6" strokeWidth="0.5" />
            <text x={PL - 4} y={yP(f * maxScore) + 3} textAnchor="end" fill="#D1D5DB" fontSize="7">{Math.round(f * maxScore)}</text>
          </g>
        ))}
        {/* Area + line */}
        <path d={areaPath} fill="url(#impactGrad)" />
        <path d={linePath} fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
        {/* Current week */}
        <line x1={xP(currentWeek - 1)} y1={PT} x2={xP(currentWeek - 1)} y2={H - PB} stroke="#4F6BFF" strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
        <circle cx={xP(currentWeek - 1)} cy={yP(weekScores[currentWeek - 1] ?? 0)} r="3" fill="#4F6BFF" stroke="white" strokeWidth="1.5" />
        {/* Month labels */}
        {['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'].map((m, i) => (
          <text key={m} x={xP(Math.round(i * 4.33))} y={H - 3} textAnchor="middle" fill="#D1D5DB" fontSize="7" fontWeight="500">{m}</text>
        ))}
      </svg>
    </div>
  )
}

// ── Signal Card ──────────────────────────────────────────────────────────────

function SignalCard({ signal, expanded, highlighted, onToggle }: { signal: Signal; expanded: boolean; highlighted: boolean; onToggle: () => void }) {
  const style = SEV[signal.severity]
  const active = isNow(signal)
  const countdown = !active ? daysUntil(signal.startDate) : 0

  return (
    <motion.div layout onClick={onToggle}
      className={[
        'rounded-xl border overflow-hidden cursor-pointer transition-all',
        highlighted ? 'ring-2 ring-[#4F6BFF]/40 shadow-[0_0_12px_rgba(79,107,255,0.1)]' : '',
        active ? `${style.border} ${style.bg}` : `border-gray-200 bg-white hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]`,
      ].join(' ')}>
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-lg shrink-0">{signal.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{signal.title}</span>
            {active && <span className={`w-1.5 h-1.5 rounded-full animate-pulse`} style={{ background: style.dot }} />}
            <span className={`text-[9px] font-bold uppercase rounded-full px-1.5 py-0.5 ${style.badge}`}>{CAT_LABELS[signal.category]}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
            <span>{fmtShort(signal.startDate)} – {fmtShort(signal.endDate)}</span>
            {signal.expectedAbsenceIncrease && <span className={`font-bold ${style.text}`}>+{signal.expectedAbsenceIncrease}%</span>}
            {!active && countdown > 0 && (
              <span className="text-[10px] font-bold text-[#4F6BFF] bg-blue-50 rounded-full px-2 py-0.5">
                over {countdown} dag{countdown !== 1 ? 'en' : ''}
              </span>
            )}
          </div>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`} viewBox="0 0 14 14" fill="none">
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-3 border-t border-gray-100/50">
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

// ── Main ─────────────────────────────────────────────────────────────────────

export default function SignalsTimeline({ signals }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<string | null>(null)

  // When a signal is expanded, highlight all signals overlapping with it
  const highlightedIds = useMemo(() => {
    if (!expandedId) return new Set<string>()
    const expanded = signals.find((s) => s.id === expandedId)
    if (!expanded) return new Set<string>()
    return new Set(
      signals.filter((s) => s.id !== expandedId && s.startDate <= expanded.endDate && s.endDate >= expanded.startDate).map((s) => s.id)
    )
  }, [expandedId, signals])

  const filtered = useMemo(() => filter ? signals.filter((s) => s.category === filter) : signals, [signals, filter])
  const active = filtered.filter(isNow)
  const upcoming = filtered.filter((s) => !isNow(s))
  const categories = useMemo(() => [...new Set(signals.map((s) => s.category))], [signals])

  if (signals.length === 0) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
      <span className="text-3xl block mb-3">🔭</span>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">Geen signalen</h3>
      <p className="text-xs text-gray-500">De radar is schoon.</p>
    </div>
  }

  return (
    <div className="space-y-6">
      {/* Top row: Radar + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white p-4">
          <RadarSweep signals={signals} />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <ImpactChart signals={signals} />
          <RiskHeatmap signals={signals} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <button onClick={() => setFilter(null)} className={`text-[11px] font-medium rounded-full px-3 py-1 transition-colors ${!filter ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Alle</button>
        {categories.map((cat) => (
          <button key={cat} onClick={() => setFilter(filter === cat ? null : cat)}
            className={`text-[11px] font-medium rounded-full px-3 py-1 transition-colors ${filter === cat ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            {CAT_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* Active */}
      {active.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />Nu actief ({active.length})
          </h3>
          <div className="space-y-2">
            {active.map((s) => <SignalCard key={s.id} signal={s} expanded={expandedId === s.id} highlighted={highlightedIds.has(s.id)} onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)} />)}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Aankomend ({upcoming.length})</h3>
          <div className="space-y-2">
            {upcoming.map((s) => <SignalCard key={s.id} signal={s} expanded={expandedId === s.id} highlighted={highlightedIds.has(s.id)} onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)} />)}
          </div>
        </div>
      )}
    </div>
  )
}
