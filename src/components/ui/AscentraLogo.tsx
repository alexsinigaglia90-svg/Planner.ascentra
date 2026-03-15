'use client'

import { motion } from 'framer-motion'

interface LogoProps {
  size?: number
  animated?: boolean
  className?: string
}

/**
 * Ascentra "A" logo — SVG recreation of the brand mark.
 * Dark navy circle with white stylised "A" featuring a wave sweep at the base.
 *
 * When `animated` is true, the logo plays a draw-in animation:
 * circle fades in → A strokes draw → wave sweeps → subtle glow pulse.
 */
export function AscentraLogo({ size = 32, animated = false, className = '' }: LogoProps) {
  if (animated) {
    return (
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        {/* Circle background — fades in */}
        <motion.circle
          cx="50"
          cy="50"
          r="48"
          fill="#1B2A4A"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* A — left leg */}
        <motion.path
          d="M50 18L26 78"
          stroke="white"
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* A — right leg */}
        <motion.path
          d="M50 18L74 78"
          stroke="white"
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* A — crossbar */}
        <motion.path
          d="M34 56H66"
          stroke="white"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* Wave sweep at base — the distinctive curve */}
        <motion.path
          d="M26 78C30 68 40 64 50 68C60 72 68 78 74 78"
          stroke="white"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.85, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* Glow pulse ring */}
        <motion.circle
          cx="50"
          cy="50"
          r="48"
          stroke="#4F6BFF"
          strokeWidth="2"
          fill="none"
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: [0, 0.4, 0], scale: [1, 1.08, 1.12] }}
          transition={{ duration: 0.8, delay: 1.3, ease: 'easeOut' }}
        />
      </motion.svg>
    )
  }

  // Static version
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="50" cy="50" r="48" fill="#1B2A4A" />
      {/* Filled A shape with wave */}
      <path
        d="M50 18L26 78C30 68 40 64 50 68C60 72 68 78 74 78L50 18Z"
        fill="white"
      />
      {/* Triangle cutout for the A hole */}
      <path
        d="M50 38L40 58H60L50 38Z"
        fill="#1B2A4A"
      />
    </svg>
  )
}

/**
 * Full-screen loading splash with animated logo.
 */
export function AscentraLoadingSplash() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white">
      <AscentraLogo size={80} animated />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.4 }}
        className="mt-6 flex items-center gap-1.5"
      >
        <span className="text-lg font-bold text-[#1B2A4A] tracking-tight">Planner</span>
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Ascentra</span>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.3 }}
        className="mt-4"
      >
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[#4F6BFF]"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  )
}
