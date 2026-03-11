'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'

/* ── RowActions container ─────────────────────────────────────────────────── */

export interface RowActionsProps {
  children: ReactNode
  className?: string
}

export function RowActions({ children, className = '' }: RowActionsProps) {
  return (
    <div className={`ds-row-actions ${className}`}>
      {children}
    </div>
  )
}

/* ── Single icon-button row action ───────────────────────────────────────── */

export interface RowActionButtonProps {
  icon: ReactNode
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

export function RowActionButton({ icon, label, onClick, danger = false, disabled = false }: RowActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`ds-row-action-btn ${danger ? 'ds-row-action-btn-danger' : ''}`}
    >
      {icon}
    </button>
  )
}

/* ── Overflow Menu (three-dot) ────────────────────────────────────────────── */

export interface OverflowMenuItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

export interface OverflowMenuProps {
  items: OverflowMenuItem[]
  align?: 'right' | 'left'
}

function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="8" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="13" cy="8" r="1.4" />
    </svg>
  )
}

export function OverflowMenu({ items, align = 'right' }: OverflowMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const alignClass = align === 'right' ? 'right-0' : 'left-0'

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ds-row-action-btn"
        aria-label="More actions"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <DotsIcon />
      </button>

      {open && (
        <div
          role="menu"
          className={`ds-menu top-full mt-1 ${alignClass}`}
          onClick={() => setOpen(false)}
        >
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={item.onClick}
              className={`ds-menu-item ${item.danger ? 'ds-menu-item-danger' : ''}`}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
