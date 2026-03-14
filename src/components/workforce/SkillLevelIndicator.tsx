// ─── Level system ─────────────────────────────────────────────────────────────

export const LEVEL_COLORS = [
  '#d1d5db', // 0 – Not trained  (gray-300  — track only)
  '#fb923c', // 1 – Learning     (orange-400 — warm, distinct)
  '#3b82f6', // 2 – Operational  (blue-500   — reliable)
  '#8b5cf6', // 3 – Strong       (violet-500 — advanced)
  '#f59e0b', // 4 – Elite        (amber-500  — gold)
] as const

export const LEVEL_LABELS = [
  'Not trained',
  'Learning',
  'Operational',
  'Strong',
  'Elite',
] as const

// SVG geometry — viewBox "0 0 36 36", radius 14
const RING_RADIUS = 14
export const RING_CIRC = 2 * Math.PI * RING_RADIUS // ≈ 87.96

// ─── SkillLevelIndicator ──────────────────────────────────────────────────────
// Pure display component — renders a progress-ring for a given skill level (0–4).

interface Props {
  level: number
  size?: number
  strokeWidth?: number
}

export function SkillLevelIndicator({ level, size = 34, strokeWidth = 3 }: Props) {
  const lv = Math.max(0, Math.min(4, Math.round(level)))
  const color = LEVEL_COLORS[lv]
  const offset = RING_CIRC * (1 - lv / 4)

  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
      {/* Track ring */}
      <circle
        cx="18"
        cy="18"
        r={RING_RADIUS}
        fill="none"
        stroke={lv === 0 ? '#e5e7eb' : `${color}22`}
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      {lv > 0 && (
        <circle
          cx="18"
          cy="18"
          r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={RING_CIRC}
          strokeDashoffset={offset}
          transform="rotate(-90 18 18)"
          style={{
            transition: 'stroke-dashoffset 0.35s cubic-bezier(0.4,0,0.2,1), stroke 0.2s ease',
          }}
        />
      )}
    </svg>
  )
}
