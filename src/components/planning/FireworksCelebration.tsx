'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useMemo } from 'react'

// ── Colors ───────────────────────────────────────────────────────────────────

const PALETTE = ['#4F6BFF', '#fbbf24', '#22C55E', '#A78BFA', '#EC4899', '#6C83FF', '#F59E0B', '#10B981', '#F472B6', '#818CF8']

// 5 bursts at different positions and times — staggered for cinematic feel
const BURSTS = [
  { cx: 20, cy: 28, color: '#fbbf24', delay: 0.6, count: 30, r: 28, secondary: '#F59E0B' },
  { cx: 50, cy: 20, color: '#4F6BFF', delay: 1.0, count: 40, r: 35, secondary: '#818CF8' },
  { cx: 80, cy: 26, color: '#22C55E', delay: 1.5, count: 28, r: 26, secondary: '#10B981' },
  { cx: 35, cy: 35, color: '#EC4899', delay: 2.1, count: 24, r: 22, secondary: '#F472B6' },
  { cx: 65, cy: 30, color: '#A78BFA', delay: 2.6, count: 26, r: 24, secondary: '#6C83FF' },
]

function sr(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean
  stats?: { created: number; coverage: number; open: number }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FireworksCelebration({ visible, stats }: Props) {
  const data = useMemo(() => BURSTS.map((b, bi) => ({
    ...b,
    sparks: Array.from({ length: b.count }, (_, i) => {
      const angle = (i / b.count) * Math.PI * 2 + sr(bi * 100 + i) * 0.4
      const dist = b.r * (0.4 + sr(bi * 200 + i) * 0.6)
      return {
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist * 0.8 - 8,
        grav: 10 + sr(bi * 300 + i) * 15,
        size: 0.3 + sr(bi * 400 + i) * 0.6,
        color: PALETTE[(bi * 3 + i) % PALETTE.length],
        dur: 1.4 + sr(bi * 500 + i) * 1.0,
        sparkDelay: sr(bi * 600 + i) * 0.15,
      }
    }),
    // Secondary smaller burst
    secondaryParticles: Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2
      const dist = b.r * 0.6
      return {
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist * 0.7,
        color: b.secondary,
        dur: 1.0 + sr(bi * 700 + i) * 0.5,
      }
    }),
    rays: Array.from({ length: 12 }, (_, i) => ({
      angle: (i / 12) * Math.PI * 2,
      len: b.r * (0.7 + sr(bi * 800 + i) * 0.5),
    })),
  })), [])

  const rain = useMemo(() => Array.from({ length: 50 }, (_, i) => ({
    x: 3 + sr(i * 77) * 94,
    startY: 15 + sr(i * 55) * 25,
    delay: 2.0 + sr(i * 88) * 2.5,
    dur: 1.5 + sr(i * 99) * 1.0,
    size: 0.15 + sr(i * 111) * 0.35,
    color: PALETTE[i % PALETTE.length],
    drift: (sr(i * 222) - 0.5) * 8,
  })), [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-2xl"
        >
          {/* Cinematic dim — slower */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.2, 0.2, 0.1, 0] }}
            transition={{ duration: 6, times: [0, 0.08, 0.6, 0.85, 1] }}
            className="absolute inset-0 bg-gradient-to-b from-black/30 to-transparent"
          />

          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              {data.map((b, i) => (
                <radialGradient key={`g${i}`} id={`fg${i}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={b.color} stopOpacity="0.7" />
                  <stop offset="30%" stopColor={b.color} stopOpacity="0.3" />
                  <stop offset="60%" stopColor={b.secondary} stopOpacity="0.1" />
                  <stop offset="100%" stopColor={b.color} stopOpacity="0" />
                </radialGradient>
              ))}
              {/* Soft glow filter for "4K" feel */}
              <filter id="softglow">
                <feGaussianBlur stdDeviation="0.8" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Rockets — slow graceful rise */}
            {data.map((b, bi) => (
              <g key={`rk-${bi}`}>
                {/* Rocket trail glow */}
                <motion.line
                  x1={b.cx} y1={105} x2={b.cx} y2={b.cy}
                  stroke={b.color} strokeWidth="0.6" strokeLinecap="round" opacity="0.4"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: [0, 1, 1], opacity: [0, 0.4, 0] }}
                  transition={{ duration: b.delay + 0.3, times: [0, 0.6, 1], ease: 'easeOut' }}
                />
                {/* Rocket tip */}
                <motion.circle
                  cx={b.cx} r="1" fill={b.color} filter="url(#softglow)"
                  initial={{ cy: 105, opacity: 0 }}
                  animate={{ cy: [105, b.cy], opacity: [0, 1, 0.8, 0] }}
                  transition={{ duration: b.delay * 0.8, ease: 'easeOut' }}
                />
                {/* Tip trail sparkles */}
                {[0, 1, 2].map((ti) => (
                  <motion.circle
                    key={`tt-${bi}-${ti}`}
                    cx={b.cx + (sr(bi * 50 + ti) - 0.5) * 2} r="0.4" fill={b.secondary} opacity="0.6"
                    initial={{ cy: 105, opacity: 0 }}
                    animate={{ cy: [105, b.cy + 5 + ti * 3], opacity: [0, 0.6, 0] }}
                    transition={{ duration: b.delay * 0.7, delay: ti * 0.04 }}
                  />
                ))}
              </g>
            ))}

            {/* Explosions — each burst */}
            {data.map((b, bi) => (
              <g key={`ex-${bi}`}>
                {/* Afterglow — large, slow fade */}
                <motion.circle
                  cx={b.cx} cy={b.cy} r="15"
                  fill={`url(#fg${bi})`} filter="url(#softglow)"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 2.5, 3], opacity: [0, 0.9, 0] }}
                  transition={{ duration: 2.0, delay: b.delay, ease: 'easeOut' }}
                />

                {/* Flash */}
                <motion.circle
                  cx={b.cx} cy={b.cy} r="2" fill="white"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 3, 0], opacity: [0, 1, 0] }}
                  transition={{ duration: 0.4, delay: b.delay }}
                />

                {/* Ray tracing beams — soft light streaks */}
                {b.rays.map((ray, ri) => (
                  <motion.line
                    key={`ray-${bi}-${ri}`}
                    x1={b.cx} y1={b.cy}
                    x2={b.cx} y2={b.cy}
                    stroke={ri % 2 === 0 ? b.color : b.secondary}
                    strokeWidth="0.25" strokeLinecap="round" opacity="0.4"
                    filter="url(#softglow)"
                    initial={{ opacity: 0 }}
                    animate={{
                      x2: [b.cx, b.cx + Math.cos(ray.angle) * ray.len],
                      y2: [b.cy, b.cy + Math.sin(ray.angle) * ray.len],
                      opacity: [0, 0.5, 0],
                    }}
                    transition={{ duration: 1.2, delay: b.delay + 0.05, ease: 'easeOut' }}
                  />
                ))}

                {/* Expanding ring */}
                <motion.circle
                  cx={b.cx} cy={b.cy} r="1"
                  fill="none" stroke="white" strokeWidth="0.3"
                  initial={{ opacity: 0 }}
                  animate={{ r: [1, 20, 30], opacity: [0, 0.6, 0] }}
                  transition={{ duration: 1.0, delay: b.delay }}
                />
                <motion.circle
                  cx={b.cx} cy={b.cy} r="1"
                  fill="none" stroke={b.color} strokeWidth="0.2"
                  initial={{ opacity: 0 }}
                  animate={{ r: [1, 25, 35], opacity: [0, 0.3, 0] }}
                  transition={{ duration: 1.4, delay: b.delay + 0.1 }}
                />

                {/* Main particles — slower, with gravity */}
                {b.sparks.map((s, si) => (
                  <motion.circle
                    key={`sp-${bi}-${si}`}
                    cx={b.cx} cy={b.cy}
                    r={s.size} fill={s.color} filter="url(#softglow)"
                    initial={{ x: 0, y: 0, opacity: 0 }}
                    animate={{
                      x: [0, s.dx * 0.6, s.dx * 0.7],
                      y: [0, s.dy * 0.6, s.dy * 0.7 + s.grav],
                      opacity: [0, 1, 0.6, 0],
                    }}
                    transition={{
                      duration: s.dur,
                      delay: b.delay + s.sparkDelay,
                      ease: [0.22, 1, 0.36, 1],
                      times: [0, 0.3, 0.7, 1],
                    }}
                  />
                ))}

                {/* Secondary burst — smaller particles, slightly delayed */}
                {b.secondaryParticles.length > 0 && (
                  <>
                    {b.secondaryParticles.map((s2, si) => (
                      <motion.circle
                        key={`s2-${bi}-${si}`}
                        cx={b.cx} cy={b.cy}
                        r="0.25" fill={s2.color}
                        initial={{ x: 0, y: 0, opacity: 0 }}
                        animate={{
                          x: [0, s2.dx * 0.5],
                          y: [0, s2.dy * 0.5 + 8],
                          opacity: [0, 0.8, 0],
                        }}
                        transition={{ duration: s2.dur, delay: b.delay + 0.3 }}
                      />
                    ))}
                  </>
                )}
              </g>
            ))}

            {/* Sparkle rain — slow, drifting */}
            {rain.map((drop, i) => (
              <motion.circle
                key={`rn-${i}`}
                r={drop.size} fill={drop.color} opacity="0.7"
                filter="url(#softglow)"
                initial={{ cx: drop.x, cy: drop.startY, opacity: 0 }}
                animate={{
                  cx: [drop.x, drop.x + drop.drift],
                  cy: [drop.startY, 95],
                  opacity: [0, 0.7, 0.4, 0],
                }}
                transition={{ duration: drop.dur, delay: drop.delay, ease: 'easeIn' }}
              />
            ))}
          </svg>

          {/* Victory card — appears after fireworks peak */}
          {stats && (
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 3.2, type: 'spring', stiffness: 250, damping: 22 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_12px_48px_rgba(0,0,0,0.15)] px-10 py-7 text-center border border-white/50">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.15, 1] }}
                  transition={{ delay: 3.4, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 mb-4"
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <motion.path
                      d="M5 13l4 4L19 7"
                      stroke="#22C55E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay: 3.6, duration: 0.5 }}
                    />
                  </svg>
                </motion.div>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.5 }}
                  className="text-xl font-bold text-gray-900 mb-4">
                  Planning gegenereerd!
                </motion.p>
                <div className="flex items-center justify-center gap-8">
                  {[
                    { val: stats.created, label: 'Aangemaakt', color: 'text-[#4F6BFF]', d: 3.7 },
                    { val: `${stats.coverage}%`, label: 'Coverage', color: 'text-emerald-600', d: 3.85 },
                    { val: stats.open, label: 'Open', color: stats.open > 0 ? 'text-red-500' : 'text-gray-300', d: 4.0 },
                  ].map((kpi, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: kpi.d }}>
                      <p className={`text-3xl font-bold tabular-nums ${kpi.color}`}>{kpi.val}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider mt-0.5">{kpi.label}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
