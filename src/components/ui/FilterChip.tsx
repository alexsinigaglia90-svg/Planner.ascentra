'use client'

import type { ReactNode } from 'react'

export interface FilterChipProps {
  active?: boolean
  onToggle?: () => void
  onDismiss?: () => void
  children: ReactNode
  className?: string
}

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function FilterChip({ active = false, onToggle, onDismiss, children, className = '' }: FilterChipProps) {
  const activeClass = active ? 'ds-filter-chip-active' : ''
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`ds-filter-chip ${activeClass} ${className}`}
    >
      {children}
      {active && onDismiss && (
        <span
          role="button"
          tabIndex={0}
          aria-label="Remove filter"
          onClick={(e) => { e.stopPropagation(); onDismiss() }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onDismiss() } }}
          className="flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
        >
          <CloseIcon />
        </span>
      )}
    </button>
  )
}
