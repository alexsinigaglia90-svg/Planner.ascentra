'use client'

import { useState } from 'react'

// ─── Level system ─────────────────────────────────────────────────────────────

export const LEVEL_COLORS = [
  '#d1d5db', // 0 – Not trained (gray-300)
  '#fbbf24', // 1 – Learning    (amber-400)
  '#3b82f6', // 2 – Operational (blue-500)
  '#a855f7', // 3 – Strong      (purple-500)
  '#eab308', // 4 – Elite       (yellow-500 / gold)
]

export const LEVEL_LABELS = [
  'Not trained',
  'Learning',
  'Operational',
  'Strong',
  'Elite',
]

// SVG geometry — viewBox "0 0 36 36"
const R = 14
const CX = 18
const CY = 18
export const RING_CIRC = 2 * Math.PI * R // ≈ 87.96

// ─── CapabilityRing ───────────────────────────────────────────────────────────

export function CapabilityRing({
  level,
  size = 36,
  strokeWidth = 3.5,
}: {
  level: number
  size?: number
  strokeWidth?: number
}) {
  const lv = Math.max(0, Math.min(4, Math.round(level)))
  const color = LEVEL_COLORS[lv] ?? '#d1d5db'
  const offset = RING_CIRC * (1 - lv / 4)

  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
      {/* Track ring */}
      <circle
        cx={CX}
        cy={CY}
        r={R}
        fill="none"
        stroke={lv === 0 ? '#e5e7eb' : `${color}30`}
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      {lv > 0 && (
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={RING_CIRC}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${CX} ${CY})`}
          style={{
            transition: 'stroke-dashoffset 0.35s cubic-bezier(0.4,0,0.2,1), stroke 0.2s ease',
          }}
        />
      )}
    </svg>
  )
}

// ─── RingCell — clickable matrix cell ────────────────────────────────────────

export function RingCell({
  level,
  canEdit,
  onCycle,
}: {
  level: number | undefined
  canEdit: boolean
  onCycle: () => void
}) {
  const [pressed, setPressed] = useState(false)
  const lv = level ?? 0
  const label = LEVEL_LABELS[lv] ?? 'Unknown'

  function handleClick() {
    if (!canEdit) return
    setPressed(true)
    setTimeout(() => setPressed(false), 130)
    onCycle()
  }

  return (
    <button
      type="button"
      disabled={!canEdit}
      onClick={handleClick}
      title={canEdit ? `${label} — click to advance` : label}
      className={[
        'flex items-center justify-center rounded-full outline-none',
        canEdit
          ? 'cursor-pointer hover:brightness-110 hover:drop-shadow-[0_0_10px_rgba(148,163,184,0.55)] focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1'
          : 'cursor-default',
      ].join(' ')}
      style={{
        width: 36,
        height: 36,
        transform: pressed ? 'scale(0.83)' : 'scale(1)',
        transition: 'transform 0.15s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <CapabilityRing level={lv} />
    </button>
  )
}
