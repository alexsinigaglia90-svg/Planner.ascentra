import type { AuditLog } from '@prisma/client'

// ---------------------------------------------------------------------------
// Display maps
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  create_assignment: 'Created',
  update_assignment: 'Updated',
  delete_assignment: 'Deleted',
  move_assignment: 'Moved',
  copy_assignment: 'Copied',
  copy_day: 'Copy Day',
  copy_week: 'Copy Week',
  copy_employee_week: 'Emp. Week',
  copy_employee_schedule: 'Emp. Schedule',
  repeat_pattern: 'Repeat',
  autofill: 'Auto-fill',
  update_requirement: 'Requirement',
}

const ACTION_COLOURS: Record<string, string> = {
  create_assignment: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  update_assignment: 'bg-blue-50 text-blue-700 border border-blue-100',
  delete_assignment: 'bg-red-50 text-red-700 border border-red-100',
  move_assignment: 'bg-violet-50 text-violet-700 border border-violet-100',
  copy_assignment: 'bg-sky-50 text-sky-700 border border-sky-100',
  copy_day: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
  copy_week: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
  copy_employee_week: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
  copy_employee_schedule: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
  repeat_pattern: 'bg-purple-50 text-purple-700 border border-purple-100',
  autofill: 'bg-teal-50 text-teal-700 border border-teal-100',
  update_requirement: 'bg-amber-50 text-amber-700 border border-amber-100',
}

const ENTITY_LABELS: Record<string, string> = {
  assignment: 'Assignment',
  requirement: 'Requirement',
  bulk: 'Bulk',
}

function formatTs(date: Date): string {
  return new Date(date).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

interface Props {
  logs: AuditLog[]
  compact?: boolean
}

export default function AuditLogTable({ logs, compact = false }: Props) {
  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 rounded-xl border border-gray-100 bg-white">
        <p className="text-sm text-gray-400">No entries found</p>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="space-y-1">
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex items-start gap-3 rounded-lg px-3 py-2.5 text-xs hover:bg-gray-50 transition-colors"
          >
            <span
              className={`shrink-0 mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${ACTION_COLOURS[log.actionType] ?? 'bg-gray-100 text-gray-600 border border-gray-200'}`}
            >
              {ACTION_LABELS[log.actionType] ?? log.actionType}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-gray-700 leading-snug truncate">{log.summary}</p>
              <p className="text-gray-400 tabular-nums mt-0.5">{formatTs(log.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/80">
              <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap w-48">
                Timestamp
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-28">
                Action
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-24">
                Entity
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Summary
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-40">
                User
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50/50 transition-colors duration-75">
                <td className="px-5 py-3 tabular-nums text-xs text-gray-400 whitespace-nowrap">
                  {formatTs(log.createdAt)}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${ACTION_COLOURS[log.actionType] ?? 'bg-gray-100 text-gray-600 border border-gray-200'}`}
                  >
                    {ACTION_LABELS[log.actionType] ?? log.actionType}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                  {ENTITY_LABELS[log.entityType] ?? log.entityType}
                </td>
                <td className="px-5 py-3 text-sm text-gray-700 max-w-lg">
                  {log.summary}
                </td>
                <td className="px-5 py-3 text-xs text-gray-400 font-mono truncate max-w-[10rem]">
                  {log.userId}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/40">
        <p className="text-xs text-gray-400">
          {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
          {logs.length === 150 ? ' — showing most recent 150' : ''}
        </p>
      </div>
    </div>
  )
}
