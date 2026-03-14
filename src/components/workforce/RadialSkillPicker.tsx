'use client'

/**
 * RadialSkillPicker
 * ─────────────────────────────────────────────────────────────────────────────
 * A signature Pixar-quality micro-interaction for skill level selection.
 *
 * Visual model:
 *   • 5 arc segments radiate out from a center orb (positioned over the trigger)
 *   • Segments are SVG arc paths; each carries a mini ring + label
 *   • Staggered spring-in on open, spring-out on close
 *   • Hover bounces the segment; select pops + glows; Elite sparkles
 *
 * Architecture:
 *   • Portal into document.body to escape table overflow clipping
 *   • All animation is CSS transitions / keyframes + inline style (no Framer Motion)
 *   • Self-contained — only prop interface change vs old SkillLevelPicker is the name
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { SkillLevelIndicator, LEVEL_LABELS, LEVEL_COLORS } from './SkillLevelIndicator'

// ─── Constants ────────────────────────────────────────────────────────────────

const NUM_LEVELS = 5

// The arc sweeps from -216° to +72° (total 288°), keeping the bottom clear
// so it doesn't collide with the row below.
// Level 0 sits at the top-left; level 4 at top-right.
const ARC_SPREAD_DEG = 288
const ARC_START_DEG = -216 // degrees, 0° = right (East)

// Segment geometry
const INNER_R = 44   // inner edge of arc ring (px from SVG centre)
const OUTER_R = 82   // outer edge
const MID_R   = (INNER_R + OUTER_R) / 2  // label/icon placement radius
const ICON_R  = MID_R - 4  // ring icon radius (slightly inward)
const LABEL_R = MID_R + 14 // label line radius (outward)

// Each segment spans ARC_SPREAD / NUM_LEVELS degrees minus a small gap
const SEG_SPAN = ARC_SPREAD_DEG / NUM_LEVELS   // 57.6°
const SEG_GAP  = 3.5                            // degrees gap between segments

const SVG_SIZE = 220  // total SVG bounding box
const CX = SVG_SIZE / 2
const CY = SVG_SIZE / 2

// Animation
const ANIM_OPEN_MS  = 150   // each segment takes ~150 ms to spring in
const ANIM_STAGGER  = 28    // ms stagger between each segment
const ANIM_CLOSE_MS = 110   // close is faster
const ANIM_TOTAL_OPEN  = ANIM_OPEN_MS + ANIM_STAGGER * (NUM_LEVELS - 1)
const ANIM_TOTAL_CLOSE = ANIM_CLOSE_MS

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function deg2rad(d: number) { return (d * Math.PI) / 180 }

function polarToXY(angleDeg: number, r: number) {
  const a = deg2rad(angleDeg)
  return {
    x: CX + r * Math.cos(a),
    y: CY + r * Math.sin(a),
  }
}

/** Build an SVG arc-wedge path for a segment between startDeg and endDeg */
function makePath(startDeg: number, endDeg: number, inner: number, outer: number) {
  const o1 = polarToXY(startDeg, outer)
  const o2 = polarToXY(endDeg,   outer)
  const i2 = polarToXY(endDeg,   inner)
  const i1 = polarToXY(startDeg, inner)
  const largeArc = (endDeg - startDeg) > 180 ? 1 : 0
  return [
    `M ${o1.x.toFixed(3)} ${o1.y.toFixed(3)}`,
    `A ${outer} ${outer} 0 ${largeArc} 1 ${o2.x.toFixed(3)} ${o2.y.toFixed(3)}`,
    `L ${i2.x.toFixed(3)} ${i2.y.toFixed(3)}`,
    `A ${inner} ${inner} 0 ${largeArc} 0 ${i1.x.toFixed(3)} ${i1.y.toFixed(3)}`,
    'Z',
  ].join(' ')
}

interface SegmentDef {
  level: number
  midAngle: number           // angle at segment centre
  path: string               // SVG path data
  labelPos: { x: number; y: number }
  iconPos:  { x: number; y: number }
}

