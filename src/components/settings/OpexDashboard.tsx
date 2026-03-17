'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CostBreakdown } from '@/lib/opex'
import type { HealthScore } from '@/lib/opex-health'
import type { EconomicsReport } from '@/lib/opex-economics'
import type { BenchmarkResult } from '@/lib/opex-benchmarks'
import type { Advisory, ExecutiveBriefing } from '@/lib/opex-advisor'
import type { ScenarioComparison } from '@/lib/opex-scenarios'
import { BorderBeam } from '@/components/ui/border-beam'
import AnimatedCounter from '@/components/planning/AnimatedCounter'

// ── Types ────────────────────────────────────────────────────────────────────

interface TrendPoint {
  label: string
  totalCost: number
  internalCost: number
  tempCost: number
  overtimeCost: number
}

interface Props {
  current: CostBreakdown
  previous: CostBreakdown
  trend?: TrendPoint[]
  health: HealthScore
  economics: EconomicsReport
  benchmarks: BenchmarkResult[]
  advisories: Advisory[]
  briefing: ExecutiveBriefing
  scenarios: ScenarioComparison
}

type TabId = 'overview' | 'economics' | 'benchmark' | 'scenarios'

// ── Helpers ──────────────────────────────────────────────────────────────────

function delta(curr: number, prev: number): { pct: number; dir: 'up' | 'down' | 'flat' } {
  if (prev === 0) return { pct: 0, dir: 'flat' }
  const pct = Math.round(((curr - prev) / prev) * 100)
  return { pct: Math.abs(pct), dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' }
}

function DeltaBadge({ curr, prev, inverted = false }: { curr: number; prev: number; inverted?: boolean }) {
  const d = delta(curr, prev)
  if (d.dir === 'flat') return null
  const isGood = inverted ? d.dir === 'up' : d.dir === 'down'
  return (
    <span className={`text-[10px] font-bold ${isGood ? 'text-emerald-600' : 'text-red-500'}`}>
      {d.dir === 'up' ? '▲' : '▼'} {d.pct}%
    </span>
  )
}

const RATING_COLORS = {
  excellent: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', bar: 'bg-emerald-500' },
  good: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', bar: 'bg-blue-500' },
  average: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', bar: 'bg-amber-500' },
  'below-average': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', bar: 'bg-orange-500' },
  critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', bar: 'bg-red-500' },
} as const

const HEALTH_COLORS = {
  excellent: 'text-emerald-500',
  good: 'text-blue-500',
  warning: 'text-amber-500',
  critical: 'text-red-500',
}

const PRIORITY_STYLES = {
  high: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-500', label: 'Hoog' },
  medium: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-500', label: 'Midden' },
  low: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-500', label: 'Laag' },
}

// ── Component ────────────────────────────────────────────────────────────────

export default function OpexDashboard({
  current, previous, trend = [], health, economics, benchmarks, advisories, briefing, scenarios,
}: Props) {
  const [tab, setTab] = useState<TabId>('overview')

  return (
    <div className="space-y-6">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1">Intelligence</p>
          <h1 className="text-[22px] font-bold text-gray-900 leading-tight">OPEX Command Center</h1>
          <p className="mt-1 text-sm text-gray-500">Econometrische analyse, benchmarking en strategisch advies.</p>
        </div>
        <div className="flex gap-0.5 bg-gray-100 rounded-xl p-0.5">
          {([
            { id: 'overview' as TabId, label: 'Overzicht' },
            { id: 'economics' as TabId, label: 'Econometrie' },
            { id: 'benchmark' as TabId, label: 'Benchmark' },
            { id: 'scenarios' as TabId, label: 'Scenario\'s' },
          ]).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={['px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                tab === t.id ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ LAYER 1: EXECUTIVE BRIEFING ═══ */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="relative rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50/50 p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
        <BorderBeam size={200} duration={12} colorFrom="#4F6BFF" colorTo="#22C55E" borderWidth={1.5} />
        <div className="flex items-start gap-6">
          {/* Health gauge */}
          <div className="shrink-0">
            <div className="relative w-24 h-24">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#F3F4F6" strokeWidth="3" />
                <motion.path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={health.score >= 80 ? '#22C55E' : health.score >= 60 ? '#F59E0B' : '#EF4444'}
                  strokeWidth="3" strokeLinecap="round"
                  initial={{ strokeDasharray: '0, 100' }}
                  animate={{ strokeDasharray: `${health.score}, 100` }}
                  transition={{ duration: 1.2, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-gray-900"><AnimatedCounter value={health.score} /></span>
                <span className="text-[9px] text-gray-400 font-medium">{health.grade}</span>
              </div>
            </div>
          </div>
          {/* Briefing text */}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-900 leading-snug">{briefing.headline}</h2>
            <p className="text-xs text-gray-500 mt-1">{briefing.subheadline}</p>
            <div className="flex items-center gap-4 mt-3">
              {briefing.keyMetrics.map((m) => (
                <div key={m.label} className="text-center">
                  <div className={`text-sm font-bold tabular-nums ${m.good ? 'text-gray-900' : 'text-red-500'}`}>{m.value}</div>
                  <div className="text-[9px] text-gray-400">{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══ LAYER 2: STRATEGIC KPI STRIP ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Totale kosten', value: current.totalCost, prefix: '€', prev: previous.totalCost, color: 'border-l-[#4F6BFF]' },
          { label: 'Intern', value: current.internalCost, prefix: '€', prev: previous.internalCost, color: 'border-l-blue-500' },
          { label: 'Uitzendkrachten', value: current.tempCost, prefix: '€', prev: previous.tempCost, color: 'border-l-orange-400' },
          { label: 'Overuren', value: current.overtimeCost, prefix: '€', prev: previous.overtimeCost, color: 'border-l-amber-500' },
          { label: 'Gem. kosten/uur', value: current.avgCostPerHour, prefix: '€', prev: previous.avgCostPerHour, color: 'border-l-gray-400', isDecimal: true },
          { label: 'Besparingspotentieel', value: current.potentialSavings, prefix: '€', prev: 0, color: 'border-l-emerald-500', hideCompare: true },
        ].map((kpi, i) => (
          <motion.div key={kpi.label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className={`rounded-xl border border-gray-100 border-l-[3px] ${kpi.color} bg-white p-4 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200`}
          >
            <div className="text-xl font-bold text-gray-900 tabular-nums">
              {kpi.prefix}<AnimatedCounter value={kpi.isDecimal ? Math.round(kpi.value * 100) : Math.round(kpi.value)} suffix={kpi.isDecimal ? '' : ''} />
              {kpi.isDecimal && <span className="text-sm">.{String(Math.round(kpi.value * 100) % 100).padStart(2, '0')}</span>}
            </div>
            <div className="text-[10px] text-gray-400 font-medium mt-0.5">{kpi.label}</div>
            {!kpi.hideCompare && <DeltaBadge curr={kpi.value} prev={kpi.prev} />}
          </motion.div>
        ))}
      </div>

      {/* ═══ TAB CONTENT ═══ */}
      <AnimatePresence mode="wait">
        {tab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-6">
            {/* Health factors breakdown */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Health Score Decompositie</p>
              <div className="space-y-3">
                {health.factors.map((f) => (
                  <div key={f.id} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 w-36 shrink-0 truncate">{f.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <motion.div className={`h-full rounded-full bar-fill-anim ${f.status === 'excellent' ? 'bg-emerald-500' : f.status === 'good' ? 'bg-blue-500' : f.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${f.score}%` }} />
                    </div>
                    <span className={`text-xs font-bold tabular-nums w-10 text-right ${HEALTH_COLORS[f.status]}`}>{f.score}</span>
                    <span className="text-[9px] text-gray-400 w-6 text-right">{Math.round(f.weight * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Advisory panel */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Strategisch Advies</p>
                <span className="text-[10px] text-gray-300">Gegenereerd op basis van uw data</span>
              </div>
              <div className="space-y-3">
                {advisories.slice(0, 5).map((a, i) => {
                  const style = PRIORITY_STYLES[a.priority]
                  return (
                    <motion.div key={a.id}
                      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.06 }}
                      className={`rounded-xl border ${style.border} ${style.bg} p-4`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${style.bg}`}>
                          <svg className={`w-3.5 h-3.5 ${style.icon}`} viewBox="0 0 14 14" fill="none">
                            <path d="M7 1l1.5 4.5H13l-3.5 2.5 1.5 4.5L7 10l-4 2.5 1.5-4.5L1 5.5h4.5L7 1z" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="0.8" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-bold text-gray-900">{a.title}</span>
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${style.border} border`}>{style.label}</span>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed">{a.detail}</p>
                          <div className="flex items-center gap-4 mt-2 text-[10px]">
                            <span className="font-bold text-emerald-600">€{a.estimatedMonthlySaving.toLocaleString('nl-NL')}/mnd</span>
                            <span className="text-gray-400">{a.timeframe}</span>
                            <span className="text-gray-300">Vertrouwen: {a.confidence}</span>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1.5 italic">{a.economicReasoning}</p>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* Cost trend */}
            <CostTrendChart trend={trend} />

            {/* Cost breakdowns */}
            <CostBreakdownPanels current={current} />
          </motion.div>
        )}

        {tab === 'economics' && (
          <motion.div key="economics" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-6">
            {/* Economic analysis narrative */}
            <div className="relative rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <BorderBeam size={180} duration={15} colorFrom="#8B5CF6" colorTo="#EC4899" borderWidth={1} />
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-violet-600" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M3 13V9M8 13V5M13 13V3" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Economische Analyse</p>
                  <p className="text-[10px] text-gray-400">Econometrische modellen toegepast op uw operationele data</p>
                </div>
              </div>
              <div className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-line">{briefing.economicAnalysis}</div>
            </div>

            {/* Workforce Gap */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Workforce Gap (Okun-model)</p>
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative w-20 h-20">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#F3F4F6" strokeWidth="3" />
                      <motion.path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none"
                        stroke={economics.workforceGap.actualOutput >= 90 ? '#22C55E' : economics.workforceGap.actualOutput >= 75 ? '#F59E0B' : '#EF4444'}
                        strokeWidth="3" strokeLinecap="round"
                        initial={{ strokeDasharray: '0, 100' }}
                        animate={{ strokeDasharray: `${Math.round(economics.workforceGap.actualOutput)}, 100` }}
                        transition={{ duration: 1, delay: 0.2 }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-bold tabular-nums">{economics.workforceGap.actualOutput}%</span>
                      <span className="text-[8px] text-gray-400">potentieel</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {economics.workforceGap.gapDrivers.map((d) => (
                      <div key={d.driver} className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 flex-1">{d.driver}</span>
                        <span className="text-xs font-bold text-red-500 tabular-nums">-{d.impact}pp</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">{economics.workforceGap.narrative}</p>
              </div>

              {/* Gini coefficient */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Werkverdeling (Gini-coëfficiënt)</p>
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold tabular-nums text-gray-900">{economics.gini.coefficient.toFixed(3)}</div>
                    <div className={`text-[10px] font-bold mt-1 ${economics.gini.status === 'healthy' ? 'text-emerald-600' : economics.gini.status === 'moderate' ? 'text-amber-600' : 'text-red-600'}`}>
                      {economics.gini.status === 'healthy' ? 'Gezond' : economics.gini.status === 'moderate' ? 'Matig' : economics.gini.status === 'skewed' ? 'Scheef' : 'Kritiek'}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>Gelijkmatig</span><span>Ongelijk</span></div>
                    <div className="h-2 rounded-full bg-gradient-to-r from-emerald-200 via-amber-200 to-red-200 relative">
                      <motion.div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-gray-900 border-2 border-white shadow"
                        initial={{ left: '0%' }} animate={{ left: `${Math.min(95, economics.gini.coefficient * 200)}%` }}
                        transition={{ duration: 0.8, delay: 0.3 }} />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2">Top 20% draagt <span className="font-bold">{economics.gini.topQuintileShare}%</span> van de uren</p>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">{economics.gini.interpretation}</p>
              </div>
            </div>

            {/* Utilization + Overtime */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Arbeidsbenutting</p>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center rounded-lg bg-red-50 px-2 py-3">
                    <div className="text-lg font-bold text-red-600">{economics.utilization.underUtilized}</div>
                    <div className="text-[9px] text-red-500">&lt;75%</div>
                  </div>
                  <div className="text-center rounded-lg bg-emerald-50 px-2 py-3">
                    <div className="text-lg font-bold text-emerald-600">{economics.utilization.optimal}</div>
                    <div className="text-[9px] text-emerald-500">75-105%</div>
                  </div>
                  <div className="text-center rounded-lg bg-amber-50 px-2 py-3">
                    <div className="text-lg font-bold text-amber-600">{economics.utilization.overUtilized}</div>
                    <div className="text-[9px] text-amber-500">&gt;105%</div>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">{economics.utilization.narrative}</p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Overuren Analyse</p>
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Huidig</span>
                    <span className="text-sm font-bold tabular-nums">{(economics.overtime.currentRatio * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Optimaal</span>
                    <span className="text-sm font-bold tabular-nums text-emerald-600">{(economics.overtime.optimalRatio * 100).toFixed(1)}%</span>
                  </div>
                  {economics.overtime.excessCost > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Excess kosten</span>
                      <span className="text-sm font-bold tabular-nums text-red-500">€{economics.overtime.excessCost.toLocaleString('nl-NL')}</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">{economics.overtime.narrative}</p>
              </div>
            </div>

            {/* Temp conversion NPV */}
            {economics.tempConversion.candidates.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Temp-naar-Intern Conversie — NPV Analyse</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 text-[10px] font-semibold text-gray-400 uppercase">Naam</th>
                        <th className="text-right py-2 text-[10px] font-semibold text-gray-400 uppercase">Uren/wk</th>
                        <th className="text-right py-2 text-[10px] font-semibold text-gray-400 uppercase">Premie/wk</th>
                        <th className="text-right py-2 text-[10px] font-semibold text-gray-400 uppercase">Break-even</th>
                        <th className="text-right py-2 text-[10px] font-semibold text-gray-400 uppercase">NPV 12m</th>
                        <th className="text-right py-2 text-[10px] font-semibold text-gray-400 uppercase">ROI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {economics.tempConversion.candidates.slice(0, 8).map((c) => (
                        <tr key={c.employeeId} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="py-2 font-medium text-gray-900">{c.name}</td>
                          <td className="py-2 text-right tabular-nums text-gray-600">{c.weeklyHours}h</td>
                          <td className="py-2 text-right tabular-nums text-orange-600">€{c.weeklyPremium.toFixed(0)}</td>
                          <td className="py-2 text-right tabular-nums text-gray-600">{c.breakEvenWeeks}w</td>
                          <td className={`py-2 text-right tabular-nums font-bold ${c.npv12Month > 0 ? 'text-emerald-600' : 'text-red-500'}`}>€{c.npv12Month.toLocaleString('nl-NL')}</td>
                          <td className="py-2 text-right tabular-nums text-gray-500">{c.roi > 0 ? `${(c.roi * 100).toFixed(0)}%` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">{economics.tempConversion.narrative}</p>
              </div>
            )}
          </motion.div>
        )}

        {tab === 'benchmark' && (
          <motion.div key="benchmark" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-6">
            {/* Benchmark summary */}
            {briefing.benchmarkSummary && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Samenvatting</p>
                <p className="text-sm text-gray-700">{briefing.benchmarkSummary}</p>
              </div>
            )}

            {/* Benchmark positioning cards */}
            <div className="space-y-3">
              {benchmarks.map((b, i) => {
                const colors = RATING_COLORS[b.rating]
                const bm = b.benchmark
                return (
                  <motion.div key={b.benchmark.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.04 }}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{bm.label}</span>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
                          {b.rating === 'excellent' ? 'Excellent' : b.rating === 'good' ? 'Goed' : b.rating === 'average' ? 'Gemiddeld' : b.rating === 'below-average' ? 'Ondergemiddeld' : 'Kritiek'}
                        </span>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-gray-900">
                        {bm.unit === '€' ? '€' : ''}{typeof b.actual === 'number' && !isNaN(b.actual) ? b.actual.toLocaleString('nl-NL', { maximumFractionDigits: 1 }) : '—'}{bm.unit === '%' ? '%' : bm.unit === '€/uur' ? '/uur' : ''}
                      </span>
                    </div>
                    {/* Percentile bar */}
                    <div className="relative h-6 rounded-full bg-gray-100 mb-2">
                      {/* P25/P50/P75/P90 markers */}
                      {[
                        { pct: 25, label: 'P25', val: bm.p25 },
                        { pct: 50, label: 'P50', val: bm.p50 },
                        { pct: 75, label: 'P75', val: bm.p75 },
                        { pct: 90, label: 'P90', val: bm.p90 },
                      ].map((m) => (
                        <div key={m.label} className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: `${m.pct}%` }}>
                          <div className="w-px h-full bg-gray-300" />
                        </div>
                      ))}
                      {/* Actual position */}
                      <motion.div className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full ${colors.bar} border-2 border-white shadow-md`}
                        initial={{ left: '0%' }}
                        animate={{ left: `${Math.min(98, Math.max(2, b.percentile))}%` }}
                        transition={{ duration: 0.8, delay: 0.1 + i * 0.04 }} />
                    </div>
                    <div className="flex justify-between text-[9px] text-gray-400 mb-2">
                      <span>P25: {bm.p25}{bm.unit === '%' ? '%' : ''}</span>
                      <span>P50: {bm.p50}{bm.unit === '%' ? '%' : ''}</span>
                      <span>P75: {bm.p75}{bm.unit === '%' ? '%' : ''}</span>
                      <span>P90: {bm.p90}{bm.unit === '%' ? '%' : ''}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">{b.narrative}</p>
                    <p className="text-[9px] text-gray-300 mt-1">Bron: {bm.source}</p>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}

        {tab === 'scenarios' && (
          <motion.div key="scenarios" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-6">
            {/* Scenario comparison header */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{scenarios.baseline.name}</p>
                <div className="text-2xl font-bold text-gray-900 tabular-nums">€{scenarios.baseline.totalCost.toLocaleString('nl-NL')}</div>
                <p className="text-[10px] text-gray-400 mt-0.5">Totaal over 12 weken (gem. €{scenarios.baseline.avgWeeklyCost.toLocaleString('nl-NL')}/week)</p>
                <p className="text-xs text-gray-500 mt-2">{scenarios.baseline.description}</p>
              </div>
              <div className="relative rounded-2xl border border-emerald-200 bg-emerald-50/30 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                <BorderBeam size={120} duration={10} colorFrom="#22C55E" colorTo="#10B981" borderWidth={1.5} />
                <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider mb-2">{scenarios.optimized.name}</p>
                <div className="text-2xl font-bold text-emerald-700 tabular-nums">€{scenarios.optimized.totalCost.toLocaleString('nl-NL')}</div>
                <p className="text-[10px] text-emerald-500 mt-0.5">
                  Besparing: €{scenarios.totalSavings.toLocaleString('nl-NL')} (gem. €{scenarios.weeklyAvgSavings.toLocaleString('nl-NL')}/week)
                </p>
                <p className="text-xs text-gray-500 mt-2">{scenarios.optimized.description}</p>
              </div>
            </div>

            {/* Projection chart */}
            <ScenarioChart scenarios={scenarios} />

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <p className="text-[13px] text-gray-700 leading-relaxed">{scenarios.narrative}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ScenarioChart({ scenarios }: { scenarios: ScenarioComparison }) {
  const all = [...scenarios.baseline.weeks, ...scenarios.optimized.weeks]
  const maxCost = Math.max(1, ...all.map((w) => w.upper))
  const W = 600, H = 180, PAD_L = 50, PAD_R = 10, PAD_T = 10, PAD_B = 24
  const chartW = W - PAD_L - PAD_R, chartH = H - PAD_T - PAD_B
  const n = scenarios.baseline.weeks.length
  const xPos = (i: number) => PAD_L + (i / Math.max(1, n - 1)) * chartW
  const yPos = (v: number) => PAD_T + chartH - (v / maxCost) * chartH

  const baselinePath = scenarios.baseline.weeks.map((w, i) => `${i === 0 ? 'M' : 'L'}${xPos(i).toFixed(1)},${yPos(w.cost).toFixed(1)}`).join(' ')
  const optimizedPath = scenarios.optimized.weeks.map((w, i) => `${i === 0 ? 'M' : 'L'}${xPos(i).toFixed(1)},${yPos(w.cost).toFixed(1)}`).join(' ')

  // Confidence band for optimized
  const bandPath =
    scenarios.optimized.weeks.map((w, i) => `${i === 0 ? 'M' : 'L'}${xPos(i).toFixed(1)},${yPos(w.upper).toFixed(1)}`).join(' ') +
    scenarios.optimized.weeks.map((w, i) => `L${xPos(n - 1 - i).toFixed(1)},${yPos(scenarios.optimized.weeks[n - 1 - i].lower).toFixed(1)}`).join(' ') +
    ' Z'

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">12-Weken Projectie</p>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-4 h-[2px] bg-gray-400 rounded" />Status Quo</span>
          <span className="flex items-center gap-1"><span className="w-4 h-[2px] bg-emerald-500 rounded" />Geoptimaliseerd</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }}>
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <g key={pct}>
            <line x1={PAD_L} y1={yPos(pct * maxCost)} x2={W - PAD_R} y2={yPos(pct * maxCost)} stroke="#f3f4f6" strokeWidth="1" />
            <text x={PAD_L - 6} y={yPos(pct * maxCost) + 3} textAnchor="end" style={{ fontSize: 8 }} className="fill-gray-300">
              €{Math.round(pct * maxCost)}
            </text>
          </g>
        ))}
        {/* Confidence band */}
        <path d={bandPath} fill="#22C55E" opacity="0.08" />
        {/* Lines */}
        <path d={baselinePath} fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
        <path d={optimizedPath} fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" />
        {/* Dots */}
        {scenarios.optimized.weeks.map((w, i) => (
          <circle key={i} cx={xPos(i)} cy={yPos(w.cost)} r="3" fill="#22C55E" stroke="white" strokeWidth="1.5" />
        ))}
        {/* Week labels */}
        {scenarios.baseline.weeks.map((w, i) => (
          <text key={i} x={xPos(i)} y={H - 4} textAnchor="middle" style={{ fontSize: 8 }} className="fill-gray-400">{w.label}</text>
        ))}
      </svg>
    </div>
  )
}

function CostTrendChart({ trend }: { trend: TrendPoint[] }) {
  if (trend.length === 0) return null
  const maxCost = Math.max(1, ...trend.map((t) => t.totalCost))
  const W = 600, H = 140, PAD_L = 50, PAD_R = 10, PAD_T = 10, PAD_B = 24
  const chartW = W - PAD_L - PAD_R, chartH = H - PAD_T - PAD_B
  const xPos = (i: number) => PAD_L + (i / Math.max(1, trend.length - 1)) * chartW
  const yPos = (v: number) => PAD_T + chartH - (v / maxCost) * chartH

  const totalLine = trend.map((t, i) => `${i === 0 ? 'M' : 'L'}${xPos(i).toFixed(1)},${yPos(t.totalCost).toFixed(1)}`).join(' ')
  const areaPath = `${totalLine} L${xPos(trend.length - 1).toFixed(1)},${yPos(0).toFixed(1)} L${xPos(0).toFixed(1)},${yPos(0).toFixed(1)} Z`

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Kostentrend — 6 maanden</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
        <defs>
          <linearGradient id="tgCost" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4F6BFF" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#4F6BFF" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <g key={pct}>
            <line x1={PAD_L} y1={yPos(pct * maxCost)} x2={W - PAD_R} y2={yPos(pct * maxCost)} stroke="#f3f4f6" strokeWidth="1" />
            <text x={PAD_L - 6} y={yPos(pct * maxCost) + 3} textAnchor="end" style={{ fontSize: 8 }} className="fill-gray-300">€{Math.round(pct * maxCost)}</text>
          </g>
        ))}
        <path d={areaPath} fill="url(#tgCost)" />
        <path d={totalLine} fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
        {trend.map((t, i) => (
          <circle key={i} cx={xPos(i)} cy={yPos(t.totalCost)} r="3" fill="#111827" stroke="white" strokeWidth="1.5" />
        ))}
        {trend.map((t, i) => (
          <text key={`l${i}`} x={xPos(i)} y={H - 4} textAnchor="middle" style={{ fontSize: 9, fontWeight: 500 }} className="fill-gray-400">{t.label}</text>
        ))}
      </svg>
    </div>
  )
}

function CostBreakdownPanels({ current }: { current: CostBreakdown }) {
  const maxShift = Math.max(1, ...current.costPerShift.map((s) => s.cost))
  const maxDept = Math.max(1, ...current.costPerDepartment.map((d) => d.cost))

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {current.costPerShift.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Kosten per shift</p>
          <div className="space-y-2.5">
            {current.costPerShift.map((s) => (
              <div key={s.shiftName} className="flex items-center gap-3">
                <span className="text-sm text-gray-700 w-28 truncate shrink-0">{s.shiftName}</span>
                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-[#4F6BFF] bar-fill-anim" style={{ width: `${(s.cost / maxShift) * 100}%` }} />
                </div>
                <span className="text-xs font-bold tabular-nums text-gray-500 w-16 text-right">€{s.cost}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {current.costPerDepartment.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Kosten per afdeling</p>
          <div className="space-y-2.5">
            {current.costPerDepartment.map((d) => (
              <div key={d.departmentName} className="flex items-center gap-3">
                <span className="text-sm text-gray-700 w-28 truncate shrink-0">{d.departmentName}</span>
                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-400 bar-fill-anim" style={{ width: `${(d.cost / maxDept) * 100}%` }} />
                </div>
                <span className="text-xs font-bold tabular-nums text-gray-500 w-16 text-right">€{d.cost}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
