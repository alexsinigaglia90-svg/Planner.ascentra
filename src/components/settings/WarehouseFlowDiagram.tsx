'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ProcessDetailRow } from '@/lib/queries/processes'

// ── Zone definitions ─────────────────────────────────────────────────────────

interface Zone {
  id: string
  label: string
  keywords: string[]
  x: number; y: number; w: number; h: number
  color: string
  iconPath: string
}

const ZONES: Zone[] = [
  {
    id: 'inbound',
    label: 'Inbound',
    keywords: ['inbound', 'unloading', 'receiving', 'ontvangst', 'lossen', 'x-dock', 'xdock', 'sorting', 'scanning', 'intake', 'goods in'],
    x: 40, y: 80, w: 160, h: 130,
    color: '#3B82F6',
    iconPath: 'M12 4v8l4-4M12 12l-4-4',
  },
  {
    id: 'storage',
    label: 'Storage',
    keywords: ['storage', 'opslag', 'reserve', 'put away', 'putaway', 'pulling', 'replenishment', 'cycle count', 'voorraad', 'stelling', 'locatie'],
    x: 240, y: 60, w: 180, h: 150,
    color: '#8B5CF6',
    iconPath: 'M4 4h16v4H4zM4 10h16v4H4zM4 16h16v4H4z',
  },
  {
    id: 'outbound',
    label: 'Outbound',
    keywords: ['outbound', 'picking', 'pick', 'gtp', 'singles', 'decanting', 'manual picking', 'orderpicking', 'verzamelen', 'packing', 'pack', 'verpakken', 'full cases'],
    x: 460, y: 80, w: 160, h: 130,
    color: '#F59E0B',
    iconPath: 'M5 12h14M12 5l7 7-7 7',
  },
  {
    id: 'shipping',
    label: 'Shipping',
    keywords: ['shipping', 'verzending', 'loading', 'laden', 'transport', 'dispatch', 'expedition', 'expeditie', 'repack', 'returns', 'shouts', 'e-return'],
    x: 660, y: 80, w: 150, h: 130,
    color: '#22C55E',
    iconPath: 'M5 17h14l-2-6H7L5 17zM9 17v2M15 17v2M3 11h18',
  },
  {
    id: 'process',
    label: 'Process',
    keywords: ['process', 'processing', 'bewerking', 'productie', 'assembly', 'quality', 'kwaliteit', 'inspectie', 'controle', 'check', 'infeed', 'ranpak'],
    x: 350, y: 230, w: 160, h: 90,
    color: '#EC4899',
    iconPath: 'M12 2l2 4h4l-3 3 1 5-4-2-4 2 1-5-3-3h4z',
  },
]

