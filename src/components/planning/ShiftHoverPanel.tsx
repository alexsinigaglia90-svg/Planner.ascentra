'use client'

import type { AssignmentWithRelations } from '@/lib/queries/assignments'

interface Props {
  assignment: AssignmentWithRelations
  employeeName: string
  employeeType: string
  hasViolation: boolean
  rect: DOMRect
}

export default function ShiftHoverPanel({
  assignment,
  employeeName,
  employeeType,
  hasViolation,
  rect,
}: Props) {
  const tpl = assignment.shiftTemplate

  // Panel height estimate — used to decide above vs below
  const PANEL_H = 130
  const showAbove = rect.top > PANEL_H + 12
  const top = showAbove ? rect.top - PANEL_H - 8 : rect.bottom + 8

  // Stay inside right viewport edge
  const left = Math.min(rect.left, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 224)

  return (
    <div
      style={{
        position: 'fixed',
        top,
        left,
        width: Math.max(rect.width, 208),
        zIndex: 9999,
      }}
      className="pointer-events-none"
      aria-hidden="true"
    >
      {/* Arrow */}
      <div
        className={[
          'absolute left-4 w-2.5 h-2.5 bg-gray-900 rotate-45',
          showAbove ? '-bottom-1' : '-top-1',
        ].join(' ')}
      />

      {/* Panel body */}
      <div className="relative bg-gray-900 rounded-xl shadow-2xl px-4 py-3 text-left overflow-hidden">
        {/* Top edge gloss */}
        <div className="absolute inset-x-0 top-0 h-px bg-white/10" />

        {/* Shift name */}
        <div className="text-sm font-semibold text-white leading-tight truncate">
          {tpl.name}
        </div>

        {/* Time */}
        <div className="mt-1.5 flex items-center gap-1.5 text-gray-300">
          <svg className="w-3 h-3 shrink-0" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2" />
            <path d="M5 3v2.2l1.4 1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-xs font-medium tabular-nums">
            {tpl.startTime}–{tpl.endTime}
          </span>
        </div>

        {/* Divider */}
        <div className="my-2.5 h-px bg-white/10" />

        {/* Employee */}
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-gray-200 truncate flex-1">
            {employeeName}
          </div>
          <span
            className={[
              'shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full',
              employeeType === 'internal'
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-orange-500/20 text-orange-300',
            ].join(' ')}
          >
            {employeeType}
          </span>
        </div>

        {/* Rotation violation warning */}
        {hasViolation && (
          <div className="mt-2 flex items-center gap-1.5 text-amber-400">
            <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="none">
              <path d="M6 1.5L11 10.5H1L6 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              <path d="M6 5.5v2M6 8.8h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <span className="text-[10px] font-semibold">Team rotation conflict</span>
          </div>
        )}

        {/* Future zone — reserved for conflict/AI/skill indicators */}
      </div>
    </div>
  )
}