function buildSegments(): SegmentDef[] {
  return Array.from({ length: NUM_LEVELS }, (_, i) => {
    const startDeg = ARC_START_DEG + i * SEG_SPAN + SEG_GAP / 2
    const endDeg   = startDeg + SEG_SPAN - SEG_GAP
    const midAngle = (startDeg + endDeg) / 2
    return {
      level: i,
      midAngle,
      path: makePath(startDeg, endDeg, INNER_R, OUTER_R),
      labelPos: polarToXY(midAngle, LABEL_R),
      iconPos:  polarToXY(midAngle, ICON_R),
    }
  })
}

const SEGMENTS = buildSegments()

// ─── Sparkle geometry (Elite only) ───────────────────────────────────────────
// 6 small stars burst outward from a point when Elite is selected

function makeSparklePoints(cx: number, cy: number, n = 6, r1 = 7, r2 = 14) {
  return Array.from({ length: n }, (_, i) => {
    const a = deg2rad(-90 + (360 / n) * i)
    return {
      x1: cx + r1 * Math.cos(a),
      y1: cy + r1 * Math.sin(a),
      x2: cx + r2 * Math.cos(a),
      y2: cy + r2 * Math.sin(a),
    }
  })
}

// ─── CSS keyframe injection ───────────────────────────────────────────────────
// We inject a tiny <style> once into the document head.

const KEYFRAME_ID = 'radial-picker-keyframes'

