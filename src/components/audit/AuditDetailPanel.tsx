'use client'

import type { AuditLog } from '@prisma/client'

// ---------------------------------------------------------------------------
// JSON diff rendering
// ---------------------------------------------------------------------------

interface DiffEntry {
  key: string
  type: 'added' | 'removed' | 'changed' | 'unchanged'
  before?: unknown
  after?: unknown
}

function computeDiff(before: Record<string, unknown> | null, after: Record<string, unknown> | null): DiffEntry[] {
  const entries: DiffEntry[] = []
  const allKeys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ])

  for (const key of allKeys) {
    const b = before?.[key]
    const a = after?.[key]

    if (b === undefined && a !== undefined) {
      entries.push({ key, type: 'added', after: a })
    } else if (b !== undefined && a === undefined) {
      entries.push({ key, type: 'removed', before: b })
    } else if (JSON.stringify(b) !== JSON.stringify(a)) {
      entries.push({ key, type: 'changed', before: b, after: a })
    }
  }

  return entries
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'string') return `"${v}"`
  if (typeof v === 'object') return JSON.stringify(v, null, 2)
  return String(v)
}

const DIFF_STYLES = {
  added: { bg: 'bg-emerald-50', text: 'text-emerald-700', prefix: '+', dot: 'bg-emerald-400' },
  removed: { bg: 'bg-red-50', text: 'text-red-700', prefix: '−', dot: 'bg-red-400' },
  changed: { bg: 'bg-amber-50', text: 'text-amber-700', prefix: '~', dot: 'bg-amber-400' },
  unchanged: { bg: '', text: 'text-gray-500', prefix: ' ', dot: 'bg-gray-300' },
} as const

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  log: AuditLog
  userName?: string
}

export default function AuditDetailPanel({ log, userName }: Props) {
  const before = safeParseJson(log.beforeData)
  const after = safeParseJson(log.afterData)
  const diff = computeDiff(before, after)
  const hasData = diff.length > 0 || before || after

  return (
    <div className="space-y-4 p-5 bg-gray-50/80 border-t border-gray-100">
      {/* Meta row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[13px]">
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Entity ID</p>
          <p className="text-gray-700 font-mono text-xs truncate" title={log.entityId}>{log.entityId}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">User</p>
          <p className="text-gray-700">{userName ?? log.userId}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Timestamp</p>
          <p className="text-gray-700 tabular-nums">
            {new Date(log.createdAt).toLocaleString('en-GB', {
              day: '2-digit', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
            })}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Entity Type</p>
          <p className="text-gray-700 capitalize">{log.entityType}</p>
        </div>
      </div>

      {/* Diff view */}
      {hasData ? (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Changes</p>
          </div>
          <div className="divide-y divide-gray-50">
            {diff.length > 0 ? (
              diff.map((entry) => {
                const style = DIFF_STYLES[entry.type]
                return (
                  <div key={entry.key} className={`px-4 py-2.5 flex items-start gap-3 ${style.bg}`}>
                    <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${style.text}`}>
                      {style.prefix}
                    </span>
                    <div className="min-w-0 flex-1 font-mono text-xs">
                      <span className="font-semibold text-gray-600">{entry.key}</span>
                      {entry.type === 'changed' && (
                        <>
                          <span className="text-red-500 line-through mx-2">{formatValue(entry.before)}</span>
                          <span className="text-gray-400 mx-1">&rarr;</span>
                          <span className="text-emerald-600 ml-1">{formatValue(entry.after)}</span>
                        </>
                      )}
                      {entry.type === 'added' && (
                        <span className="text-emerald-600 ml-2">{formatValue(entry.after)}</span>
                      )}
                      {entry.type === 'removed' && (
                        <span className="text-red-500 line-through ml-2">{formatValue(entry.before)}</span>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="px-4 py-6 text-center text-[13px] text-gray-400">
                {before && !after ? 'Snapshot (before state only)' :
                  !before && after ? 'Snapshot (after state only)' :
                    'No field-level changes recorded'}
              </div>
            )}
          </div>
          {/* Raw data fallback when no diff but data exists */}
          {diff.length === 0 && (before || after) && (
            <div className="px-4 py-3 border-t border-gray-100">
              <pre className="text-[11px] text-gray-500 font-mono whitespace-pre-wrap max-h-48 overflow-auto">
                {JSON.stringify(before ?? after, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-100 bg-white px-4 py-6 text-center">
          <p className="text-[13px] text-gray-400">No change data recorded for this entry</p>
        </div>
      )}
    </div>
  )
}

function safeParseJson(data: string | null | undefined): Record<string, unknown> | null {
  if (!data) return null
  try {
    const parsed = JSON.parse(data)
    return typeof parsed === 'object' && parsed !== null ? parsed : null
  } catch {
    return null
  }
}
