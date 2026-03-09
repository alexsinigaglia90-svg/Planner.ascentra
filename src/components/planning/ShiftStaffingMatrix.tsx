'use client'

import type { ShiftTemplate } from '@/lib/queries/shiftTemplates'
import type { StaffingEntry } from '@/lib/staffing'

interface Props {
  dates: string[]
  templates: ShiftTemplate[]
  staffingEntries: StaffingEntry[]
}

/** Approximate the same short date format used by the planning grid header. */
function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

function cellClass(status: StaffingEntry['status']): string {
  if (status === 'understaffed') return 'bg-red-50 text-red-700 border-red-100'
  if (status === 'overstaffed') return 'bg-amber-50 text-amber-700 border-amber-100'
  return 'bg-green-50 text-green-700 border-green-100'
}

function deltaLabel(entry: StaffingEntry): string {
  const delta = entry.assigned - entry.required
  if (delta === 0) return '✓'
  if (delta > 0) return `+${delta}`
  return `${delta}`
}

export default function ShiftStaffingMatrix({ dates, templates, staffingEntries }: Props) {
  if (templates.length === 0 || dates.length === 0) return null

  // Build fast lookup: templateId → date → StaffingEntry
  const lookup = new Map<string, Map<string, StaffingEntry>>()
  for (const entry of staffingEntries) {
    if (!lookup.has(entry.template.id)) lookup.set(entry.template.id, new Map())
    lookup.get(entry.template.id)!.set(entry.date, entry)
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-200 px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap min-w-[140px]">
              Shift
            </th>
            {dates.map((date) => (
              <th
                key={date}
                className="bg-gray-50 border-b border-r border-gray-200 px-2 py-2.5 text-center text-xs font-medium text-gray-500 whitespace-nowrap min-w-[72px]"
              >
                {formatShortDate(date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {templates.map((tpl) => {
            const byDate = lookup.get(tpl.id)
            return (
              <tr key={tpl.id} className="group">
                <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50/60 border-r border-gray-200 px-3 py-2 font-medium text-gray-800 whitespace-nowrap transition-colors">
                  <div>{tpl.name}</div>
                  <div className="text-gray-400 font-normal mt-0.5">{tpl.startTime}–{tpl.endTime}</div>
                </td>
                {dates.map((date) => {
                  const entry = byDate?.get(date)
                  if (!entry) {
                    return (
                      <td key={date} className="border-r border-gray-100 px-2 py-2 text-center text-gray-300">
                        –
                      </td>
                    )
                  }
                  return (
                    <td key={date} className="border-r border-gray-100 px-1.5 py-1.5 text-center">
                      <span
                        className={[
                          'inline-flex flex-col items-center rounded-md border px-2 py-1 leading-tight tabular-nums',
                          cellClass(entry.status),
                        ].join(' ')}
                        title={`${entry.template.name} on ${date}: ${entry.assigned} assigned / ${entry.required} required`}
                      >
                        <span className="font-semibold">{entry.assigned}/{entry.required}</span>
                        <span className="text-[10px] font-medium">{deltaLabel(entry)}</span>
                      </span>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
