'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AssignmentWithRelations } from '@/lib/queries/assignments'

interface Props {
  assignment: AssignmentWithRelations
  employeeName: string
  employeeType: string
  teamName?: string
  hasViolation: boolean
  rect: DOMRect
}

export default function ShiftHoverPanel({
  assignment,
  employeeName,
  employeeType,
  teamName,
  hasViolation,
  rect,
}: Props) {
  // SSR safety — only activate after client mount
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  const tpl = assignment.shiftTemplate

  // Decide whether to show above or below the card
  const PANEL_H = teamName ? 168 : 148
  const showAbove = rect.top > PANEL_H + 16
  const top = showAbove ? rect.top - PANEL_H - 10 : rect.bottom + 10
  const left = Math.min(rect.left, window.innerWidth - 236)
  const width = Math.max(rect.width, 220)

  const panel = (
    <div
      style={{ position: 'fixed', top, left, width, zIndex: 9999, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      {/* Arrow caret pointing at card */}
      <div
        style={{
          position: 'absolute',
          left: 14,
          ...(showAbove ? { bottom: -5 } : { top: -5 }),
          width: 10,
          height: 10,
          background: '#0f172a',
          transform: 'rotate(45deg)',
          borderRadius: 2,
          boxShadow: showAbove
            ? '2px 2px 3px rgba(0,0,0,0.35)'
            : '-2px -2px 3px rgba(0,0,0,0.35)',
        }}
      />

      {/* Panel body — all inline styles so no Tailwind purge risk */}
      <div
        style={{
          background: '#0f172a',
          borderRadius: 12,
          boxShadow: '0 24px 56px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.07)',
          padding: '12px 14px 11px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Top-edge gloss */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.09)' }} />

        {/* Shift name */}
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tpl.name}
        </div>

        {/* Time row */}
        <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
            <circle cx="5.5" cy="5.5" r="4.2" stroke="#94a3b8" strokeWidth="1.2" />
            <path d="M5.5 3.2v2.4l1.5 1" stroke="#94a3b8" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 11, fontWeight: 500, color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>
            {tpl.startTime}–{tpl.endTime}
          </span>
        </div>

        {/* Divider */}
        <div style={{ margin: '9px 0', height: 1, background: 'rgba(255,255,255,0.07)' }} />

        {/* Employee row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {employeeName}
          </div>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 20,
            whiteSpace: 'nowrap',
            background: employeeType === 'internal' ? 'rgba(59,130,246,0.18)' : 'rgba(249,115,22,0.18)',
            color: employeeType === 'internal' ? '#93c5fd' : '#fdba74',
          }}>
            {employeeType}
          </span>
        </div>

        {/* Team / ploeg */}
        {teamName && (
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
              <circle cx="4" cy="4" r="2.2" stroke="#64748b" strokeWidth="1.1" />
              <circle cx="8.5" cy="4" r="1.6" stroke="#64748b" strokeWidth="1.1" />
              <path d="M1 10c.5-2 6-2 6 0" stroke="#64748b" strokeWidth="1.1" strokeLinecap="round" />
              <path d="M8.5 7c1.5.5 2 2 1.5 3" stroke="#64748b" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8' }}>{teamName}</span>
          </div>
        )}

        {/* Rotation-violation warning */}
        {hasViolation && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: 8, background: 'rgba(251,191,36,0.11)' }}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
              <path d="M5.5 1.5L10 9.5H1L5.5 1.5z" stroke="#fbbf24" strokeWidth="1.2" strokeLinejoin="round" />
              <path d="M5.5 5v2M5.5 8.3h.01" stroke="#fbbf24" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24' }}>Team rotation conflict</span>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(panel, document.body)
}
