'use client'

import { type ReactNode, useId } from 'react'

export interface TableToolbarProps {
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  filters?: ReactNode
  actions?: ReactNode
  className?: string
}

function SearchIcon() {
  return (
    <svg
      className="ds-search-icon"
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8.5" cy="8.5" r="5.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13 13L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function TableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters,
  actions,
  className = '',
}: TableToolbarProps) {
  const inputId = useId()
  return (
    <div className={`ds-toolbar ${className}`}>
      {onSearchChange !== undefined && (
        <div className="ds-search-wrap">
          <SearchIcon />
          <input
            id={inputId}
            type="search"
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="ds-search-input"
            aria-label={searchPlaceholder}
          />
        </div>
      )}
      {filters && <div className="flex items-center gap-2 flex-wrap">{filters}</div>}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  )
}