function injectKeyframes() {
  if (typeof document === 'undefined') return
  if (document.getElementById(KEYFRAME_ID)) return
  const style = document.createElement('style')
  style.id = KEYFRAME_ID
  style.textContent = `
@keyframes rp-orb-pulse {
  0%   { transform: scale(0.6); opacity: 0.4; }
  60%  { transform: scale(1.18); opacity: 1; }
  100% { transform: scale(1); }
}
@keyframes rp-orb-close {
  0%   { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.5); opacity: 0; }
}
@keyframes rp-select-flash {
  0%   { opacity: 0.9; }
  50%  { opacity: 0.35; }
  100% { opacity: 0; }
}
@keyframes rp-sparkle-burst {
  0%   { opacity: 1; stroke-width: 2; }
  70%  { opacity: 0.8; stroke-width: 1.5; }
  100% { opacity: 0; stroke-width: 0; }
}
`
  document.head.appendChild(style)
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  anchorEl: HTMLElement | null
  currentLevel: number
  onSelect: (level: number) => void
  onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RadialSkillPicker({ anchorEl, currentLevel, onSelect, onClose }: Props) {
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  // Centre coordinates in viewport (we anchor the SVG over the trigger)
  const [centre, setCentre] = useState<{ x: number; y: number } | null>(null)

  // open = segments visible; closing = exit animation running
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)

  // Per-segment animation state
  const [segScale, setSegScale] = useState<number[]>(Array(NUM_LEVELS).fill(0))
  const [segOpacity, setSegOpacity] = useState<number[]>(Array(NUM_LEVELS).fill(0))

  // Hover
  const [hoveredLevel, setHoveredLevel] = useState<number | null>(null)

  // Selection flash overlay
  const [flashLevel, setFlashLevel] = useState<number | null>(null)
  const [sparkle, setSparkle] = useState(false)

  // ── Measure anchor, then stagger segments in ────────────────────────────────
  useEffect(() => {
    injectKeyframes()
    if (!anchorEl) return
    const rect = anchorEl.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    setCentre({ x: cx, y: cy })
  }, [anchorEl])

  useEffect(() => {
    if (!centre) return
    setOpen(true)
    // Stagger each segment in with a spring
    SEGMENTS.forEach((_, i) => {
      setTimeout(() => {
        setSegScale(prev => { const n = [...prev]; n[i] = 1; return n })
        setSegOpacity(prev => { const n = [...prev]; n[i] = 1; return n })
      }, i * ANIM_STAGGER)
    })
  }, [centre])

  // ── Animated close ───────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    setOpen(false)
    // Collapse segments quickly
    setSegScale(Array(NUM_LEVELS).fill(0))
    setSegOpacity(Array(NUM_LEVELS).fill(0))
    setTimeout(() => onCloseRef.current(), ANIM_TOTAL_CLOSE)
  }, [closing])

  // ── Keyboard ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); handleClose() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [handleClose])

  // ── Select ───────────────────────────────────────────────────────────────────
  function handleSelect(level: number) {
    setFlashLevel(level)
    if (level === 4) setSparkle(true)
    onSelect(level)
    setTimeout(() => {
      setFlashLevel(null)
      setSparkle(false)
      handleClose()
    }, 220)
  }

  if (typeof document === 'undefined' || !centre) return null

  // SVG top-left so that (CX, CY) maps to the trigger centre
  const svgLeft = centre.x - CX
  const svgTop  = centre.y - CY

  // Clamp to viewport
  const clampedLeft = Math.max(4, Math.min(svgLeft, window.innerWidth  - SVG_SIZE - 4))
  const clampedTop  = Math.max(4, Math.min(svgTop,  window.innerHeight - SVG_SIZE - 4))

  return createPortal(
    <>
      {/* Backdrop — captures outside clicks */}
      <div
        className="fixed inset-0 z-[199]"
        aria-hidden="true"
        onClick={handleClose}
      />

      {/* SVG radial picker — floats over the cell */}
      <svg
        role="dialog"
        aria-modal="true"
        aria-label="Select skill level"
        width={SVG_SIZE}
        height={SVG_SIZE}
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        className="fixed z-[200] pointer-events-none overflow-visible"
        style={{
          top: clampedTop,
          left: clampedLeft,
        }}
      >
        {/* ── Segment definitions ─────────────────────────────────────────── */}
        <defs>
          {SEGMENTS.map(seg => {
            const color = LEVEL_COLORS[seg.level]
            return (
              <radialGradient
                key={seg.level}
                id={`rp-grad-${seg.level}`}
                cx="50%" cy="50%" r="50%"
                gradientUnits="userSpaceOnUse"
                fx={CX} fy={CY}
                // gradient from inner to outer
                gradientTransform={`translate(${CX},${CY}) scale(1)`}
              >
                <stop offset="0%" stopColor={color} stopOpacity="0.08" />
                <stop offset="100%" stopColor={color} stopOpacity="0.22" />
              </radialGradient>
            )
          })}
          {/* Drop-shadow filter for hover state */}
          <filter id="rp-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
            <feFlood floodOpacity="0.18" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="shadow" />
            <feMerge>
              <feMergeNode in="shadow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="rp-select-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ── Segments ────────────────────────────────────────────────────── */}
        {SEGMENTS.map((seg) => {
          const isHovered  = hoveredLevel === seg.level
          const isCurrent  = currentLevel  === seg.level
          const isFlashing = flashLevel    === seg.level
          const color      = LEVEL_COLORS[seg.level]

          // Scale: segment springs out from centre
          const baseScale   = segScale[seg.level]   // 0 → 1
          // Extra hover bounce: 1.07 scale, spring feel via transition
          const hoverBounce = isHovered ? 1.07 : 1

          // Transform origin is the SVG centre so segments appear to "grow" from the orb
          const transform = `translate(${CX}px,${CY}px) scale(${baseScale * hoverBounce}) translate(${-CX}px,${-CY}px)`

          return (
            <g
              key={seg.level}
              style={{
                transform,
                transformOrigin: `${CX}px ${CY}px`,
                opacity: segOpacity[seg.level],
                transition: open
                  ? `transform ${ANIM_OPEN_MS}ms cubic-bezier(0.34,1.56,0.64,1), opacity ${ANIM_OPEN_MS}ms ease-out`
                  : `transform ${ANIM_CLOSE_MS}ms cubic-bezier(0.4,0,1,1), opacity ${ANIM_CLOSE_MS}ms ease-in`,
                willChange: 'transform, opacity',
              }}
            >
              {/* Hit-area / clickable region */}
              <path
                d={seg.path}
                fill="transparent"
                stroke="none"
                className="pointer-events-auto cursor-pointer"
                onMouseEnter={() => setHoveredLevel(seg.level)}
                onMouseLeave={() => setHoveredLevel(null)}
                onClick={(e) => { e.stopPropagation(); handleSelect(seg.level) }}
              />

              {/* Visual fill */}
              <path
                d={seg.path}
                fill={isHovered || isCurrent ? color : `url(#rp-grad-${seg.level})`}
                fillOpacity={isHovered ? 0.22 : isCurrent ? 0.18 : 1}
                stroke={color}
                strokeWidth={isHovered || isCurrent ? 1.5 : 0.75}
                strokeOpacity={isHovered || isCurrent ? 0.6 : 0.35}
                strokeLinejoin="round"
                filter={isHovered ? 'url(#rp-glow)' : undefined}
                style={{
                  transition: 'fill-opacity 80ms ease, stroke-opacity 80ms ease, stroke-width 80ms ease',
                  pointerEvents: 'none',
                }}
              />

              {/* Selection flash overlay */}
              {isFlashing && (
                <path
                  d={seg.path}
                  fill={color}
                  fillOpacity={0.45}
                  stroke="none"
                  filter="url(#rp-select-glow)"
                  style={{
                    animation: `rp-select-flash 200ms ease-out forwards`,
                    pointerEvents: 'none',
                  }}
                />
              )}

              {/* Level number badge — tiny, near inner edge */}
              <text
                x={polarToXY(seg.midAngle, INNER_R + 10).x}
                y={polarToXY(seg.midAngle, INNER_R + 10).y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="9"
                fontWeight="700"
                fontFamily="ui-sans-serif,system-ui,sans-serif"
                fill={color}
                fillOpacity={isHovered || isCurrent ? 0.9 : 0.5}
                style={{
                  pointerEvents: 'none',
                  transition: 'fill-opacity 80ms ease',
                  userSelect: 'none',
                }}
              >
                {seg.level}
              </text>

              {/* Label text — near outer edge */}
              <text
                x={seg.labelPos.x}
                y={seg.labelPos.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={isHovered || isCurrent ? '10.5' : '9.5'}
                fontWeight={isHovered || isCurrent ? '700' : '500'}
                fontFamily="ui-sans-serif,system-ui,sans-serif"
                fill={isHovered || isCurrent ? color : '#6b7280'}
                style={{
                  pointerEvents: 'none',
                  transition: 'font-size 80ms ease, fill 80ms ease',
                  userSelect: 'none',
                }}
              >
                {LEVEL_LABELS[seg.level]}
              </text>

              {/* Current selection checkmark dot */}
              {isCurrent && !isFlashing && (
                <circle
                  cx={seg.iconPos.x}
                  cy={seg.iconPos.y}
                  r="3.5"
                  fill={color}
                  fillOpacity="0.85"
                  style={{ pointerEvents: 'none' }}
                />
              )}
            </g>
          )
        })}

        {/* ── Centre orb ──────────────────────────────────────────────────── */}
        <g
          style={{
            transformOrigin: `${CX}px ${CY}px`,
            animation: open ? `rp-orb-pulse 320ms cubic-bezier(0.34,1.56,0.64,1) both` : 'none',
          }}
        >
          {/* White backing disc — blank canvas for the existing indicator */}
          <circle cx={CX} cy={CY} r="19" fill="white" />
          {/* Thin ring border matching current level */}
          <circle
            cx={CX} cy={CY} r="19"
            fill="none"
            stroke={LEVEL_COLORS[currentLevel]}
            strokeWidth="1.5"
            strokeOpacity="0.45"
          />
          {/* SkillLevelIndicator rendered as foreignObject so we reuse the real component */}
          <foreignObject
            x={CX - 17}
            y={CY - 17}
            width="34"
            height="34"
            style={{ pointerEvents: 'none', overflow: 'visible' }}
          >
            {/* @ts-ignore — xmlns required for HTML inside SVG foreignObject */}
            <div xmlns="http://www.w3.org/1999/xhtml" style={{ width: 34, height: 34 }}>
              <SkillLevelIndicator level={currentLevel} size={34} strokeWidth={3} />
            </div>
          </foreignObject>
        </g>

        {/* ── Elite sparkle burst ─────────────────────────────────────────── */}
        {sparkle && (() => {
          const eliteSeg   = SEGMENTS[4]
          const sparklePos = polarToXY(eliteSeg.midAngle, MID_R)
          const pts        = makeSparklePoints(sparklePos.x, sparklePos.y, 7, 6, 16)
          return (
            <g style={{ pointerEvents: 'none' }}>
              {pts.map((p, i) => (
                <line
                  key={i}
                  x1={p.x1} y1={p.y1}
                  x2={p.x2} y2={p.y2}
                  stroke={LEVEL_COLORS[4]}
                  strokeWidth="2"
                  strokeLinecap="round"
                  style={{
                    animation: `rp-sparkle-burst 350ms ease-out ${i * 20}ms forwards`,
                    opacity: 0,
                  }}
                />
              ))}
            </g>
          )
        })()}
      </svg>
    </>,
    document.body
  )
}
