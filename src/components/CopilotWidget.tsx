'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useSidebar } from '@/components/ui/sidebar'

interface Props {
  score: number
  level: 'critical' | 'warning' | 'good' | 'excellent'
  insightCount: number
  topInsight?: string | null
}

const LEVEL_CONFIG = {
  critical: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', ring: 'rgba(239,68,68,0.3)', emoji: '🔴' },
  warning:  { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', ring: 'rgba(245,158,11,0.3)', emoji: '🟡' },
  good:     { color: '#22C55E', bg: 'rgba(34,197,94,0.12)',  ring: 'rgba(34,197,94,0.3)',  emoji: '🟢' },
  excellent:{ color: '#22C55E', bg: 'rgba(34,197,94,0.12)',  ring: 'rgba(34,197,94,0.3)',  emoji: '🟢' },
}

export default function CopilotWidget({ score, level, insightCount, topInsight }: Props) {
  const { open } = useSidebar()
  const config = LEVEL_CONFIG[level]

  // Collapsed: just the score circle
  if (!open) {
    return (
      <Link href="/copilot" className="flex items-center justify-center py-2 group" title={`Org Health: ${score}%`}>
        <div
          className="relative flex items-center justify-center w-9 h-9 rounded-full transition-transform group-hover:scale-110"
          style={{ background: config.bg }}
        >
          <svg viewBox="0 0 36 36" className="absolute inset-0 w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
            <circle cx="18" cy="18" r="14" fill="none" stroke={config.color} strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray={`${score} 100`} style={{ transition: 'stroke-dasharray 1s ease' }} />
          </svg>
          <span className="text-[9px] font-bold text-white tabular-nums">{score}</span>
        </div>
      </Link>
    )
  }

  // Expanded: score + summary
  return (
    <Link href="/copilot" className="block px-3 py-2 group">
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl p-3 transition-colors hover:bg-white/5"
        style={{ background: config.bg, border: `1px solid ${config.ring}` }}
      >
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-10 h-10 shrink-0">
            <svg viewBox="0 0 36 36" className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
              <circle cx="18" cy="18" r="14" fill="none" stroke={config.color} strokeWidth="2.5" strokeLinecap="round"
                strokeDasharray={`${score} 100`} style={{ transition: 'stroke-dasharray 1s ease' }} />
            </svg>
            <span className="text-xs font-bold text-white tabular-nums">{score}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-white/80">Org Health</p>
            {insightCount > 0 ? (
              <p className="text-[10px] text-white/40 truncate">{insightCount} tip{insightCount !== 1 ? 's' : ''}</p>
            ) : (
              <p className="text-[10px] text-white/40">Alles op orde</p>
            )}
          </div>
        </div>
        {topInsight && open && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-[10px] text-white/35 mt-2 leading-snug line-clamp-2"
          >
            {topInsight}
          </motion.p>
        )}
      </motion.div>
    </Link>
  )
}
