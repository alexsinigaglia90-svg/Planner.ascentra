'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Insight } from '@/lib/copilot'

interface Props {
  insights: Insight[]
  maxVisible?: number
}

const TYPE_ICONS: Record<string, string> = {
  cost_saving: '💰',
  risk_warning: '⚠️',
  training: '📚',
  staffing: '👥',
  compliance: '⚖️',
  efficiency: '⚡',
}

const PRIORITY_COLORS: Record<number, string> = {
  1: 'border-red-200 bg-red-50/50',
  2: 'border-amber-200 bg-amber-50/40',
  3: 'border-blue-200 bg-blue-50/40',
  4: 'border-gray-200 bg-gray-50/40',
  5: 'border-gray-200 bg-gray-50/40',
}

export default function CopilotBar({ insights, maxVisible = 3 }: Props) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  const [expanded, setExpanded] = useState(false)

  const visible = insights.filter((_, i) => !dismissed.has(i))
  if (visible.length === 0) return null

  const shown = expanded ? visible : visible.slice(0, maxVisible)

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {shown.map((insight, displayIdx) => {
          const originalIdx = insights.indexOf(insight)
          return (
            <motion.div
              key={`${insight.title}-${originalIdx}`}
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex items-start gap-2.5 rounded-xl border px-4 py-2.5 ${PRIORITY_COLORS[insight.priority] ?? PRIORITY_COLORS[3]}`}
            >
              <span className="text-sm shrink-0 mt-0.5">{TYPE_ICONS[insight.type] ?? '💡'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-gray-800 leading-snug">{insight.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">{insight.description}</p>
                {insight.estimatedSavings && (
                  <p className="text-[10px] font-bold text-emerald-600 mt-1">
                    Geschatte besparing: €{insight.estimatedSavings}/maand
                  </p>
                )}
              </div>
              <button
                onClick={() => setDismissed((s) => new Set(s).add(originalIdx))}
                className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
                title="Verbergen"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10 4L4 10M4 4l6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
      {visible.length > maxVisible && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
        >
          {expanded ? 'Minder tonen' : `+${visible.length - maxVisible} meer`}
        </button>
      )}
    </div>
  )
}
