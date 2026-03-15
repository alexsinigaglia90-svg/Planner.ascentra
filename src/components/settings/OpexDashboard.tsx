'use client'

import type { CostBreakdown } from '@/lib/opex'
import { BorderBeam } from '@/components/ui/border-beam'

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
}

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
      {d.dir === 'up' ? '↑' : '↓'} {d.pct}%
    </span>
  )
}

export default function OpexDashboard({ current, previous, trend = [] }: Props) {
  const maxShiftCost = Math.max(1, ...current.costPerShift.map((s) => s.cost))
  const maxDeptCost = Math.max(1, ...current.costPerDepartment.map((d) => d.cost))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 pb-5 border-b border-[#E6E8F0]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1">Intelligence</p>
          <h1 className="text-[22px] font-bold text-gray-900 leading-tight">OPEX Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Arbeidskosten analyse en optimalisatie.</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="relative rounded-xl border border-gray-200 bg-white p-4 overflow-hidden">
          <BorderBeam size={80} duration={10} colorFrom="#4F6BFF" colorTo="#22C55E" borderWidth={1.5} />
          <div className="text-xl font-bold text-gray-900 tabular-nums">&euro;{current.totalCost.toLocaleString()}</div>
          <div className="text-[10px] text-gray-400 font-medium mt-0.5">Totale kosten</div>
          <DeltaBadge curr={current.totalCost} prev={previous.totalCost} />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xl font-bold text-blue-600 tabular-nums">&euro;{current.internalCost.toLocaleString()}</div>
          <div className="text-[10px] text-gray-400 font-medium mt-0.5">Intern</div>
          <DeltaBadge curr={current.internalCost} prev={previous.internalCost} />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xl font-bold text-orange-500 tabular-nums">&euro;{current.tempCost.toLocaleString()}</div>
          <div className="text-[10px] text-gray-400 font-medium mt-0.5">Uitzendkrachten</div>
          <DeltaBadge curr={current.tempCost} prev={previous.tempCost} />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xl font-bold text-amber-600 tabular-nums">&euro;{current.overtimeCost.toLocaleString()}</div>
          <div className="text-[10px] text-gray-400 font-medium mt-0.5">Overuren</div>
          <DeltaBadge curr={current.overtimeCost} prev={previous.overtimeCost} />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xl font-bold text-gray-900 tabular-nums">&euro;{current.avgCostPerHour}</div>
          <div className="text-[10px] text-gray-400 font-medium mt-0.5">Gem. kosten/uur</div>
          <DeltaBadge curr={current.avgCostPerHour} prev={previous.avgCostPerHour} />
        </div>
        <div className={`rounded-xl border bg-white p-4 ${current.potentialSavings > 0 ? 'border-emerald-200' : 'border-gray-200'}`}>
          <div className="text-xl font-bold text-emerald-600 tabular-nums">&euro;{current.potentialSavings.toLocaleString()}</div>
          <div className="text-[10px] text-gray-400 font-medium mt-0.5">Besparingspotentieel</div>
        </div>
      </div>

      {/* Cost split visual */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Intern vs Temp donut */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Kostenverdeling</p>
          <div className="flex items-center gap-6">
            <div className="relative w-28 h-28 shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#DBEAFE" strokeWidth="3" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={`${current.totalCost > 0 ? Math.round((current.internalCost / current.totalCost) * 100) : 0} 100`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-gray-900 tabular-nums">{current.totalCost > 0 ? Math.round((current.internalCost / current.totalCost) * 100) : 0}%</span>
                <span className="text-[8px] text-gray-400">intern</span>
              </div>
            </div>
            <div className="space-y-3 flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500" /><span className="text-sm text-gray-700">Intern</span></div>
                <span className="text-sm font-bold tabular-nums">&euro;{current.internalCost.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-400" /><span className="text-sm text-gray-700">Temp</span></div>
                <span className="text-sm font-bold tabular-nums">&euro;{current.tempCost.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-400" /><span className="text-sm text-gray-700">Overuren</span></div>
                <span className="text-sm font-bold tabular-nums">&euro;{current.overtimeCost.toLocaleString()}</span>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <p className="text-[10px] text-gray-400">Temp premie: <span className="font-bold text-orange-500">&euro;{current.tempPremium.toLocaleString()}</span> extra t.o.v. intern tarief</p>
              </div>
            </div>
          </div>
        </div>

        {/* Hours summary */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Uren overzicht</p>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1"><span className="text-gray-500">Totaal uren</span><span className="font-bold tabular-nums">{current.totalHours}h</span></div>
              <div className="h-3 rounded-full bg-gray-100 overflow-hidden flex">
                <div className="h-full bg-blue-500" style={{ width: `${current.totalHours > 0 ? (current.internalHours / current.totalHours) * 100 : 0}%` }} />
                <div className="h-full bg-orange-400" style={{ width: `${current.totalHours > 0 ? (current.tempHours / current.totalHours) * 100 : 0}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>Intern: {current.internalHours}h</span>
                <span>Temp: {current.tempHours}h</span>
              </div>
            </div>
            {current.overtimeHours > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2">
                <p className="text-xs font-semibold text-amber-700">{current.overtimeHours}h overuren</p>
                <p className="text-[10px] text-amber-600">Kosten: &euro;{current.overtimeCost} (toeslag {((1.5 - 1) * 100).toFixed(0)}%)</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cost trend chart — 6 months */}
      {trend.length > 0 && (() => {
        const maxCost = Math.max(1, ...trend.map((t) => t.totalCost))
        const W = 600, H = 140, PAD_L = 50, PAD_R = 10, PAD_T = 10, PAD_B = 24
        const chartW = W - PAD_L - PAD_R, chartH = H - PAD_T - PAD_B
        const xPos = (i: number) => PAD_L + (i / Math.max(1, trend.length - 1)) * chartW
        const yPos = (v: number) => PAD_T + chartH - (v / maxCost) * chartH

        const totalLine = trend.map((t, i) => `${i === 0 ? 'M' : 'L'}${xPos(i).toFixed(1)},${yPos(t.totalCost).toFixed(1)}`).join(' ')
        const internalLine = trend.map((t, i) => `${i === 0 ? 'M' : 'L'}${xPos(i).toFixed(1)},${yPos(t.internalCost).toFixed(1)}`).join(' ')
        const tempLine = trend.map((t, i) => `${i === 0 ? 'M' : 'L'}${xPos(i).toFixed(1)},${yPos(t.tempCost).toFixed(1)}`).join(' ')
        const areaPath = `${totalLine} L${xPos(trend.length - 1).toFixed(1)},${yPos(0).toFixed(1)} L${xPos(0).toFixed(1)},${yPos(0).toFixed(1)} Z`

        return (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Kostentrend — 6 maanden</p>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-4 h-[2px] bg-gray-900 rounded" />Totaal</span>
                <span className="flex items-center gap-1"><span className="w-4 h-[2px] bg-blue-500 rounded" />Intern</span>
                <span className="flex items-center gap-1"><span className="w-4 h-[2px] bg-orange-400 rounded" />Temp</span>
              </div>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
              <defs>
                <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4F6BFF" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#4F6BFF" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {/* Grid */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
                <g key={pct}>
                  <line x1={PAD_L} y1={yPos(pct * maxCost)} x2={W - PAD_R} y2={yPos(pct * maxCost)} stroke="#f3f4f6" strokeWidth="1" />
                  <text x={PAD_L - 6} y={yPos(pct * maxCost) + 3} textAnchor="end" style={{ fontSize: 8 }} className="fill-gray-300">
                    &euro;{Math.round(pct * maxCost)}
                  </text>
                </g>
              ))}
              {/* Area */}
              <path d={areaPath} fill="url(#trendGrad)" />
              {/* Lines */}
              <path d={totalLine} fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d={internalLine} fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 2" />
              <path d={tempLine} fill="none" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 2" />
              {/* Dots on total */}
              {trend.map((t, i) => (
                <circle key={i} cx={xPos(i)} cy={yPos(t.totalCost)} r="3" fill="#111827" stroke="white" strokeWidth="1.5" />
              ))}
              {/* Month labels */}
              {trend.map((t, i) => (
                <text key={`l-${i}`} x={xPos(i)} y={H - 4} textAnchor="middle" style={{ fontSize: 9, fontWeight: 500 }} className="fill-gray-400">
                  {t.label}
                </text>
              ))}
            </svg>
          </div>
        )
      })()}

      {/* Per shift + per department */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Per shift */}
        {current.costPerShift.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Kosten per shift</p>
            <div className="space-y-2.5">
              {current.costPerShift.map((s) => (
                <div key={s.shiftName} className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 w-28 truncate shrink-0">{s.shiftName}</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-[#4F6BFF]" style={{ width: `${(s.cost / maxShiftCost) * 100}%` }} />
                  </div>
                  <span className="text-xs font-bold tabular-nums text-gray-500 w-16 text-right">&euro;{s.cost}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per department */}
        {current.costPerDepartment.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Kosten per afdeling</p>
            <div className="space-y-2.5">
              {current.costPerDepartment.map((d) => (
                <div key={d.departmentName} className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 w-28 truncate shrink-0">{d.departmentName}</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-400" style={{ width: `${(d.cost / maxDeptCost) * 100}%` }} />
                  </div>
                  <span className="text-xs font-bold tabular-nums text-gray-500 w-16 text-right">&euro;{d.cost}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
