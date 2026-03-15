'use client'

import { motion } from 'framer-motion'

type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface Props {
  state: OrbState
  size?: number
}

// ── Orbital particles ────────────────────────────────────────────────────────

function OrbitalParticles({ state, size }: { state: OrbState; size: number }) {
  const r = size * 0.55
  const count = 12
  const speed = state === 'thinking' ? 4 : state === 'listening' ? 8 : state === 'speaking' ? 6 : 14

  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * 360
        const particleR = state === 'thinking' ? r * 0.75 : r
        const particleSize = state === 'speaking' ? 2.5 : state === 'thinking' ? 2 : 1.5
        const colors = ['#4F6BFF', '#A78BFA', '#818CF8', '#6366F1', '#4F6BFF', '#8B5CF6', '#7C3AED', '#A78BFA', '#4F6BFF', '#6366F1', '#818CF8', '#A78BFA']

        return (
          <motion.circle
            key={i}
            r={particleSize}
            fill={colors[i % colors.length]}
            opacity={state === 'idle' ? 0.4 : state === 'thinking' ? 0.8 : 0.6}
            animate={{
              cx: [
                Math.cos((angle * Math.PI) / 180) * particleR,
                Math.cos(((angle + 360) * Math.PI) / 180) * particleR,
              ],
              cy: [
                Math.sin((angle * Math.PI) / 180) * particleR,
                Math.sin(((angle + 360) * Math.PI) / 180) * particleR,
              ],
            }}
            transition={{
              duration: speed,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        )
      })}
    </g>
  )
}

// ── Main orb ─────────────────────────────────────────────────────────────────

export default function LuminousOrb({ state, size = 120 }: Props) {
  const coreR = size * 0.18
  const glowR = size * 0.28
  const outerGlowR = size * 0.4

  const coreColor = state === 'thinking' ? '#818CF8' : state === 'speaking' ? '#6366F1' : state === 'listening' ? '#7C3AED' : '#4F6BFF'
  const pulseSpeed = state === 'thinking' ? 0.8 : state === 'speaking' ? 1.2 : state === 'listening' ? 1.5 : 3

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`${-size/2} ${-size/2} ${size} ${size}`}>
        <defs>
          {/* Core gradient */}
          <radialGradient id="orbCore" cx="40%" cy="35%">
            <stop offset="0%" stopColor="white" stopOpacity="0.9" />
            <stop offset="40%" stopColor={coreColor} stopOpacity="0.8" />
            <stop offset="100%" stopColor={coreColor} stopOpacity="0.4" />
          </radialGradient>

          {/* Inner glow */}
          <radialGradient id="orbGlow" cx="50%" cy="50%">
            <stop offset="0%" stopColor={coreColor} stopOpacity="0.5" />
            <stop offset="60%" stopColor={coreColor} stopOpacity="0.15" />
            <stop offset="100%" stopColor={coreColor} stopOpacity="0" />
          </radialGradient>

          {/* Outer ambient glow */}
          <radialGradient id="orbAmbient" cx="50%" cy="50%">
            <stop offset="0%" stopColor={coreColor} stopOpacity="0.2" />
            <stop offset="50%" stopColor="#A78BFA" stopOpacity="0.08" />
            <stop offset="100%" stopColor={coreColor} stopOpacity="0" />
          </radialGradient>

          {/* Softglow filter */}
          <filter id="orbBlur">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* Neural ring filter */}
          <filter id="neuralGlow">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
        </defs>

        {/* Outer ambient glow — breathing */}
        <motion.circle
          r={outerGlowR}
          fill="url(#orbAmbient)"
          animate={{
            r: [outerGlowR, outerGlowR * 1.15, outerGlowR],
            opacity: [0.6, 1, 0.6],
          }}
          transition={{ duration: pulseSpeed * 2, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Neural ring — appears during thinking */}
        {state === 'thinking' && (
          <motion.circle
            r={size * 0.35}
            fill="none"
            stroke="#818CF8"
            strokeWidth="0.8"
            strokeDasharray="3 5"
            opacity="0.5"
            filter="url(#neuralGlow)"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
        )}
        {state === 'thinking' && (
          <motion.circle
            r={size * 0.38}
            fill="none"
            stroke="#A78BFA"
            strokeWidth="0.5"
            strokeDasharray="2 8"
            opacity="0.3"
            filter="url(#neuralGlow)"
            animate={{ rotate: [360, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />
        )}

        {/* Speaking burst rays */}
        {state === 'speaking' && (
          <>
            {Array.from({ length: 8 }, (_, i) => {
              const angle = (i / 8) * Math.PI * 2
              const len = size * 0.32
              return (
                <motion.line
                  key={`ray-${i}`}
                  x1={Math.cos(angle) * coreR * 1.5}
                  y1={Math.sin(angle) * coreR * 1.5}
                  x2={Math.cos(angle) * len}
                  y2={Math.sin(angle) * len}
                  stroke="#A78BFA"
                  strokeWidth="0.8"
                  strokeLinecap="round"
                  filter="url(#neuralGlow)"
                  animate={{ opacity: [0, 0.5, 0], x2: [Math.cos(angle) * coreR * 2, Math.cos(angle) * len] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
                />
              )
            })}
          </>
        )}

        {/* Orbital particles */}
        <OrbitalParticles state={state} size={size} />

        {/* Inner glow — pulsing */}
        <motion.circle
          r={glowR}
          fill="url(#orbGlow)"
          filter="url(#orbBlur)"
          animate={{
            r: [glowR, glowR * 1.2, glowR],
            opacity: state === 'thinking' ? [0.6, 1, 0.6] : [0.4, 0.7, 0.4],
          }}
          transition={{ duration: pulseSpeed, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Core sphere */}
        <motion.circle
          r={coreR}
          fill="url(#orbCore)"
          filter="url(#orbBlur)"
          animate={{
            r: [coreR, coreR * 1.06, coreR],
          }}
          transition={{ duration: pulseSpeed, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Core highlight — top-left shine */}
        <circle
          cx={-coreR * 0.25}
          cy={-coreR * 0.3}
          r={coreR * 0.35}
          fill="white"
          opacity="0.3"
        />
      </svg>
    </div>
  )
}
