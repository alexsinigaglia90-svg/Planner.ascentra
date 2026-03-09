'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useCallback, useTransition } from 'react'

interface FilterOption {
  value: string
  label: string
}

interface CurrentFilters {
  from?: string
  to?: string
  userId?: string
  actionType?: string
  entityType?: string
}

interface Props {
  current: CurrentFilters
  actors: string[]
  actionTypes: FilterOption[]
  entityTypes: FilterOption[]
}

export default function AuditFiltersBar({ current, actors, actionTypes, entityTypes }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()

  const update = useCallback(
    (key: string, value: string) => {
      const merged: Record<string, string> = {}
      for (const [k, v] of Object.entries({ ...current, [key]: value })) {
        if (v) merged[k] = v
      }
      const params = new URLSearchParams(merged)
      startTransition(() => router.push(`${pathname}?${params.toString()}`))
    },
    [current, pathname, router],
  )

  const clear = useCallback(
    () => startTransition(() => router.push(pathname)),
    [pathname, router],
  )

  const hasFilters = Object.values(current).some(Boolean)

  const inputCls =
    'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors'

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4">
      {/* Date range */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">From</label>
        <input
          type="date"
          value={current.from ?? ''}
          onChange={(e) => update('from', e.target.value)}
          className={inputCls}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">To</label>
        <input
          type="date"
          value={current.to ?? ''}
          onChange={(e) => update('to', e.target.value)}
          className={inputCls}
        />
      </div>

      {/* User */}
      {actors.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">User</label>
          <select
            value={current.userId ?? ''}
            onChange={(e) => update('userId', e.target.value)}
            className={inputCls}
          >
            <option value="">All users</option>
            {actors.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      )}

      {/* Action type */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Action</label>
        <select
          value={current.actionType ?? ''}
          onChange={(e) => update('actionType', e.target.value)}
          className={inputCls}
        >
          <option value="">All actions</option>
          {actionTypes.map((at) => (
            <option key={at.value} value={at.value}>{at.label}</option>
          ))}
        </select>
      </div>

      {/* Entity type */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Entity</label>
        <select
          value={current.entityType ?? ''}
          onChange={(e) => update('entityType', e.target.value)}
          className={inputCls}
        >
          <option value="">All entities</option>
          {entityTypes.map((et) => (
            <option key={et.value} value={et.value}>{et.label}</option>
          ))}
        </select>
      </div>

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={clear}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  )
}
