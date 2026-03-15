'use client'

import { motion } from 'framer-motion'
import { useMemo } from 'react'

type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface Props {
  state: OrbState
  size?: number
}

function sr(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}

export default function LuminousOrb({ state, size = 200 }: Props) {
  const coreR = size * 0.14
  const innerGlowR = size * 0.22
  const midGlowR = size * 0.32
  const outerGlowR = size * 0.45

  const isActive = state !== 'idle'
  const pulseSpeed = state === 'thinking' ? 0.6 : state === 'speaking' ? 1.0 : state === 'listening' ? 1.8 : 3.5
  const coreColor = state === 'thinking' ? '#7C3AED' : state === 'speaking' ? '#4F6BFF' : state === 'listening' ? '#6366F1' : '#4F6BFF'
  const secondaryColor = state === 'thinking' ? '#A78BFA' : state === 'speaking' ? '#818CF8' : '#6366F1'

  // Pre-compute particles
  const particles = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    angle: (i / 24) * 360,
    r: 0.45 + sr(i * 77) * 0.15,
    size: 1.5 + sr(i * 88) * 2.5,
    speed: 10 + sr(i * 99) * 8,
    color: ['#4F6BFF', '#A78BFA', '#818CF8', '#6366F1', '#7C3AED', '#4F6BFF'][i % 6],
    opacity: 0.3 + sr(i * 111) * 0.4,
  })), [])

  // Outer ring particles
  const outerParticles = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    angle: (i / 16) * 360,
    r: 0.55 + sr(i * 44) * 0.1,
    size: 0.8 + sr(i * 55) * 1.2,
    speed: 18 + sr(i * 66) * 10,
    color: ['#4F6BFF', '#A78BFA', '#818CF8'][i % 3],
  })), [])

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`${-size/2} ${-size/2} ${size} ${size}`}>
        <defs>
          <radialGradient id={`orbCore-${size}`} cx="38%" cy="32%">
            <stop offset="0%" stopColor="white" stopOpacity="0.95" />
            <stop offset="30%" stopColor={coreColor} stopOpacity="0.85" />
            <stop offset="70%" stopColor={coreColor} stopOpacity="0.5" />
            <stop offset="100%" stopColor={secondaryColor} stopOpacity="0.2" />
          </radialGradient>

          <radialGradient id={`orbInner-${size}`} cx="50%" cy="50%">
            <stop offset="0%" stopColor={coreColor} stopOpacity="0.6" />
            <stop offset="50%" stopColor={secondaryColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={coreColor} stopOpacity="0" />
          </radialGradient>

          <radialGradient id={`orbMid-${size}`} cx="50%" cy="50%">
            <stop offset="0%" stopColor={coreColor} stopOpacity="0.25" />
            <stop offset="60%" stopColor={secondaryColor} stopOpacity="0.08" />
            <stop offset="100%" stopColor={coreColor} stopOpacity="0" />
          </radialGradient>

          <radialGradient id={`orbOuter-${size}`} cx="50%" cy="50%">
            <stop offset="0%" stopColor={coreColor} stopOpacity="0.12" />
            <stop offset="40%" stopColor={secondaryColor} stopOpacity="0.04" />
            <stop offset="100%" stopColor={coreColor} stopOpacity="0" />
          </radialGradient>

          <filter id={`orbSoftGlow-${size}`}>
            <feGaussianBlur stdDeviation={size * 0.02} result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          <filter id={`orbHeavyGlow-${size}`}>
            <feGaussianBlur stdDeviation={size * 0.04} />
          </filter>
        </defs>

        {/* Layer 1: Outer ambient glow — slow breathing */}
        <motion.circle
          r={outerGlowR}
          fill={`url(#orbOuter-${size})`}
          animate={{
            r: [outerGlowR, outerGlowR * 1.12, outerGlowR],
            opacity: isActive ? [0.8, 1, 0.8] : [0.5, 0.7, 0.5],
          }}
          transition={{ duration: pulseSpeed * 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Layer 2: Mid glow — pulsing */}
        <motion.circle
          r={midGlowR}
          fill={`url(#orbMid-${size})`}
          filter={`url(#orbHeavyGlow-${size})`}
          animate={{
            r: [midGlowR, midGlowR * 1.15, midGlowR],
            opacity: isActive ? [0.7, 1, 0.7] : [0.4, 0.6, 0.4],
          }}
          transition={{ duration: pulseSpeed * 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Thinking: neural rings */}
        {state === 'thinking' && (
          <>
            <motion.circle r={size * 0.35} fill="none" stroke="#7C3AED" strokeWidth="0.6" strokeDasharray="4 6"
              opacity="0.4" filter={`url(#orbSoftGlow-${size})`}
              animate={{ rotate: [0, 360] }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} />
            <motion.circle r={size * 0.39} fill="none" stroke="#A78BFA" strokeWidth="0.4" strokeDasharray="2 10"
              opacity="0.25" filter={`url(#orbSoftGlow-${size})`}
              animate={{ rotate: [360, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'linear' }} />
            <motion.circle r={size * 0.42} fill="none" stroke="#4F6BFF" strokeWidth="0.3" strokeDasharray="1 12"
              opacity="0.15"
              animate={{ rotate: [0, 360] }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }} />
          </>
        )}

        {/* Speaking: ray traces */}
        {state === 'speaking' && Array.from({ length: 12 }, (_, i) => {
          const angle = (i / 12) * Math.PI * 2
          const len = size * 0.38
          return (
            <motion.line key={`ray-${i}`}
              x1={Math.cos(angle) * coreR * 1.8} y1={Math.sin(angle) * coreR * 1.8}
              x2={Math.cos(angle) * len} y2={Math.sin(angle) * len}
              stroke={i % 2 === 0 ? '#4F6BFF' : '#A78BFA'} strokeWidth="0.6" strokeLinecap="round"
              filter={`url(#orbSoftGlow-${size})`}
              animate={{ opacity: [0, 0.4, 0], x2: [Math.cos(angle) * coreR * 2, Math.cos(angle) * len] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.12, ease: 'easeOut' }}
            />
          )
        })}

        {/* Outer orbital particles — slow, wide orbit */}
        {outerParticles.map((p, i) => {
          const orbitR = p.r * size
          const spd = isActive ? p.speed * 0.6 : p.speed
          return (
            <motion.circle key={`op-${i}`} r={p.size * 0.6} fill={p.color} opacity={0.25}
              filter={`url(#orbSoftGlow-${size})`}
              animate={{
                cx: [Math.cos((p.angle * Math.PI) / 180) * orbitR, Math.cos(((p.angle + 360) * Math.PI) / 180) * orbitR],
                cy: [Math.sin((p.angle * Math.PI) / 180) * orbitR, Math.sin(((p.angle + 360) * Math.PI) / 180) * orbitR],
              }}
              transition={{ duration: spd, repeat: Infinity, ease: 'linear' }}
            />
          )
        })}

        {/* Inner orbital particles — closer, faster */}
        {particles.map((p, i) => {
          const orbitR = p.r * size * (state === 'thinking' ? 0.7 : 1)
          const spd = state === 'thinking' ? p.speed * 0.4 : isActive ? p.speed * 0.7 : p.speed
          return (
            <motion.circle key={`ip-${i}`} r={p.size} fill={p.color} opacity={isActive ? p.opacity * 1.5 : p.opacity}
              filter={`url(#orbSoftGlow-${size})`}
              animate={{
                cx: [Math.cos((p.angle * Math.PI) / 180) * orbitR, Math.cos(((p.angle + 360) * Math.PI) / 180) * orbitR],
                cy: [Math.sin((p.angle * Math.PI) / 180) * orbitR, Math.sin(((p.angle + 360) * Math.PI) / 180) * orbitR],
              }}
              transition={{ duration: spd, repeat: Infinity, ease: 'linear' }}
            />
          )
        })}

        {/* Layer 3: Inner glow */}
        <motion.circle
          r={innerGlowR}
          fill={`url(#orbInner-${size})`}
          filter={`url(#orbSoftGlow-${size})`}
          animate={{
            r: [innerGlowR, innerGlowR * 1.1, innerGlowR],
            opacity: state === 'thinking' ? [0.8, 1, 0.8] : [0.5, 0.8, 0.5],
          }}
          transition={{ duration: pulseSpeed, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Core */}
        <motion.circle
          r={coreR}
          fill={`url(#orbCore-${size})`}
          filter={`url(#orbSoftGlow-${size})`}
          animate={{ r: [coreR, coreR * 1.05, coreR] }}
          transition={{ duration: pulseSpeed, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Core highlight */}
        <circle cx={-coreR * 0.3} cy={-coreR * 0.35} r={coreR * 0.3} fill="white" opacity="0.35" />
      </svg>
    </div>
  )
}
