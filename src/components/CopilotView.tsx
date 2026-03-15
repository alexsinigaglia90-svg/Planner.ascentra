'use client'

import { useState, useTransition } from 'react'
import { motion } from 'framer-motion'
import type { HealthScore } from '@/lib/ascentrai'
import { acceptAdviceAction, declineAdviceAction } from '@/app/ascentrai/actions'
import { BorderBeam } from '@/components/ui/border-beam'
import CopilotBar from '@/components/CopilotBar'
import AscentrAIChat from '@/components/AscentrAIChat'

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
  const [tab, setTab] = useState<'chat' | 'dashboard'>('chat')
  const levelConfig = LEVEL_COLORS[health.level]

  return (
    <div className="-m-8">
      {/* Tab bar — minimal, top of page */}
      <div className="flex items-center gap-1 px-8 pt-6 pb-3">
        <div className="flex gap-0.5 bg-gray-100 rounded-xl p-0.5">
          {(['chat', 'dashboard'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={['px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                tab === t ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}>
              {t === 'chat' ? 'AscentrAI' : 'Dashboard'}
            </button>
          ))}
        </div>
      </div>

      {/* Chat — full page */}
      {tab === 'chat' && (
        <div className="h-[calc(100vh-100px)]">
          <AscentrAIChat />
        </div>
      )}

      {/* Dashboard — KPIs, insights, history, analytics */}
      {tab === 'dashboard' && (
        <div className="px-8 pb-8 space-y-6">
          {/* Header */}
          <div className="pb-5 border-b border-[#E6E8F0]">
            <h1 className="text-[22px] font-bold text-gray-900 leading-tight">AscentrAI Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">Operationele inzichten, advieshistorie en ROI.</p>
          </div>

          {/* Health score + KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-2xl font-bold text-[#4F6BFF] tabular-nums">{stats.followRate}%</div>
              <div className="text-[11px] text-gray-400 font-medium mt-0.5">Opvolgingsgraad</div>
              <div className="text-[10px] text-gray-300 mt-1">{stats.accepted + stats.completed} van {stats.total} adviezen</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-2xl font-bold text-emerald-600 tabular-nums">&euro;{Math.round(stats.estimatedSavings)}</div>
              <div className="text-[11px] text-gray-400 font-medium mt-0.5">Geschatte besparing/mnd</div>
            </div>
            <div className="rounded-xl border border-red-100 bg-red-50/30 p-4">
              <div className="text-2xl font-bold text-red-500 tabular-nums">&euro;{Math.round(stats.missedSavings)}</div>
              <div className="text-[11px] text-gray-400 font-medium mt-0.5">Gemiste besparing</div>
            </div>
          </div>

          {/* Insights */}
          {health.insights.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Actuele inzichten</h3>
              <CopilotBar insights={health.insights} maxVisible={5} />
            </div>
          )}

          {/* Advice history */}
          {adviceRecords.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Advieshistorie</h3>
              <div className="space-y-2">
                {adviceRecords.slice(0, 10).map((advice) => (
                  <AdviceRow key={advice.id} advice={advice} />
                ))}
              </div>
            </div>
          )}

          {/* ROI */}
          <div className="relative rounded-2xl border border-gray-200 bg-white p-5 overflow-hidden">
            <BorderBeam size={180} duration={14} colorFrom="#22C55E" colorTo="#4F6BFF" borderWidth={1.5} />
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">ROI van AscentrAI</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600 tabular-nums">&euro;{Math.round(stats.estimatedSavings)}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Geschat/maand</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[#4F6BFF] tabular-nums">&euro;{Math.round(stats.actualSavings)}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Gerealiseerd</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-500 tabular-nums">&euro;{Math.round(stats.missedSavings)}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Gemist</p>
              </div>
            </div>
            <div className="h-3 rounded-full bg-gray-100 overflow-hidden flex">
              {stats.estimatedSavings + stats.missedSavings > 0 && (
                <>
                  <div className="h-full bg-emerald-400" style={{ width: `${(stats.actualSavings / (stats.estimatedSavings + stats.missedSavings)) * 100}%` }} />
                  <div className="h-full bg-[#4F6BFF]" style={{ width: `${((stats.estimatedSavings - stats.actualSavings) / (stats.estimatedSavings + stats.missedSavings)) * 100}%` }} />
                  <div className="h-full bg-red-300" style={{ width: `${(stats.missedSavings / (stats.estimatedSavings + stats.missedSavings)) * 100}%` }} />
                </>
              )}
            </div>
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
        </div>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{advice.description}</p>
        {advice.estimatedSavings && advice.estimatedSavings > 0 && (
          <p className="text-[10px] font-bold text-emerald-600 mt-1">&euro;{Math.round(advice.estimatedSavings)}/maand</p>
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
