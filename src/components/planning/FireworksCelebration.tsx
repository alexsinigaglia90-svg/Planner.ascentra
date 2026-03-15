'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useMemo } from 'react'

// ── Constants ────────────────────────────────────────────────────────────────

const COLORS = ['#4F6BFF', '#fbbf24', '#22C55E', '#A78BFA', '#EC4899', '#6C83FF', '#F59E0B', '#10B981']

const BURST_CONFIGS = [
  { cx: 25, cy: 30, color: '#fbbf24', delay: 0.3, particles: 22, radius: 90 },
  { cx: 50, cy: 25, color: '#4F6BFF', delay: 0.45, particles: 28, radius: 110 },
  { cx: 75, cy: 32, color: '#22C55E', delay: 0.6, particles: 20, radius: 85 },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean
  stats?: { created: number; coverage: number; open: number }
}

export default function FireworksCelebration({ visible, stats }: Props) {
  // Pre-compute all particle data to avoid random during render
  const particles = useMemo(() => {
    return BURST_CONFIGS.map((burst, bi) => ({
      ...burst,
      sparks: Array.from({ length: burst.particles }, (_, i) => {
        const angle = (i / burst.particles) * Math.PI * 2 + seededRandom(bi * 100 + i) * 0.3
        const dist = burst.radius * (0.5 + seededRandom(bi * 200 + i) * 0.5)
        const dx = Math.cos(angle) * dist
        const dy = Math.sin(angle) * dist - 20 // upward bias
        const gravity = 30 + seededRandom(bi * 300 + i) * 40
        const size = 3 + seededRandom(bi * 400 + i) * 4
        const color = COLORS[(bi * 3 + i) % COLORS.length]
        const dur = 0.8 + seededRandom(bi * 500 + i) * 0.6
        return { dx, dy, gravity, size, color, dur, angle }
      }),
      rays: Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2
        const length = burst.radius * 0.9
        return {
          x2: Math.cos(angle) * length,
          y2: Math.sin(angle) * length,
        }
      }),
    }))
  }, [])

  const raindrops = useMemo(() => {
    return Array.from({ length: 35 }, (_, i) => ({
      x: 5 + seededRandom(i * 77) * 90,
      delay: 1.0 + seededRandom(i * 88) * 1.0,
      dur: 0.8 + seededRandom(i * 99) * 0.6,
      size: 2 + seededRandom(i * 111) * 3,
      color: COLORS[i % COLORS.length],
    }))
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-2xl"
        >
          {/* Phase 1: Dim overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.15, 0.15, 0] }}
            transition={{ duration: 3, times: [0, 0.1, 0.7, 1] }}
            className="absolute inset-0 bg-black"
          />

          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              {/* Glow filters */}
              {BURST_CONFIGS.map((b, i) => (
                <radialGradient key={`glow-${i}`} id={`glow${i}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={b.color} stopOpacity="0.6" />
                  <stop offset="40%" stopColor={b.color} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={b.color} stopOpacity="0" />
                </radialGradient>
              ))}
            </defs>

            {/* Phase 1: Rockets rising */}
            {BURST_CONFIGS.map((burst, bi) => (
              <motion.line
                key={`rocket-${bi}`}
                x1={burst.cx}
                y1={100}
                x2={burst.cx}
                y2={burst.cy}
                stroke={burst.color}
                strokeWidth="0.8"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: [0, 1, 1], opacity: [0, 1, 0] }}
                transition={{ duration: burst.delay + 0.15, times: [0, 0.7, 1] }}
              />
            ))}

            {/* Rocket tips (glowing dots rising) */}
            {BURST_CONFIGS.map((burst, bi) => (
              <motion.circle
                key={`tip-${bi}`}
                cx={burst.cx}
                r="1.5"
                fill={burst.color}
                initial={{ cy: 100, opacity: 0 }}
                animate={{ cy: [100, burst.cy], opacity: [0, 1, 0] }}
                transition={{ duration: burst.delay, ease: 'easeOut' }}
              />
            ))}

            {/* Phase 2: Explosions */}
            {particles.map((burst, bi) => (
              <g key={`burst-${bi}`}>
                {/* Afterglow circle */}
                <motion.circle
                  cx={burst.cx}
                  cy={burst.cy}
                  r="20"
                  fill={`url(#glow${bi})`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 2, 2.5], opacity: [0, 0.8, 0] }}
                  transition={{ duration: 1.2, delay: burst.delay }}
                />

                {/* Ray tracing — light beams */}
                {burst.rays.map((ray, ri) => (
                  <motion.line
                    key={`ray-${bi}-${ri}`}
                    x1={burst.cx}
                    y1={burst.cy}
                    x2={burst.cx + ray.x2 * 0.01}
                    y2={burst.cy + ray.y2 * 0.01}
                    stroke={burst.color}
                    strokeWidth="0.3"
                    strokeLinecap="round"
                    opacity="0.5"
                    initial={{ x2: burst.cx, y2: burst.cy, opacity: 0 }}
                    animate={{
                      x2: [burst.cx, burst.cx + ray.x2],
                      y2: [burst.cy, burst.cy + ray.y2],
                      opacity: [0, 0.6, 0],
                    }}
                    transition={{ duration: 0.8, delay: burst.delay + 0.05 }}
                  />
                ))}

                {/* Explosion particles */}
                {burst.sparks.map((spark, si) => (
                  <motion.circle
                    key={`spark-${bi}-${si}`}
                    cx={burst.cx}
                    cy={burst.cy}
                    r={spark.size * 0.15}
                    fill={spark.color}
                    initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                    animate={{
                      x: [0, spark.dx * 0.4, spark.dx * 0.5],
                      y: [0, spark.dy * 0.4, spark.dy * 0.5 + spark.gravity * 0.3],
                      opacity: [0, 1, 0],
                      scale: [0, 1.5, 0],
                    }}
                    transition={{
                      duration: spark.dur,
                      delay: burst.delay + 0.05,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />
                ))}

                {/* Flash ring */}
                <motion.circle
                  cx={burst.cx}
                  cy={burst.cy}
                  r="1"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.5"
                  initial={{ r: 1, opacity: 0 }}
                  animate={{ r: [1, 15, 25], opacity: [0, 0.8, 0] }}
                  transition={{ duration: 0.6, delay: burst.delay }}
                />
              </g>
            ))}

            {/* Phase 4: Sparkle rain */}
            {raindrops.map((drop, i) => (
              <motion.circle
                key={`rain-${i}`}
                cx={drop.x}
                cy={0}
                r={drop.size * 0.12}
                fill={drop.color}
                initial={{ cy: 10 + seededRandom(i * 55) * 30, opacity: 0 }}
                animate={{
                  cy: [10 + seededRandom(i * 55) * 30, 90 + seededRandom(i * 66) * 15],
                  opacity: [0, 0.8, 0],
                }}
                transition={{ duration: drop.dur, delay: drop.delay }}
              />
            ))}
          </svg>

          {/* Phase 5: Victory stats */}
          {stats && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 1.5, type: 'spring', stiffness: 300, damping: 25 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] px-8 py-6 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  transition={{ delay: 1.6, duration: 0.5 }}
                  className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 mb-3"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <motion.path
                      d="M5 13l4 4L19 7"
                      stroke="#22C55E"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay: 1.8, duration: 0.4 }}
                    />
                  </svg>
                </motion.div>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.8 }}
                  className="text-lg font-bold text-gray-900 mb-1"
                >
                  Planning gegenereerd!
                </motion.p>
                <div className="flex items-center justify-center gap-6 mt-3">
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.0 }}>
                    <p className="text-2xl font-bold text-[#4F6BFF] tabular-nums">{stats.created}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-medium">Aangemaakt</p>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.1 }} className="w-px h-8 bg-gray-200" />
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.15 }}>
                    <p className="text-2xl font-bold text-emerald-600 tabular-nums">{stats.coverage}%</p>
                    <p className="text-[10px] text-gray-400 uppercase font-medium">Coverage</p>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.2 }} className="w-px h-8 bg-gray-200" />
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.25 }}>
                    <p className={`text-2xl font-bold tabular-nums ${stats.open > 0 ? 'text-red-500' : 'text-gray-300'}`}>{stats.open}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-medium">Open</p>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
