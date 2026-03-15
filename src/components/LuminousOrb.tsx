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

export default function LuminousOrb({ state, size = 280 }: Props) {
  const half = size / 2
  const coreR = size * 0.11
  const innerR = size * 0.17
  const midR = size * 0.26
  const outerR = size * 0.36
  const atmosphereR = size * 0.46

  const isActive = state !== 'idle'
  const isThinking = state === 'thinking'
  const isSpeaking = state === 'speaking'
  const isListening = state === 'listening'

  const pulseBase = isThinking ? 0.5 : isSpeaking ? 0.8 : isListening ? 1.4 : 3.0

  const coreHue = isThinking ? '#8B5CF6' : isSpeaking ? '#6366F1' : isListening ? '#7C3AED' : '#4F6BFF'
  const glowHue = isThinking ? '#A78BFA' : isSpeaking ? '#818CF8' : isListening ? '#8B5CF6' : '#6366F1'
  const outerHue = isThinking ? '#C4B5FD' : isSpeaking ? '#A5B4FC' : '#A78BFA'

  // Inner orbit — 32 particles, close
  const innerParticles = useMemo(() => Array.from({ length: 32 }, (_, i) => ({
    angle: (i / 32) * 360,
    dist: 0.38 + sr(i * 77) * 0.08,
    size: 1.2 + sr(i * 88) * 2.8,
    speed: 8 + sr(i * 99) * 6,
    color: ['#4F6BFF', '#A78BFA', '#818CF8', '#6366F1', '#7C3AED', '#4F6BFF', '#C4B5FD', '#A5B4FC'][i % 8],
    glow: sr(i * 55) > 0.5,
  })), [])

  // Mid orbit — 20 particles
  const midParticles = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    angle: (i / 20) * 360 + 9,
    dist: 0.5 + sr(i * 33) * 0.06,
    size: 0.8 + sr(i * 44) * 1.5,
    speed: 14 + sr(i * 55) * 10,
    color: ['#4F6BFF', '#A78BFA', '#818CF8'][i % 3],
  })), [])

  // Outer haze — 12 large soft particles
  const outerHaze = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    angle: (i / 12) * 360 + 15,
    dist: 0.6 + sr(i * 22) * 0.08,
    size: 2 + sr(i * 33) * 3,
    speed: 20 + sr(i * 44) * 15,
    color: ['#4F6BFF', '#A78BFA'][i % 2],
  })), [])

  const uid = `orb-${size}`

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          {/* Core gradient — bright center */}
          <radialGradient id={`${uid}-core`} cx="42%" cy="36%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="20%" stopColor="#E8EDFF" stopOpacity="0.9" />
            <stop offset="50%" stopColor={coreHue} stopOpacity="0.7" />
            <stop offset="100%" stopColor={glowHue} stopOpacity="0.3" />
          </radialGradient>

          {/* Inner glow */}
          <radialGradient id={`${uid}-inner`} cx="50%" cy="50%">
            <stop offset="0%" stopColor={coreHue} stopOpacity="0.6" />
            <stop offset="50%" stopColor={glowHue} stopOpacity="0.25" />
            <stop offset="100%" stopColor={coreHue} stopOpacity="0" />
          </radialGradient>

          {/* Mid glow */}
          <radialGradient id={`${uid}-mid`} cx="50%" cy="50%">
            <stop offset="0%" stopColor={glowHue} stopOpacity="0.3" />
            <stop offset="50%" stopColor={outerHue} stopOpacity="0.1" />
            <stop offset="100%" stopColor={coreHue} stopOpacity="0" />
          </radialGradient>

          {/* Outer atmosphere */}
          <radialGradient id={`${uid}-atmo`} cx="50%" cy="50%">
            <stop offset="0%" stopColor={coreHue} stopOpacity="0.12" />
            <stop offset="40%" stopColor={outerHue} stopOpacity="0.05" />
            <stop offset="100%" stopColor={coreHue} stopOpacity="0" />
          </radialGradient>

          {/* Filters */}
          <filter id={`${uid}-soft`}><feGaussianBlur stdDeviation={size * 0.015} result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id={`${uid}-heavy`}><feGaussianBlur stdDeviation={size * 0.035} /></filter>
          <filter id={`${uid}-ultra`}><feGaussianBlur stdDeviation={size * 0.06} /></filter>
        </defs>

        {/* ═══ Layer 0: Atmosphere ═══ */}
        <motion.circle cx={half} cy={half} r={atmosphereR} fill={`url(#${uid}-atmo)`}
          animate={{ r: [atmosphereR, atmosphereR * 1.1, atmosphereR], opacity: isActive ? [0.8, 1, 0.8] : [0.4, 0.6, 0.4] }}
          transition={{ duration: pulseBase * 3, repeat: Infinity, ease: 'easeInOut' }} />

        {/* ═══ Layer 1: Outer haze particles ═══ */}
        {outerHaze.map((p, i) => {
          const r = p.dist * size
          const spd = isActive ? p.speed * 0.5 : p.speed
          return (
            <motion.circle key={`oh-${i}`} r={p.size} fill={p.color} opacity={isActive ? 0.2 : 0.1}
              filter={`url(#${uid}-heavy)`}
              animate={{
                cx: [half + Math.cos((p.angle * Math.PI) / 180) * r, half + Math.cos(((p.angle + 360) * Math.PI) / 180) * r],
                cy: [half + Math.sin((p.angle * Math.PI) / 180) * r, half + Math.sin(((p.angle + 360) * Math.PI) / 180) * r],
              }}
              transition={{ duration: spd, repeat: Infinity, ease: 'linear' }} />
          )
        })}

        {/* ═══ Neural rings (thinking) ═══ */}
        {isThinking && <>
          <motion.circle cx={half} cy={half} r={size * 0.34} fill="none" stroke="#8B5CF6" strokeWidth="1" strokeDasharray="5 7" opacity="0.4" filter={`url(#${uid}-soft)`}
            animate={{ rotate: [0, 360] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }} style={{ transformOrigin: `${half}px ${half}px` }} />
          <motion.circle cx={half} cy={half} r={size * 0.38} fill="none" stroke="#A78BFA" strokeWidth="0.7" strokeDasharray="3 10" opacity="0.3" filter={`url(#${uid}-soft)`}
            animate={{ rotate: [360, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} style={{ transformOrigin: `${half}px ${half}px` }} />
          <motion.circle cx={half} cy={half} r={size * 0.42} fill="none" stroke="#C4B5FD" strokeWidth="0.4" strokeDasharray="2 14" opacity="0.2"
            animate={{ rotate: [0, 360] }} transition={{ duration: 7, repeat: Infinity, ease: 'linear' }} style={{ transformOrigin: `${half}px ${half}px` }} />
        </>}

        {/* ═══ Speaking rays ═══ */}
        {isSpeaking && Array.from({ length: 16 }, (_, i) => {
          const angle = (i / 16) * Math.PI * 2
          const len = size * 0.4
          const startR = coreR * 2
          return (
            <motion.line key={`sr-${i}`}
              x1={half + Math.cos(angle) * startR} y1={half + Math.sin(angle) * startR}
              x2={half + Math.cos(angle) * len} y2={half + Math.sin(angle) * len}
              stroke={i % 3 === 0 ? '#4F6BFF' : i % 3 === 1 ? '#A78BFA' : '#818CF8'}
              strokeWidth={i % 4 === 0 ? '0.8' : '0.5'} strokeLinecap="round"
              filter={`url(#${uid}-soft)`}
              animate={{ opacity: [0, 0.5, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.1, ease: 'easeOut' }} />
          )
        })}

        {/* ═══ Listening pulse rings ═══ */}
        {isListening && <>
          <motion.circle cx={half} cy={half} r={midR} fill="none" stroke={coreHue} strokeWidth="1"
            animate={{ r: [midR, midR * 1.6, midR * 2], opacity: [0.4, 0.15, 0] }}
            transition={{ duration: 2, repeat: Infinity }} />
          <motion.circle cx={half} cy={half} r={midR} fill="none" stroke={glowHue} strokeWidth="0.6"
            animate={{ r: [midR, midR * 1.4, midR * 1.8], opacity: [0.3, 0.1, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.7 }} />
        </>}

        {/* ═══ Layer 2: Mid orbit particles ═══ */}
        {midParticles.map((p, i) => {
          const r = p.dist * size * (isThinking ? 0.8 : 1)
          const spd = isActive ? p.speed * 0.5 : p.speed
          return (
            <motion.circle key={`mp-${i}`} r={p.size} fill={p.color} opacity={isActive ? 0.45 : 0.25}
              filter={`url(#${uid}-soft)`}
              animate={{
                cx: [half + Math.cos((p.angle * Math.PI) / 180) * r, half + Math.cos(((p.angle + 360) * Math.PI) / 180) * r],
                cy: [half + Math.sin((p.angle * Math.PI) / 180) * r, half + Math.sin(((p.angle + 360) * Math.PI) / 180) * r],
              }}
              transition={{ duration: spd, repeat: Infinity, ease: 'linear' }} />
          )
        })}

        {/* ═══ Layer 3: Outer glow ═══ */}
        <motion.circle cx={half} cy={half} r={outerR} fill={`url(#${uid}-mid)`} filter={`url(#${uid}-ultra)`}
          animate={{ r: [outerR, outerR * 1.12, outerR], opacity: isActive ? [0.7, 1, 0.7] : [0.3, 0.5, 0.3] }}
          transition={{ duration: pulseBase * 2, repeat: Infinity, ease: 'easeInOut' }} />

        {/* ═══ Layer 4: Mid glow ═══ */}
        <motion.circle cx={half} cy={half} r={midR} fill={`url(#${uid}-inner)`} filter={`url(#${uid}-heavy)`}
          animate={{ r: [midR, midR * 1.15, midR], opacity: isActive ? [0.7, 1, 0.7] : [0.4, 0.65, 0.4] }}
          transition={{ duration: pulseBase * 1.3, repeat: Infinity, ease: 'easeInOut' }} />

        {/* ═══ Layer 5: Inner orbit particles ═══ */}
        {innerParticles.map((p, i) => {
          const r = p.dist * size * (isThinking ? 0.65 : 1)
          const spd = isThinking ? p.speed * 0.35 : isActive ? p.speed * 0.6 : p.speed
          return (
            <motion.circle key={`ip-${i}`} r={p.size} fill={p.color}
              opacity={isActive ? 0.7 : 0.35}
              filter={p.glow ? `url(#${uid}-soft)` : undefined}
              animate={{
                cx: [half + Math.cos((p.angle * Math.PI) / 180) * r, half + Math.cos(((p.angle + 360) * Math.PI) / 180) * r],
                cy: [half + Math.sin((p.angle * Math.PI) / 180) * r, half + Math.sin(((p.angle + 360) * Math.PI) / 180) * r],
              }}
              transition={{ duration: spd, repeat: Infinity, ease: 'linear' }} />
          )
        })}

        {/* ═══ Layer 6: Inner glow ═══ */}
        <motion.circle cx={half} cy={half} r={innerR} fill={`url(#${uid}-inner)`} filter={`url(#${uid}-soft)`}
          animate={{ r: [innerR, innerR * 1.12, innerR], opacity: isThinking ? [0.8, 1, 0.8] : [0.5, 0.8, 0.5] }}
          transition={{ duration: pulseBase, repeat: Infinity, ease: 'easeInOut' }} />

        {/* ═══ Layer 7: Core ═══ */}
        <motion.circle cx={half} cy={half} r={coreR} fill={`url(#${uid}-core)`} filter={`url(#${uid}-soft)`}
          animate={{ r: [coreR, coreR * 1.06, coreR] }}
          transition={{ duration: pulseBase, repeat: Infinity, ease: 'easeInOut' }} />

        {/* Core inner highlight */}
        <circle cx={half - coreR * 0.3} cy={half - coreR * 0.35} r={coreR * 0.28} fill="white" opacity="0.45" />
        <circle cx={half - coreR * 0.15} cy={half - coreR * 0.2} r={coreR * 0.12} fill="white" opacity="0.7" />
      </svg>
    </div>
  )
}
