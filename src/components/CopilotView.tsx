'use client'

import { useState, useTransition } from 'react'
import { motion } from 'framer-motion'
import type { HealthScore } from '@/lib/copilot'
import { acceptAdviceAction, declineAdviceAction } from '@/app/copilot/actions'
import { BorderBeam } from '@/components/ui/border-beam'
import CopilotBar from '@/components/CopilotBar'

// ── Types ────────────────────────────────────────────────────────────────────

interface AdviceRecord {
  id: string
  type: string
  priority: number
  title: string
  description: string
  action: string | null
  estimatedSavings: number | null
  status: string
  departmentName: string | null
  createdAt: Date
  respondedAt: Date | null
}

interface Stats {
  total: number
  accepted: number
  completed: number
  declined: number
  followRate: number
  estimatedSavings: number
  actualSavings: number
  missedSavings: number
}

interface Props {
  health: HealthScore
  adviceRecords: AdviceRecord[]
  stats: Stats
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Actief', color: 'bg-blue-100 text-blue-700' },
  seen: { label: 'Gezien', color: 'bg-gray-100 text-gray-600' },
  accepted: { label: 'Geaccepteerd', color: 'bg-emerald-100 text-emerald-700' },
  declined: { label: 'Afgewezen', color: 'bg-red-100 text-red-600' },
  completed: { label: 'Voltooid', color: 'bg-emerald-100 text-emerald-700' },
  expired: { label: 'Verlopen', color: 'bg-gray-100 text-gray-400' },
}

