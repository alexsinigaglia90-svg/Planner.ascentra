'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion'
import type { ReviewQueueItem, Verdict, ReviewStats, PeriodSummary, EmployeeTrend } from '@/app/workforce/reviews/actions'
import { submitReviewAction, getReviewQueue } from '@/app/workforce/reviews/actions'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  BarChart3,
  Users,
  Zap,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Sparkles,
  ChevronRight,
} from 'lucide-react'

// ── Types ───────────────────────────────────────────────────────────────────

interface Props {
  initialQueue: ReviewQueueItem[]
  initialAnalytics: {
    currentPeriod: ReviewStats
    periodTrends: PeriodSummary[]
    employeeTrends: EmployeeTrend[]
    topImprovers: { name: string; count: number }[]
  }
}

// ── Level config ────────────────────────────────────────────────────────────

const LEVELS = [
  { level: 0, label: 'Not trained', color: '#d1d5db', bg: 'bg-gray-100' },
  { level: 1, label: 'Learning', color: '#f97316', bg: 'bg-orange-50' },
  { level: 2, label: 'Operational', color: '#3b82f6', bg: 'bg-blue-50' },
  { level: 3, label: 'Strong', color: '#8b5cf6', bg: 'bg-violet-50' },
  { level: 4, label: 'Elite', color: '#d4a017', bg: 'bg-amber-50' },
]

// ── Skill level ring (small) ────────────────────────────────────────────────

function LevelRing({ level, size = 40 }: { level: number; size?: number }) {
  const cfg = LEVELS[level] ?? LEVELS[0]
  const r = 14
  const circ = 2 * Math.PI * r
  const progress = level > 0 ? (level / 4) * circ : 0

  return (
    <svg width={size} height={size} viewBox="0 0 36 36">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3" />
      {level > 0 && (
        <circle cx="18" cy="18" r={r} fill="none" stroke={cfg.color} strokeWidth="3.5"
          strokeLinecap="round" strokeDasharray={`${progress} ${circ}`}
          transform="rotate(-90 18 18)" style={{ transition: 'stroke-dasharray 0.5s ease' }} />
      )}
      <text x="18" y="18" textAnchor="middle" dominantBaseline="central"
        fill={level > 0 ? cfg.color : '#9ca3af'} fontSize="11" fontWeight="700">
        {level}
      </text>
    </svg>
  )
}

// ── Swipe Card ──────────────────────────────────────────────────────────────

