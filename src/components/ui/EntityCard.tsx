import type { ReactNode } from 'react'
import { Avatar } from './Avatar'

/* ── EntityCard ───────────────────────────────────────────────────────────── */

export interface EntityCardProps {
  name: string
  subtitle?: string
  tags?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
  avatarDark?: boolean
  className?: string
}

export function EntityCard({
  name,
  subtitle,
  tags,
  actions,
  meta,
  avatarDark = false,
  className = '',
}: EntityCardProps) {
  return (
    <div className={`ds-entity-card ${className}`}>
      <div className="flex items-start gap-3">
        <Avatar name={name} dark={avatarDark} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-[#0B0B0C] truncate leading-snug">{name}</p>
              {subtitle && (
                <p className="mt-0.5 text-[12px] text-gray-400 truncate">{subtitle}</p>
              )}
            </div>
            {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
          </div>
          {tags && <div className="mt-2 flex flex-wrap gap-1.5">{tags}</div>}
          {meta && <div className="mt-2">{meta}</div>}
        </div>
      </div>
    </div>
  )
}

/* ── CardGrid ─────────────────────────────────────────────────────────────── */

export function CardGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`ds-card-grid ${className}`}>{children}</div>
}
