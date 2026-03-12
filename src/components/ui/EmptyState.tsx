'use client'

import { Button } from './Button'

// ---------------------------------------------------------------------------
// Inline SVG icon set — minimal, stroke-based
// ---------------------------------------------------------------------------

const ICON_PATHS: Record<string, React.ReactNode> = {
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  ),
  shifts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  filter: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  ),
  data: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  ),
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActionProps {
  label: string
  onClick?: () => void
}

export interface EmptyStateProps {
  /** Icon to display (omits icon when compact=true). */
  icon?: keyof typeof ICON_PATHS
  /** Main label — required. */
  title: string
  /** Supporting text beneath the title. */
  description?: string
  /** Primary (filled) action button. */
  primaryAction?: ActionProps
  /** Secondary (outlined) action button. */
  secondaryAction?: ActionProps
  /**
   * Compact mode — reduced padding and no icon.
   * Use for inline panel empty states (KPI panels, table sections).
   */
  compact?: boolean
  /**
   * Surface variant.
   * - 'light'  (default) — white/light background, dark text
   * - 'dark'   — planner dark cockpit background
   */
  surface?: 'light' | 'dark'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  compact = false,
  surface = 'light',
}: EmptyStateProps) {
  const classes = [
    'ds-empty-state',
    compact ? 'ds-empty-state-compact' : '',
    surface === 'dark' ? 'ds-empty-state--dark' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={classes} role="status">
      {!compact && icon && ICON_PATHS[icon] && (
        <span className="ds-empty-icon">{ICON_PATHS[icon]}</span>
      )}

      <p className="ds-empty-title">{title}</p>

      {description && (
        <p className="ds-empty-description">{description}</p>
      )}

      {(primaryAction || secondaryAction) && (
        <div className="ds-empty-actions">
          {primaryAction && (
            <Button variant="primary" size="sm" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="secondary" size="sm" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