function matchZone(processName: string, deptName: string | null): Zone | null {
  const search = `${processName} ${deptName ?? ''}`.toLowerCase()
  let bestZone: Zone | null = null
  let bestScore = 0

  for (const zone of ZONES) {
    let score = 0
    for (const kw of zone.keywords) {
      if (search.includes(kw)) score += kw.length // longer keyword = more specific = higher score
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
}

// ── Component ────────────────────────────────────────────────────────────────

export default function WarehouseFlowDiagram({ processes, hoveredProcessId }: Props) {
  const [animPhase, setAnimPhase] = useState(0)
  const [packageX, setPackageX] = useState(0)

  // Map processes to zones
  const zoneProcesses = useMemo(() => {
    const map = new Map<string, ProcessDetailRow[]>()
    for (const zone of ZONES) map.set(zone.id, [])

    for (const p of processes) {
      if (!p.active) continue
      const zone = matchZone(p.name, p.departmentName)
      if (zone) {
        map.get(zone.id)!.push(p)
      }
    }
    return map
  }, [processes])

  // Active zones (have at least one process)
  const activeZones = useMemo(() => ZONES.filter((z) => (zoneProcesses.get(z.id)?.length ?? 0) > 0), [zoneProcesses])

  // Hovered zone
  const hoveredZone = useMemo(() => {
    if (!hoveredProcessId) return null
    const proc = processes.find((p) => p.id === hoveredProcessId)
    if (!proc) return null
    return matchZone(proc.name, proc.departmentName)?.id ?? null
  }, [hoveredProcessId, processes])

  // Package animation — travels from left to right
  useEffect(() => {
    if (activeZones.length === 0) return
    let raf: number
    let start: number | null = null
    const duration = 6000 // 6 seconds for full journey

    function tick(ts: number) {
      if (start === null) start = ts
      const elapsed = ts - start
      const progress = (elapsed % duration) / duration
      setPackageX(progress)

      // Phase: which zone is the package near?
      const zoneCount = activeZones.length
      const zoneProgress = progress * zoneCount
      setAnimPhase(Math.floor(zoneProgress) % zoneCount)

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [activeZones.length])

  const svgW = 850
  const svgH = 340

  // Package position along the flow
  const pkgPathX = 20 + packageX * (svgW - 60)
  const pkgPathY = 160 + Math.sin(packageX * Math.PI * 4) * 8

  return (
    <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50/80 to-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Warehouse Flow</p>
          <p className="text-[10px] text-gray-300 mt-0.5">{activeZones.length} actieve zones · {processes.filter((p) => p.active).length} processen</p>
        </div>
        <div className="flex items-center gap-2">
          {ZONES.filter((z) => (zoneProcesses.get(z.id)?.length ?? 0) > 0).map((z) => (
            <span key={z.id} className="flex items-center gap-1 text-[9px] font-medium text-gray-400">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: z.color, opacity: 0.6 }} />
              {z.label}
            </span>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ height: 280 }}>
        <defs>
          {/* Filters */}
          <filter id="wf-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="wf-shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.1" />
          </filter>
        </defs>

        {/* Floor line */}
        <line x1="20" y1={svgH - 40} x2={svgW - 20} y2={svgH - 40} stroke="#E5E7EB" strokeWidth="2" strokeDasharray="8 4" />

        {/* Flow arrows between zones */}
        {activeZones.length > 1 && activeZones.slice(0, -1).map((zone, i) => {
          const next = activeZones[i + 1]
          const fromX = zone.x + zone.w
          const toX = next.x
          const midY = zone.y + zone.h / 2
          return (
            <g key={`arrow-${zone.id}`}>
              <motion.line
                x1={fromX + 5} y1={midY} x2={toX - 5} y2={next.y + next.h / 2}
                stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round"
                strokeDasharray="6 4"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, delay: 0.3 + i * 0.15 }}
              />
              <motion.polygon
                points={`${toX - 5},${next.y + next.h / 2 - 5} ${toX + 3},${next.y + next.h / 2} ${toX - 5},${next.y + next.h / 2 + 5}`}
                fill="#D1D5DB"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 + i * 0.15 }}
              />
            </g>
          )
        })}

        {/* Zone buildings */}
        {ZONES.map((zone, zi) => {
          const procs = zoneProcesses.get(zone.id) ?? []
          const isActive = procs.length > 0
          const isHovered = hoveredZone === zone.id
          const isLit = isActive && activeZones.indexOf(zone) === animPhase

          return (
            <motion.g key={zone.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isActive ? 1 : 0.2, y: 0 }}
              transition={{ duration: 0.4, delay: zi * 0.1 }}
            >
              {/* Building glow when lit */}
              {isLit && (
                <motion.rect
                  x={zone.x - 6} y={zone.y - 6} width={zone.w + 12} height={zone.h + 12}
                  rx={16} fill={zone.color} opacity={0.08}
                  animate={{ opacity: [0.04, 0.12, 0.04] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}

              {/* Building body */}
              <rect
                x={zone.x} y={zone.y} width={zone.w} height={zone.h}
                rx={12}
                fill="white"
                stroke={isHovered ? zone.color : isActive ? '#E5E7EB' : '#F3F4F6'}
                strokeWidth={isHovered ? 2.5 : 1.5}
                filter={isActive ? 'url(#wf-shadow)' : undefined}
                style={{ transition: 'stroke 0.2s ease, stroke-width 0.2s ease' }}
              />

              {/* Roof accent */}
              <rect
                x={zone.x} y={zone.y} width={zone.w} height={6}
                rx={12}
                fill={isActive ? zone.color : '#F3F4F6'}
                opacity={isActive ? (isHovered ? 1 : 0.7) : 0.3}
                style={{ transition: 'opacity 0.2s ease' }}
              />
              {/* Fix bottom corners of roof */}
              <rect x={zone.x} y={zone.y + 3} width={zone.w} height={3} fill={isActive ? zone.color : '#F3F4F6'} opacity={isActive ? (isHovered ? 1 : 0.7) : 0.3} />

              {/* Zone icon */}
              <g transform={`translate(${zone.x + zone.w / 2 - 12}, ${zone.y + 16})`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isActive ? zone.color : '#D1D5DB'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={zone.iconPath} />
                </svg>
              </g>

              {/* Zone label */}
              <text
                x={zone.x + zone.w / 2} y={zone.y + 54}
                textAnchor="middle"
                fill={isActive ? '#111827' : '#D1D5DB'}
                style={{ fontSize: 12, fontWeight: 700 }}
              >
                {zone.label}
              </text>

              {/* Process count badge */}
              {procs.length > 0 && (
                <g>
                  <rect
                    x={zone.x + zone.w / 2 - 14} y={zone.y + 62}
                    width={28} height={16} rx={8}
                    fill={zone.color} opacity={0.12}
                  />
                  <text
                    x={zone.x + zone.w / 2} y={zone.y + 74}
                    textAnchor="middle"
                    fill={zone.color}
                    style={{ fontSize: 9, fontWeight: 700 }}
                  >
                    {procs.length} proc
                  </text>
                </g>
              )}

              {/* Process names (small, below building) */}
              {procs.slice(0, 4).map((proc, pi) => (
                <text
                  key={proc.id}
                  x={zone.x + zone.w / 2} y={zone.y + 92 + pi * 12}
                  textAnchor="middle"
                  fill={hoveredProcessId === proc.id ? zone.color : '#9CA3AF'}
                  style={{ fontSize: 9, fontWeight: hoveredProcessId === proc.id ? 600 : 400, transition: 'fill 0.15s ease' }}
                >
                  {proc.name.length > 18 ? proc.name.slice(0, 16) + '…' : proc.name}
                </text>
              ))}
              {procs.length > 4 && (
                <text
                  x={zone.x + zone.w / 2} y={zone.y + 92 + 4 * 12}
                  textAnchor="middle" fill="#D1D5DB" style={{ fontSize: 8 }}
                >
                  +{procs.length - 4} meer
                </text>
              )}
            </motion.g>
          )
        })}

        {/* Animated package */}
        {activeZones.length > 0 && (
          <motion.g
            animate={{ x: pkgPathX, y: pkgPathY }}
            transition={{ type: 'tween', duration: 0.05 }}
          >
            {/* Package glow */}
            <circle cx={0} cy={0} r={10} fill="#4F6BFF" opacity={0.08} />
            {/* Package box */}
            <rect x={-7} y={-7} width={14} height={14} rx={3} fill="#4F6BFF" stroke="white" strokeWidth={1.5} />
            {/* Package tape */}
            <line x1={0} y1={-7} x2={0} y2={7} stroke="white" strokeWidth={1} opacity={0.6} />
            <line x1={-7} y1={0} x2={7} y2={0} stroke="white" strokeWidth={1} opacity={0.4} />
          </motion.g>
        )}

        {/* Truck at start */}
        <g transform="translate(5, 145)">
          <rect x={0} y={4} width={22} height={14} rx={3} fill="#6B7280" opacity={0.2} />
          <rect x={15} y={7} width={10} height={11} rx={2} fill="#6B7280" opacity={0.15} />
          <circle cx={7} cy={20} r={3} fill="#9CA3AF" opacity={0.3} />
          <circle cx={22} cy={20} r={3} fill="#9CA3AF" opacity={0.3} />
        </g>

        {/* Delivery at end */}
        <g transform={`translate(${svgW - 35}, 145)`}>
          <rect x={0} y={2} width={20} height={18} rx={3} fill="#22C55E" opacity={0.15} />
          <path d="M4 12l4 4 8-8" stroke="#22C55E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.4} />
        </g>
      </svg>
    </div>
  )
}
