interface CardProps {
  children: React.ReactNode
  className?: string
  /** Pass a native HTML element tag — defaults to 'div' */
  as?: React.ElementType
}

/**
 * Glass-surface card.
 *
 * background: rgba(255,255,255,0.82)
 * backdrop-filter: blur(10px)
 * border: 1px solid rgba(255,255,255,0.6)
 * border-radius: 14px
 * shadow: 0 1px 2px rgba(0,0,0,0.04), 0 12px 30px rgba(0,0,0,0.08)
 */
export function Card({ children, className = '', as: Tag = 'div' }: CardProps) {
  return <Tag className={['ds-card', className].filter(Boolean).join(' ')}>{children}</Tag>
}