const LEVEL_COLORS = {
  critical: { ring: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
  warning: { ring: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
  good: { ring: '#22C55E', bg: 'rgba(34,197,94,0.08)' },
  excellent: { ring: '#22C55E', bg: 'rgba(34,197,94,0.08)' },
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CopilotView({ health, adviceRecords, stats }: Props) {
  const [tab, setTab] = useState<'insights' | 'history' | 'analytics'>('insights')
  const levelConfig = LEVEL_COLORS[health.level]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 pb-5 border-b border-[#E6E8F0]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1">Intelligence</p>
          <h1 className="text-[22px] font-bold text-gray-900 leading-tight">Copilot</h1>
          <p className="mt-1 text-sm text-gray-500">Operationele inzichten en besparingsadvies.</p>
        </div>
      </div>

      {/* Health score + KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Health gauge */}
        <div className="relative rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col items-center">
          <BorderBeam size={120} duration={10} colorFrom={levelConfig.ring} colorTo="#4F6BFF" borderWidth={1.5} />
          <div className="relative w-24 h-24 mb-3">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F3F4F6" strokeWidth="2.5" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke={levelConfig.ring} strokeWidth="2.5" strokeLinecap="round"
                strokeDasharray={`${health.score} 100`} className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-gray-900 tabular-nums">{health.score}</span>
              <span className="text-[9px] text-gray-400 uppercase font-semibold">Health</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 text-center">{health.summary}</p>
        </div>

        {/* KPIs */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold text-[#4F6BFF] tabular-nums">{stats.followRate}%</div>
          <div className="text-[11px] text-gray-400 font-medium mt-0.5">Opvolgingsgraad</div>
          <div className="text-[10px] text-gray-300 mt-1">{stats.accepted + stats.completed} van {stats.total} adviezen</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold text-emerald-600 tabular-nums">&euro;{Math.round(stats.estimatedSavings)}</div>
          <div className="text-[11px] text-gray-400 font-medium mt-0.5">Geschatte besparing/mnd</div>
          {stats.actualSavings > 0 && <div className="text-[10px] text-emerald-500 mt-1">Gerealiseerd: &euro;{Math.round(stats.actualSavings)}</div>}
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50/30 p-4">
          <div className="text-2xl font-bold text-red-500 tabular-nums">&euro;{Math.round(stats.missedSavings)}</div>
          <div className="text-[11px] text-gray-400 font-medium mt-0.5">Gemiste besparing</div>
          <div className="text-[10px] text-red-400 mt-1">{stats.declined} afgewezen adviezen</div>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-0.5 bg-gray-100 rounded-xl p-0.5 w-fit">
        {(['insights', 'history', 'analytics'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={['px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
              tab === t ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}>
            {t === 'insights' ? 'Actuele inzichten' : t === 'history' ? 'Advieshistorie' : 'Analytics'}
          </button>
        ))}
      </div>

      {/* Insights tab */}
      {tab === 'insights' && (
        <div className="space-y-4">
          {health.insights.length === 0 ? (
            <div className="text-center py-16">
              <span className="text-3xl block mb-3">🎉</span>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Geen aandachtspunten</h3>
              <p className="text-[13px] text-gray-500">Alles ziet er goed uit. De Copilot houdt het in de gaten.</p>
            </div>
          ) : (
            <CopilotBar insights={health.insights} maxVisible={10} />
          )}
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div className="space-y-2">
          {adviceRecords.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Nog geen advieshistorie.</p>
          ) : (
            adviceRecords.map((advice) => (
              <AdviceRow key={advice.id} advice={advice} />
            ))
          )}
        </div>
      )}

      {/* Analytics tab */}
      {tab === 'analytics' && (
        <div className="space-y-5">
          {/* By type breakdown */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">Per type</h3>
            <div className="space-y-3">
              {[
                { type: 'cost_saving', label: 'Kostenbesparing', icon: '💰' },
                { type: 'risk_warning', label: 'Risicowaarschuwing', icon: '⚠️' },
                { type: 'training', label: 'Training', icon: '📚' },
                { type: 'staffing', label: 'Bezetting', icon: '👥' },
                { type: 'efficiency', label: 'Efficiëntie', icon: '⚡' },
                { type: 'compliance', label: 'Compliance', icon: '⚖️' },
              ].map((t) => {
                const count = adviceRecords.filter((a) => a.type === t.type).length
                const accepted = adviceRecords.filter((a) => a.type === t.type && (a.status === 'accepted' || a.status === 'completed')).length
                const rate = count > 0 ? Math.round((accepted / count) * 100) : 0
                if (count === 0) return null
                return (
                  <div key={t.type} className="flex items-center gap-3">
                    <span className="text-sm shrink-0">{t.icon}</span>
                    <span className="text-sm text-gray-700 w-32 shrink-0">{t.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-[#4F6BFF] transition-all duration-500" style={{ width: `${rate}%` }} />
                    </div>
                    <span className="text-xs font-bold tabular-nums text-gray-500 w-16 text-right">{rate}% ({accepted}/{count})</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* By department */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">Per afdeling</h3>
            {(() => {
              const depts = new Map<string, { total: number; accepted: number; savings: number }>()
              for (const a of adviceRecords) {
                const name = a.departmentName ?? 'Organisatie-breed'
                const entry = depts.get(name) ?? { total: 0, accepted: 0, savings: 0 }
                entry.total++
                if (a.status === 'accepted' || a.status === 'completed') {
                  entry.accepted++
                  entry.savings += a.estimatedSavings ?? 0
                }
                depts.set(name, entry)
              }
              return (
                <div className="space-y-3">
                  {Array.from(depts.entries()).map(([name, data]) => {
                    const rate = data.total > 0 ? Math.round((data.accepted / data.total) * 100) : 0
                    return (
                      <div key={name} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 w-32 truncate shrink-0">{name}</span>
                        <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${rate >= 70 ? 'bg-emerald-400' : rate >= 40 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${rate}%` }} />
                        </div>
                        <span className="text-xs font-bold tabular-nums text-gray-500 w-12 text-right">{rate}%</span>
                        {data.savings > 0 && <span className="text-[10px] text-emerald-600 font-medium w-20 text-right">&euro;{Math.round(data.savings)}/m</span>}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Advice row ───────────────────────────────────────────────────────────────

function AdviceRow({ advice }: { advice: AdviceRecord }) {
  const [isPending, startTransition] = useTransition()
  const statusInfo = STATUS_LABELS[advice.status] ?? STATUS_LABELS.active

  function handleAccept() { startTransition(async () => { await acceptAdviceAction(advice.id) }) }
  function handleDecline() { startTransition(async () => { await declineAdviceAction(advice.id) }) }

  return (
    <motion.div layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-shadow">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{advice.title}</span>
          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusInfo.color}`}>{statusInfo.label}</span>
          {advice.departmentName && <span className="text-[10px] text-gray-400">{advice.departmentName}</span>}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{advice.description}</p>
        {advice.estimatedSavings && advice.estimatedSavings > 0 && (
          <p className="text-[10px] font-bold text-emerald-600 mt-1">&euro;{Math.round(advice.estimatedSavings)}/maand besparing</p>
        )}
      </div>
      {(advice.status === 'active' || advice.status === 'seen') && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={handleAccept} disabled={isPending} title="Accepteren"
            className="flex items-center justify-center w-7 h-7 rounded-lg text-emerald-500 hover:bg-emerald-50 transition-colors disabled:opacity-40">
            <svg className="w-4 h-4" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button onClick={handleDecline} disabled={isPending} title="Afwijzen"
            className="flex items-center justify-center w-7 h-7 rounded-lg text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40">
            <svg className="w-4 h-4" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>
      )}
    </motion.div>
  )
}
