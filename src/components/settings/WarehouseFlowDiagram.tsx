'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { ProcessDetailRow } from '@/lib/queries/processes'

// ── Zone definitions (warehouse areas) ───────────────────────────────────────

interface Zone {
  id: string
  label: string
  labelNL: string
  keywords: string[]
  color: string
  bgLight: string
  emoji: string // visual identifier for the zone
  order: number
}

const ZONES: Zone[] = [
  {
    id: 'receiving', label: 'Receiving', labelNL: 'Ontvangst',
    keywords: ['receiving', 'ontvangst', 'goods in', 'goods-in', 'dock', 'lossen'],
    color: '#3B82F6', bgLight: 'rgba(59,130,246,0.06)', emoji: '🚛', order: 0,
  },
  {
    id: 'inbound', label: 'Inbound', labelNL: 'Inbound',
    keywords: ['inbound', 'unloading', 'x-dock', 'xdock', 'sorting', 'scanning', 'intake', 'cross-dock', 'crossdock'],
    color: '#6366F1', bgLight: 'rgba(99,102,241,0.06)', emoji: '📥', order: 1,
  },
  {
    id: 'storage', label: 'Storage', labelNL: 'Opslag',
    keywords: ['storage', 'opslag', 'reserve', 'put away', 'putaway', 'pulling', 'replenishment', 'cycle count', 'voorraad', 'stelling', 'locatie', 'bulk'],
    color: '#8B5CF6', bgLight: 'rgba(139,92,246,0.06)', emoji: '🏗️', order: 2,
  },
  {
    id: 'outbound', label: 'Outbound', labelNL: 'Outbound',
    keywords: ['outbound', 'picking', 'pick', 'gtp', 'goods to person', 'singles', 'decanting', 'manual picking', 'orderpicking', 'verzamelen', 'full cases', 'infeed', 'ranpak'],
    color: '#F59E0B', bgLight: 'rgba(245,158,11,0.06)', emoji: '📦', order: 3,
  },
  {
    id: 'packing', label: 'Packing', labelNL: 'Verpakking',
    keywords: ['packing', 'pack', 'verpakken', 'verpakking', 'wrapping', 'labeling', 'labellen'],
    color: '#EC4899', bgLight: 'rgba(236,72,153,0.06)', emoji: '🎁', order: 4,
  },
  {
    id: 'shipping', label: 'Shipping', labelNL: 'Verzending',
    keywords: ['shipping', 'verzending', 'loading', 'laden', 'transport', 'dispatch', 'expedition', 'expeditie', 'repack', 'shouts', 'building shipments'],
    color: '#22C55E', bgLight: 'rgba(34,197,94,0.06)', emoji: '🚚', order: 5,
  },
  {
    id: 'returns', label: 'Returns', labelNL: 'Retouren',
    keywords: ['returns', 'return', 'retour', 'retouren', 'e-return', 'e-returns', 'rtv', 'pre retail', 'pre receiving'],
    color: '#EF4444', bgLight: 'rgba(239,68,68,0.06)', emoji: '🔄', order: 6,
  },
  {
    id: 'quality', label: 'Quality', labelNL: 'Kwaliteit',
    keywords: ['quality', 'kwaliteit', 'inspectie', 'inspection', 'check', 'controle', 'qc', 'qa'],
    color: '#14B8A6', bgLight: 'rgba(20,184,166,0.06)', emoji: '✅', order: 7,
  },
  {
    id: 'other', label: 'Other', labelNL: 'Overig',
    keywords: [],
    color: '#6B7280', bgLight: 'rgba(107,114,128,0.06)', emoji: '⚙️', order: 99,
  },
]

function matchZone(processName: string, deptName: string | null): Zone {
  const search = `${processName} ${deptName ?? ''}`.toLowerCase()
  let bestZone: Zone = ZONES[ZONES.length - 1] // default: 'other'
  let bestScore = 0

  for (const zone of ZONES) {
    if (zone.id === 'other') continue
    let score = 0
    for (const kw of zone.keywords) {
      if (search.includes(kw)) score += kw.length
    }
    if (score > bestScore) {
      bestScore = score
      bestZone = zone
    }
  }

  return bestZone
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  processes: ProcessDetailRow[]
  hoveredProcessId?: string | null
  onHoverProcess?: (id: string | null) => void
  onClickProcess?: (id: string) => void
}

// ── Component ────────────────────────────────────────────────────────────────

