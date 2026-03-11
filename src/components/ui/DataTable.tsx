import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes, HTMLAttributes } from 'react'

/* ── Table Wrapper (scrollable glass card) ────────────────────────────────── */

export function TableWrap({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`ds-table-wrap ${className}`}>{children}</div>
}

/* ── <table> ─────────────────────────────────────────────────────────────── */

export function Table({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <table className={`ds-table ${className}`}>{children}</table>
}

/* ── <thead> ─────────────────────────────────────────────────────────────── */

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="ds-table-head">{children}</thead>
}

/* ── <th> ────────────────────────────────────────────────────────────────── */

interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'right' | 'center'
}

export function Th({ children, align = 'left', className = '', ...rest }: ThProps) {
  const alignClass = align === 'right' ? 'ds-table-th-right' : ''
  return (
    <th className={`ds-table-th ${alignClass} ${className}`} {...rest}>
      {children}
    </th>
  )
}

/* ── <tbody> ─────────────────────────────────────────────────────────────── */

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="ds-table-body">{children}</tbody>
}

/* ── <tr> ────────────────────────────────────────────────────────────────── */

interface TrProps extends HTMLAttributes<HTMLTableRowElement> {
  children: ReactNode
}

export function Tr({ children, className = '', ...rest }: TrProps) {
  return (
    <tr className={`ds-table-row ${className}`} {...rest}>
      {children}
    </tr>
  )
}

/* ── <td> ────────────────────────────────────────────────────────────────── */

type TdTier = 'primary' | 'secondary' | 'meta' | 'default'

interface TdProps extends TdHTMLAttributes<HTMLTableCellElement> {
  tier?: TdTier
}

const TIER_CLASS: Record<TdTier, string> = {
  primary:   'ds-table-td-primary',
  secondary: 'ds-table-td-secondary',
  meta:      'ds-table-td-meta',
  default:   '',
}

export function Td({ children, tier = 'default', className = '', ...rest }: TdProps) {
  return (
    <td className={`ds-table-td ${TIER_CLASS[tier]} ${className}`} {...rest}>
      {children}
    </td>
  )
}