function SwipeCard({
  item,
  onVerdict,
  isTop,
}: {
  item: ReviewQueueItem
  onVerdict: (verdict: Verdict) => void
  isTop: boolean
}) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 0, 200], [-15, 0, 15])
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5])

  // Verdict overlays
  const improvedOpacity = useTransform(x, [0, 80, 150], [0, 0.5, 1])
  const declinedOpacity = useTransform(x, [-150, -80, 0], [1, 0.5, 0])

  const cfg = LEVELS[item.currentLevel] ?? LEVELS[0]

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > 100) {
      onVerdict('improved')
    } else if (info.offset.x < -100) {
      onVerdict('declined')
    }
    // If vertical swipe up > threshold → 'same'
    if (info.offset.y < -80 && Math.abs(info.offset.x) < 60) {
      onVerdict('same')
    }
  }

  return (
    <motion.div
      className="absolute inset-0"
      style={{ x, rotate, opacity, zIndex: isTop ? 10 : 0 }}
      drag={isTop}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      initial={{ scale: isTop ? 1 : 0.95, y: isTop ? 0 : 8 }}
      animate={{ scale: isTop ? 1 : 0.95, y: isTop ? 0 : 8, opacity: isTop ? 1 : 0.6 }}
      exit={{
        x: 300,
        opacity: 0,
        scale: 0.8,
        transition: { duration: 0.3 },
      }}
      whileDrag={{ cursor: 'grabbing' }}
    >
      <div className="relative w-full h-full rounded-2xl bg-white border border-gray-200 shadow-xl overflow-hidden cursor-grab select-none">
        {/* Verdict overlays */}
        <motion.div className="absolute inset-0 rounded-2xl border-4 border-emerald-400 bg-emerald-50/30 flex items-center justify-center z-20 pointer-events-none"
          style={{ opacity: improvedOpacity }}>
          <div className="bg-emerald-500 text-white rounded-full px-6 py-2 text-lg font-bold rotate-[-15deg] shadow-lg">
            VERBETERD
          </div>
        </motion.div>
        <motion.div className="absolute inset-0 rounded-2xl border-4 border-red-400 bg-red-50/30 flex items-center justify-center z-20 pointer-events-none"
          style={{ opacity: declinedOpacity }}>
          <div className="bg-red-500 text-white rounded-full px-6 py-2 text-lg font-bold rotate-[15deg] shadow-lg">
            VERSLECHTERD
          </div>
        </motion.div>

        {/* Card header — process color bar */}
        <div className="h-1.5" style={{ background: item.processColor ?? '#6366f1' }} />

        {/* Content */}
        <div className="p-6 flex flex-col items-center gap-5">
          {/* Employee avatar */}
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white"
            style={{ background: item.processColor ?? '#6366f1' }}>
            {item.employeeName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
          </div>

          {/* Employee name */}
          <div className="text-center">
            <h3 className="text-lg font-bold text-gray-900">{item.employeeName}</h3>
            <div className="flex items-center justify-center gap-2 mt-1 text-sm text-gray-500">
              {item.department && <span>{item.department}</span>}
              {item.department && item.team && <span className="text-gray-300">&#8226;</span>}
              {item.team && <span>{item.team}</span>}
            </div>
            <span className="inline-block mt-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {item.employeeType === 'internal' ? 'Intern' : 'Uitzendkracht'}
            </span>
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-gray-100" />

          {/* Process + Level */}
          <div className="flex items-center gap-4 w-full">
            <LevelRing level={item.currentLevel} size={56} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{item.processName}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Huidig niveau: <span className="font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                {item.daysSinceReview === null
                  ? 'Nog nooit gereviewd'
                  : `Laatste review: ${item.daysSinceReview} dagen geleden`}
              </p>
            </div>
          </div>

          {/* Question */}
          <div className="w-full rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-center">
            <p className="text-sm font-medium text-gray-700">
              Is {item.employeeName.split(' ')[0]} <span className="font-semibold" style={{ color: cfg.color }}>verbeterd</span>,{' '}
              <span className="font-semibold text-gray-500">gelijk gebleven</span>, of{' '}
              <span className="font-semibold text-red-500">verslechterd</span> op{' '}
              <span className="font-semibold">{item.processName}</span>?
            </p>
          </div>

          {/* Button row */}
          <div className="flex items-center gap-3 w-full">
            <button onClick={() => onVerdict('declined')}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 bg-red-50 border border-red-200 text-red-600 font-semibold text-sm hover:bg-red-100 transition-colors active:scale-95">
              <TrendingDown className="w-4 h-4" /> Verslechterd
            </button>
            <button onClick={() => onVerdict('same')}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 bg-gray-50 border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-100 transition-colors active:scale-95">
              <Minus className="w-4 h-4" /> Gelijk
            </button>
            <button onClick={() => onVerdict('improved')}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 bg-emerald-50 border border-emerald-200 text-emerald-600 font-semibold text-sm hover:bg-emerald-100 transition-colors active:scale-95">
              <TrendingUp className="w-4 h-4" /> Verbeterd
            </button>
          </div>
        </div>

        {/* Swipe hints */}
        {isTop && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center">
            <p className="text-[10px] text-gray-300 tracking-wide">
              SWIPE ← VERSLECHTERD &nbsp;&#8226;&nbsp; ↑ GELIJK &nbsp;&#8226;&nbsp; VERBETERD →
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Level-up / Level-down celebration ───────────────────────────────────────

function LevelChangeToast({ direction, level }: { direction: 'up' | 'down'; level: number }) {
  const cfg = LEVELS[level] ?? LEVELS[0]
  const isUp = direction === 'up'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 rounded-2xl px-6 py-4 shadow-2xl border
        ${isUp ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-300'}`}
    >
      <div className="flex items-center gap-3">
        {isUp ? (
          <motion.div animate={{ rotate: [0, -10, 10, -5, 5, 0], scale: [1, 1.2, 1] }} transition={{ duration: 0.6 }}>
            <Sparkles className="w-6 h-6 text-emerald-500" />
          </motion.div>
        ) : (
          <ArrowDown className="w-6 h-6 text-red-500" />
        )}
        <div>
          <p className={`text-sm font-bold ${isUp ? 'text-emerald-700' : 'text-red-700'}`}>
            Level {isUp ? 'Up!' : 'Down'}
          </p>
          <p className="text-xs text-gray-500">
            Nieuw niveau: <span className="font-semibold" style={{ color: cfg.color }}>{cfg.label} ({level})</span>
          </p>
        </div>
      </div>
    </motion.div>
  )
}

// ── Analytics panel ─────────────────────────────────────────────────────────

function AnalyticsDashboard({ stats, periodTrends, employeeTrends, topImprovers }: {
  stats: ReviewStats
  periodTrends: PeriodSummary[]
  employeeTrends: EmployeeTrend[]
  topImprovers: { name: string; count: number }[]
}) {
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null)

  // Donut chart data
  const donutTotal = stats.totalReviews || 1
  const donutSegments = [
    { label: 'Verbeterd', value: stats.improved, color: '#10b981' },
    { label: 'Gelijk', value: stats.same, color: '#9ca3af' },
    { label: 'Verslechterd', value: stats.declined, color: '#ef4444' },
  ]

  // Build donut arcs
  const r = 42
  const circ = 2 * Math.PI * r
  let donutOffset = 0
  const arcs = donutSegments.map((seg) => {
    const pct = seg.value / donutTotal
    const dash = pct * circ
    const arc = { ...seg, dash, gap: circ - dash, offset: donutOffset }
    donutOffset += dash
    return arc
  })

  // Period trend bars
  const maxPeriodTotal = Math.max(1, ...periodTrends.map((p) => p.total))

  // Selected employee detail
  const empDetail = selectedEmployee ? employeeTrends.find((e) => e.employeeId === selectedEmployee) : null

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Reviews', value: stats.totalReviews, icon: <BarChart3 className="w-4 h-4" />, color: 'text-indigo-600 bg-indigo-50' },
          { label: 'Verbeterd', value: stats.improved, icon: <TrendingUp className="w-4 h-4" />, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Level Ups', value: stats.levelUps, icon: <ArrowUp className="w-4 h-4" />, color: 'text-violet-600 bg-violet-50' },
          { label: 'Level Downs', value: stats.levelDowns, icon: <ArrowDown className="w-4 h-4" />, color: 'text-red-600 bg-red-50' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className={`w-8 h-8 rounded-lg ${kpi.color} flex items-center justify-center mb-2`}>
              {kpi.icon}
            </div>
            <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Verdeling deze periode</h3>
          <div className="flex items-center gap-6">
            <svg width="120" height="120" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={r} fill="none" stroke="#f3f4f6" strokeWidth="12" />
              {arcs.map((arc, i) => (
                <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={arc.color}
                  strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={`${arc.dash} ${arc.gap}`}
                  strokeDashoffset={-arc.offset}
                  transform="rotate(-90 50 50)"
                  style={{ transition: 'all 0.6s ease' }} />
              ))}
              <text x="50" y="46" textAnchor="middle" className="text-[18px] font-bold" fill="#111827">
                {stats.totalReviews}
              </text>
              <text x="50" y="60" textAnchor="middle" className="text-[10px]" fill="#9ca3af">
                reviews
              </text>
            </svg>
            <div className="space-y-2">
              {donutSegments.map((seg) => (
                <div key={seg.label} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: seg.color }} />
                  <span className="text-sm text-gray-600">{seg.label}</span>
                  <span className="text-sm font-semibold text-gray-900 ml-auto">
                    {stats.totalReviews > 0 ? Math.round((seg.value / stats.totalReviews) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top improvers */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" /> Top Verbeteraars
          </h3>
          {topImprovers.length === 0 ? (
            <p className="text-sm text-gray-400">Nog geen reviews afgerond.</p>
          ) : (
            <div className="space-y-2.5">
              {topImprovers.map((imp, i) => (
                <div key={imp.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-5 tabular-nums">{i + 1}.</span>
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-[10px] font-bold text-white">
                    {imp.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-700 flex-1 truncate">{imp.name}</span>
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{imp.count}x</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Period trend bars */}
      {periodTrends.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Trend per periode</h3>
          <div className="space-y-3">
            {periodTrends.map((p) => (
              <div key={p.period}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600">{p.period}</span>
                  <span className="text-[11px] text-gray-400">{p.total} reviews</span>
                </div>
                <div className="h-5 bg-gray-100 rounded-full overflow-hidden flex">
                  {p.improved > 0 && (
                    <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${(p.improved / maxPeriodTotal) * 100}%` }} />
                  )}
                  {p.same > 0 && (
                    <div className="h-full bg-gray-300 transition-all duration-500" style={{ width: `${(p.same / maxPeriodTotal) * 100}%` }} />
                  )}
                  {p.declined > 0 && (
                    <div className="h-full bg-red-400 transition-all duration-500" style={{ width: `${(p.declined / maxPeriodTotal) * 100}%` }} />
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Verbeterd</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300" /> Gelijk</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Verslechterd</span>
          </div>
        </div>
      )}

      {/* Employee list */}
      {employeeTrends.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" /> Medewerker overzicht
          </h3>
          <div className="space-y-1">
            {employeeTrends.slice(0, 15).map((emp) => {
              const total = emp.improved + emp.same + emp.declined
              const isSelected = selectedEmployee === emp.employeeId
              return (
                <div key={emp.employeeId}>
                  <button
                    onClick={() => setSelectedEmployee(isSelected ? null : emp.employeeId)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[11px] font-bold text-gray-500">
                      {emp.employeeName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{emp.employeeName}</p>
                      <p className="text-[11px] text-gray-400">{emp.department ?? 'Geen afdeling'} &#8226; {total} reviews</p>
                    </div>
                    {/* Mini bars */}
                    <div className="flex items-center gap-1">
                      {emp.improved > 0 && <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">+{emp.improved}</span>}
                      {emp.declined > 0 && <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">-{emp.declined}</span>}
                    </div>
                    <ChevronRight className={`w-4 h-4 text-gray-300 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                  </button>

                  {/* Detail panel */}
                  <AnimatePresence>
                    {isSelected && empDetail && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pl-14 pr-3 pb-3 space-y-1.5">
                          {empDetail.reviews.slice(0, 8).map((r, ri) => (
                            <div key={ri} className="flex items-center gap-2 text-xs">
                              <span className="text-gray-400 w-16 shrink-0 tabular-nums">
                                {new Date(r.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                              </span>
                              <span className="font-medium text-gray-600 flex-1 truncate">{r.processName}</span>
                              <span className={`font-semibold ${
                                r.verdict === 'improved' ? 'text-emerald-600' : r.verdict === 'declined' ? 'text-red-600' : 'text-gray-400'
                              }`}>
                                {r.verdict === 'improved' ? '↑' : r.verdict === 'declined' ? '↓' : '='}
                              </span>
                              {r.newLevel !== r.previousLevel && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  r.newLevel > r.previousLevel ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  Lv.{r.previousLevel} → {r.newLevel}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Session complete screen ─────────────────────────────────────────────────

function SessionComplete({ reviewed, onRestart }: { reviewed: number; onRestart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <motion.div
        animate={{ rotate: [0, -5, 5, -3, 3, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mb-6 shadow-lg shadow-emerald-200">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
      </motion.div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">Sessie compleet!</h3>
      <p className="text-sm text-gray-500 mb-1">
        Je hebt <span className="font-semibold text-gray-700">{reviewed}</span> skill reviews afgerond.
      </p>
      <p className="text-xs text-gray-400 mb-8">De resultaten zijn verwerkt en de skill matrix is bijgewerkt.</p>
      <button onClick={onRestart}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200">
        <RotateCcw className="w-4 h-4" /> Nieuwe sessie starten
      </button>
    </motion.div>
  )
}

// ── Empty state ─────────────────────────────────────────────────────────────

function EmptyQueue() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Zap className="w-8 h-8 text-gray-300" />
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">Alles up-to-date!</h3>
      <p className="text-sm text-gray-500 max-w-xs">
        Er zijn momenteel geen skills die gereviewd moeten worden. Kom later terug of voeg meer medewerkers toe aan de skill matrix.
      </p>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function SkillReviewView({ initialQueue, initialAnalytics }: Props) {
  const [tab, setTab] = useState<'review' | 'analytics'>('review')
  const [queue, setQueue] = useState(initialQueue)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [reviewedCount, setReviewedCount] = useState(0)
  const [sessionDone, setSessionDone] = useState(false)
  const [levelChange, setLevelChange] = useState<{ direction: 'up' | 'down'; level: number } | null>(null)
  const [analytics, setAnalytics] = useState(initialAnalytics)

  const currentItem = queue[currentIndex]
  const nextItem = queue[currentIndex + 1]

  const handleVerdict = useCallback(async (verdict: Verdict) => {
    if (!currentItem) return

    // Optimistic: advance to next card
    setCurrentIndex((prev) => prev + 1)
    setReviewedCount((prev) => prev + 1)

    // Submit to server
    const result = await submitReviewAction(currentItem.employeeId, currentItem.processId, verdict)
    if (result.ok && result.levelChanged) {
      const direction = result.newLevel > currentItem.currentLevel ? 'up' : 'down'
      setLevelChange({ direction, level: result.newLevel })
      setTimeout(() => setLevelChange(null), 3000)
    }

    // Check if session is done
    if (currentIndex + 1 >= queue.length) {
      setSessionDone(true)
    }
  }, [currentItem, currentIndex, queue.length])

  const handleRestart = useCallback(async () => {
    const newQueue = await getReviewQueue(10)
    setQueue(newQueue)
    setCurrentIndex(0)
    setReviewedCount(0)
    setSessionDone(false)
  }, [])

  // Progress indicator
  const progress = useMemo(() => {
    if (queue.length === 0) return 0
    return Math.round((reviewedCount / queue.length) * 100)
  }, [reviewedCount, queue.length])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-5 border-b border-[#E6E8F0]">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1">Workforce</p>
        <h1 className="text-[22px] font-bold text-gray-900 leading-tight">Skill Reviews</h1>
        <p className="mt-1 text-sm text-gray-500">Review skills van medewerkers en houd de skill matrix up-to-date.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('review')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === 'review' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Zap className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
          Review ({queue.length - currentIndex > 0 ? queue.length - currentIndex : 0})
        </button>
        <button onClick={() => setTab('analytics')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === 'analytics' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <BarChart3 className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
          Analytics
        </button>
      </div>

      {tab === 'review' ? (
        <div className="flex flex-col items-center">
          {/* Progress bar */}
          {queue.length > 0 && !sessionDone && (
            <div className="w-full max-w-sm mb-6">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium text-gray-400">{reviewedCount} / {queue.length} gereviewd</span>
                <span className="text-[11px] font-semibold text-indigo-600">{progress}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                />
              </div>
            </div>
          )}

          {/* Card stack */}
          {sessionDone ? (
            <SessionComplete reviewed={reviewedCount} onRestart={handleRestart} />
          ) : queue.length === 0 ? (
            <EmptyQueue />
          ) : (
            <div className="relative w-full max-w-sm h-[520px]">
              <AnimatePresence>
                {nextItem && (
                  <SwipeCard
                    key={`${nextItem.employeeId}-${nextItem.processId}-next`}
                    item={nextItem}
                    onVerdict={() => {}}
                    isTop={false}
                  />
                )}
                {currentItem && (
                  <SwipeCard
                    key={`${currentItem.employeeId}-${currentItem.processId}`}
                    item={currentItem}
                    onVerdict={handleVerdict}
                    isTop={true}
                  />
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      ) : (
        <AnalyticsDashboard
          stats={analytics.currentPeriod}
          periodTrends={analytics.periodTrends}
          employeeTrends={analytics.employeeTrends}
          topImprovers={analytics.topImprovers}
        />
      )}

      {/* Level change toast */}
      <AnimatePresence>
        {levelChange && <LevelChangeToast direction={levelChange.direction} level={levelChange.level} />}
      </AnimatePresence>
    </div>
  )
}
