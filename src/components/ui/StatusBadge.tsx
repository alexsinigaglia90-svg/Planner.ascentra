import type { ReactNode } from 'react'

export type BadgeVariant = 'success' | 'warning' | 'error' | 'neutral' | 'primary'

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  success: 'ds-badge-success',
  warning: 'ds-badge-warning',
  error:   'ds-badge-error',
  neutral: 'ds-badge-neutral',
  primary: 'ds-badge-primary',
}

const DOT_CLASS: Record<BadgeVariant, string> = {
  success: 'bg-green-500',
  warning: 'bg-amber-400',
  error:   'bg-red-500',
  neutral: 'bg-gray-400',
  primary: 'bg-[#4F6BFF]',
}

export interface StatusBadgeProps {
  variant: BadgeVariant
  children: ReactNode
  dot?: boolean
  className?: string
}

export function StatusBadge({ variant, children, dot = false, className = '' }: StatusBadgeProps) {
  return (
    <span className={`ds-badge ${VARIANT_CLASS[variant]} ${className}`}>
      {dot && (
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${DOT_CLASS[variant]}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  )
}
