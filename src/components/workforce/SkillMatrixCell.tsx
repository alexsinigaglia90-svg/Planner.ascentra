'use client'

import { useEffect, useRef, useState } from 'react'
import { SkillLevelIndicator, LEVEL_LABELS, LEVEL_COLORS } from './SkillLevelIndicator'
import { RadialSkillPicker } from './RadialSkillPicker'

// ─── Crown keyframes ──────────────────────────────────────────────────────────
// Injected once into <head>; give the Elite state a floating animated crown.
const CROWN_KF_ID = 'skill-crown-kf'
function injectCrownKeyframes() {
  if (typeof document === 'undefined') return
  if (document.getElementById(CROWN_KF_ID)) return
  const s = document.createElement('style')
  s.id = CROWN_KF_ID
  s.textContent = `
@keyframes crown-enter {
  0%   { transform: translateY(5px) scale(0.45); opacity: 0; }
  62%  { transform: translateY(-2px) scale(1.08); opacity: 1; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes crown-float {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-1.5px); }
}
@keyframes crown-orb-breathe {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.022); }
}
`
  document.head.appendChild(s)
}

// ─── SkillMatrixCell ──────────────────────────────────────────────────────────
// Matrix cell: clicking opens the radial level picker.
// Provides bump feedback when level changes, hover lift, and Elite crown.

interface Props {
  level: number
  canEdit: boolean
  onSelect: (level: number) => void
}

export function SkillMatrixCell({ level, canEdit, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [bumped, setBumped] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const prevLvRef = useRef(level)

  const lv = Math.max(0, Math.min(4, level))
  const label = LEVEL_LABELS[lv]

  // Inject crown CSS keyframes once on mount
  useEffect(() => { injectCrownKeyframes() }, [])

  // Brief scale-pop when the level changes (optimistic update fires this)
  useEffect(() => {
    if (lv !== prevLvRef.current) {
      prevLvRef.current = lv
      setBumped(true)
      const id = setTimeout(() => setBumped(false), 280)
      return () => clearTimeout(id)
    }
  }, [lv])

  // Compose scale from priority: bump > open-dim > hover > idle
  const indicatorScale = bumped ? 1.18 : open ? 0.88 : hovered && canEdit ? 1.07 : 1
  const indicatorTransition = bumped
    ? 'transform 110ms cubic-bezier(0.34,1.56,0.64,1)'
    : 'transform 160ms ease-out'

  function handleClick() {
    if (!canEdit) return
    setOpen((v) => !v)
  }

  const eliteColor = LEVEL_COLORS[4]

  return (
    <>
      {/* Wrapper provides containing block for absolutely-positioned crown */}
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Elite crown — mounts above the orb when level 4 is active */}
        {lv === 4 && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -13,
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <div
              style={{
                animation:
                  'crown-enter 380ms cubic-bezier(0.34,1.56,0.64,1) both, crown-float 2.8s ease-in-out 400ms infinite',
              }}
            >
              <svg width="14" height="11" viewBox="0 0 14 11" fill="none" aria-hidden="true">
                <path
                  d="M 1 10.5 L 1 6.5 L 3.5 3.5 L 5 6 L 7 0.5 L 9 6 L 10.5 3.5 L 13 6.5 L 13 10.5 Z"
                  fill={eliteColor}
                  fillOpacity="0.7"
                  stroke={eliteColor}
                  strokeWidth="0.7"
                  strokeOpacity="0.9"
                  strokeLinejoin="round"
                />
                {/* Jewel accents at prong tips */}
                <circle cx="3.5" cy="3.2" r="1.2" fill={eliteColor} />
                <circle cx="7" cy="0.6" r="1.2" fill={eliteColor} />
                <circle cx="10.5" cy="3.2" r="1.2" fill={eliteColor} />
              </svg>
            </div>
          </div>
        )}

        <button
          ref={triggerRef}
          type="button"
          disabled={!canEdit}
          onClick={handleClick}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          title={canEdit ? `${label} — click to change` : label}
          aria-label={`Level: ${label}${canEdit ? '. Click to change.' : ''}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={[
            'flex items-center justify-center rounded-full outline-none',
            canEdit
              ? 'cursor-pointer focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-1'
              : 'cursor-default',
          ].join(' ')}
          style={{ width: 40, height: 40 }}
        >
          <span
            style={{
              display: 'block',
              transform: `scale(${indicatorScale})`,
              transition: indicatorTransition,
              willChange: 'transform',
            }}
          >
            {/* Elite orb breathes subtly when idle — adds micro-life */}
            <span
              style={{
                display: 'block',
                animation:
                  lv === 4 && !bumped && !open
                    ? 'crown-orb-breathe 3s ease-in-out 1.2s infinite'
                    : 'none',
              }}
            >
              <SkillLevelIndicator level={lv} />
            </span>
          </span>
        </button>
      </div>

      {open && (
        <RadialSkillPicker
          anchorEl={triggerRef.current}
          currentLevel={lv}
          onSelect={onSelect}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
