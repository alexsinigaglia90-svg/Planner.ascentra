'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface HoldButtonProps {
  onConfirm: () => void
  holdDuration?: number
  label?: string
  holdLabel?: string
  confirmedLabel?: string
  tooltip?: string
  className?: string
  disabled?: boolean
  icon?: React.ReactNode
}

export function HoldButton({
  onConfirm,
  holdDuration = 1500,
  label = 'Confirm',
  holdLabel = 'Hold...',
  confirmedLabel = 'Done!',
  tooltip = 'Houd ingedrukt om te bevestigen',
  className,
  disabled = false,
  icon,
}: HoldButtonProps) {
  const [state, setState] = useState<'idle' | 'holding' | 'confirming' | 'confirmed'>('idle')
  const [progress, setProgress] = useState(0)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTime = useRef(0)

  function startHold() {
    if (state !== 'idle' || disabled) return
    setState('holding')
    setProgress(0)
    startTime.current = Date.now()

    progressInterval.current = setInterval(() => {
      const elapsed = Date.now() - startTime.current
      const pct = Math.min((elapsed / holdDuration) * 100, 100)
      setProgress(pct)
      if (pct >= 100) clearInterval(progressInterval.current!)
    }, 20)

    holdTimer.current = setTimeout(() => {
      setState('confirming')
      setProgress(100)
      onConfirm()
      setTimeout(() => {
        setState('confirmed')
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate?.(50)
        }
        setTimeout(() => { setState('idle'); setProgress(0) }, 2500)
      }, 400)
    }, holdDuration)
  }

  function cancelHold() {
    if (state !== 'holding') return
    if (holdTimer.current) clearTimeout(holdTimer.current)
    if (progressInterval.current) clearInterval(progressInterval.current)
    setProgress(0)
    setState('idle')
  }

  useEffect(() => {
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current)
      if (progressInterval.current) clearInterval(progressInterval.current)
    }
  }, [])

  const displayLabel = state === 'holding' ? holdLabel : state === 'confirming' ? '...' : state === 'confirmed' ? confirmedLabel : label

  return (
    <button
      type="button"
      title={state === 'idle' ? tooltip : undefined}
      onMouseDown={startHold}
      onMouseUp={cancelHold}
      onMouseLeave={cancelHold}
      onTouchStart={startHold}
      onTouchEnd={cancelHold}
      disabled={disabled || state === 'confirming'}
      className={cn(
        'relative inline-flex items-center justify-center gap-1.5 overflow-hidden select-none transition-all duration-200',
        'rounded-lg px-3 py-1.5 text-[11px] font-semibold',
        state === 'idle' && 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 cursor-pointer',
        state === 'holding' && 'bg-emerald-100 border border-emerald-300 text-emerald-800 cursor-grabbing scale-[0.97]',
        state === 'confirming' && 'bg-emerald-200 border border-emerald-300 text-emerald-800 opacity-80',
        state === 'confirmed' && 'bg-emerald-500 border border-emerald-600 text-white',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      {/* Progress ring */}
      {state === 'holding' && (
        <svg className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#A7F3D0" strokeWidth="3" />
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${progress} 100`}
            style={{ transition: 'stroke-dasharray 0.06s linear' }}
            transform="rotate(-90 18 18)" />
        </svg>
      )}

      {/* Confirmed checkmark */}
      {state === 'confirmed' && (
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: [0, 1.2, 1], rotate: 0 }}
          transition={{ duration: 0.35 }}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 7.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      )}

      {/* Icon (idle state) */}
      {state === 'idle' && icon}

      <span className={cn(
        'transition-all duration-200',
        state === 'holding' && 'pr-4',
      )}>
        {displayLabel}
      </span>
    </button>
  )
}