export default function WarehouseFlowDiagram({ processes, hoveredProcessId, onHoverProcess, onClickProcess }: Props) {
  const [animTick, setAnimTick] = useState(0)

  // Animate flow particles
  useEffect(() => {
    const interval = setInterval(() => setAnimTick((t) => (t + 1) % 100), 80)
    return () => clearInterval(interval)
  }, [])

  // Group active processes by zone
  const zoneGroups = useMemo(() => {
    const map = new Map<string, { zone: Zone; processes: ProcessDetailRow[] }>()

    for (const p of processes) {
      if (!p.active) continue
      const zone = matchZone(p.name, p.departmentName)
      const existing = map.get(zone.id)
      if (existing) {
        existing.processes.push(p)
      } else {
        map.set(zone.id, { zone, processes: [p] })
      }
    }

    return Array.from(map.values()).sort((a, b) => a.zone.order - b.zone.order)
  }, [processes])

  const hoveredZoneId = useMemo(() => {
    if (!hoveredProcessId) return null
    const proc = processes.find((p) => p.id === hoveredProcessId)
    if (!proc) return null
    return matchZone(proc.name, proc.departmentName).id
  }, [hoveredProcessId, processes])

  if (zoneGroups.length === 0) return null

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/40 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Warehouse Procesmap</p>
          <p className="text-[10px] text-gray-300 mt-0.5">{zoneGroups.length} zones · {processes.filter((p) => p.active).length} actieve processen</p>
        </div>
        <div className="flex items-center gap-1.5">
          {zoneGroups.map((g) => (
            <span key={g.zone.id} className="w-2 h-2 rounded-full" style={{ backgroundColor: g.zone.color, opacity: 0.6 }} />
          ))}
        </div>
      </div>

      {/* Flow visualization */}
      <div className="p-5">
        <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
          {/* Start: Truck */}
          <div className="flex flex-col items-center justify-center px-3 shrink-0">
            <span className="text-2xl">🚛</span>
            <span className="text-[8px] text-gray-400 font-medium mt-1">AANVOER</span>
          </div>

          {zoneGroups.map((group, gi) => {
            const isHovered = hoveredZoneId === group.zone.id
            const processCount = group.processes.length

            return (
              <div key={group.zone.id} className="flex items-stretch gap-2 shrink-0">
                {/* Flow arrow */}
                {gi >= 0 && (
                  <div className="flex items-center px-1">
                    <div className="relative">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <motion.path
                          d="M4 12h12M13 8l4 4-4 4"
                          stroke={isHovered ? group.zone.color : '#D1D5DB'}
                          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1.5, repeat: Infinity, delay: gi * 0.2 }}
                        />
                      </svg>
                      {/* Flow particle */}
                      <motion.div
                        className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: group.zone.color }}
                        animate={{ left: ['-4px', '20px'], opacity: [0, 1, 0] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: gi * 0.3 }}
                      />
                    </div>
                  </div>
                )}

                {/* Zone card */}
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.35, delay: gi * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  className="relative rounded-xl border overflow-hidden transition-all duration-200 cursor-default"
                  style={{
                    borderColor: isHovered ? group.zone.color : '#E5E7EB',
                    background: isHovered ? group.zone.bgLight : 'white',
                    boxShadow: isHovered ? `0 4px 20px ${group.zone.color}20` : '0 1px 3px rgba(0,0,0,0.04)',
                    minWidth: 140,
                    maxWidth: 180,
                  }}
                >
                  {/* Top accent */}
                  <div className="h-1" style={{ backgroundColor: group.zone.color, opacity: isHovered ? 1 : 0.5 }} />

                  <div className="p-3">
                    {/* Zone header */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg leading-none">{group.zone.emoji}</span>
                      <div>
                        <p className="text-xs font-bold" style={{ color: group.zone.color }}>{group.zone.labelNL}</p>
                        <p className="text-[9px] text-gray-400">{processCount} proces{processCount !== 1 ? 'sen' : ''}</p>
                      </div>
                    </div>

                    {/* Process pills */}
                    <div className="flex flex-col gap-1">
                      {group.processes.map((proc) => {
                        const isProcHovered = hoveredProcessId === proc.id
                        return (
                          <motion.div
                            key={proc.id}
                            onMouseEnter={() => onHoverProcess?.(proc.id)}
                            onMouseLeave={() => onHoverProcess?.(null)}
                            onClick={() => onClickProcess?.(proc.id)}
                            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-all duration-150 cursor-pointer"
                            style={{
                              backgroundColor: isProcHovered ? `${group.zone.color}18` : 'rgba(0,0,0,0.02)',
                              color: isProcHovered ? group.zone.color : '#374151',
                              border: `1px solid ${isProcHovered ? `${group.zone.color}40` : 'transparent'}`,
                            }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: group.zone.color, opacity: isProcHovered ? 1 : 0.4 }} />
                            <span className="truncate">{proc.name}</span>
                            {proc.normPerHour && (
                              <span className="ml-auto text-[8px] text-gray-400 tabular-nums shrink-0">{proc.normPerHour}/h</span>
                            )}
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                </motion.div>
              </div>
            )
          })}

          {/* End: Delivery */}
          <div className="flex items-stretch gap-2 shrink-0">
            <div className="flex items-center px-1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <motion.path d="M4 12h12M13 8l4 4-4 4" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity, delay: zoneGroups.length * 0.2 }} />
              </svg>
            </div>
            <div className="flex flex-col items-center justify-center px-3">
              <span className="text-2xl">📦</span>
              <span className="text-[8px] text-gray-400 font-medium mt-1">KLANT</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Export zone matcher for use in ProcessesView grouping ─────────────────────

export { matchZone, ZONES, type Zone }
