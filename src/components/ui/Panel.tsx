interface PanelProps {
  children: React.ReactNode
  className?: string
  /** Pass a native HTML element tag — defaults to 'div' */
  as?: React.ElementType
}

/**
 * Dark cockpit panel — used in planner and data-dense areas.
 *
 * background: rgba(17,19,24,0.92)
 * border-radius: 16px
 * border: 1px solid rgba(255,255,255,0.06)
 */
export function Panel({ children, className = '', as: Tag = 'div' }: PanelProps) {
  return <Tag className={['ds-panel', className].filter(Boolean).join(' ')}>{children}</Tag>
}
