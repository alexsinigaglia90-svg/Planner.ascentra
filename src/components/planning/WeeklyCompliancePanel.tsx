'use client'

import type { WeeklyCompliance, ContractStatus } from '@/lib/compliance'
import { Tooltip, EmptyState } from '@/components/ui'

interface Props {
  /** All weekly compliance results for the visible date range */
  weekly: Map<string, WeeklyCompliance>
  /** Employee id → display name lookup (to avoid passing full Employee objects) */
  employeeNames: Map<string, string>
}

const STATUS_BADGE: Record<ContractStatus, string> = {
  'on-target': 'bg-green-100 text-green-700',
  'under':     'bg-amber-100 text-amber-700',
  'over':      'bg-red-100   text-red-700',
}

const STATUS_LABEL: Record<ContractStatus, string> = {
  'on-target': 'On target',
  'under':     'Under',
  'over':      'Over',
}

export default function WeeklyCompliancePanel({ weekly, employeeNames }: Props) {
  if (weekly.size === 0) {
    return (
      <EmptyState
        compact
        title="Nog geen contractcompliance"
        description="Deze statistiek wordt zichtbaar zodra er planningdata beschikbaar is."
      />
    )
  }

  // Sort: over first → under → on-target; then alphabetical within each group
  const rows = [...weekly.values()].sort((a, b) => {
    const order: Record<ContractStatus, number> = { over: 0, under: 1, 'on-target': 2 }
    const diff = order[a.status] - order[b.status]
    if (diff !== 0) return diff
    return (employeeNames.get(a.employeeId) ?? '').localeCompare(
      employeeNames.get(b.employeeId) ?? '',
    )
  })

  const overCount   = rows.filter((r) => r.status === 'over').length
  const underCount  = rows.filter((r) => r.status === 'under').length
  const onCount     = rows.filter((r) => r.status === 'on-target').length

  return (
    <details className="group rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <summary className="flex cursor-pointer select-none items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors duration-150">
        <svg
          className="w-4 h-4 text-gray-400 transition-transform duration-200 group-open:rotate-90"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-sm font-semibold text-gray-800">Contract hours compliance</span>
        <div className="ml-auto flex items-center gap-2">
          {overCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
              {overCount} over
            </span>
          )}
          {underCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              {underCount} under
            </span>
          )}
          {onCount > 0 && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
              {onCount} on target
            </span>
          )}
        </div>
      </summary>

      <div className="border-t border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-2 text-left">Employee</th>
              <th className="px-4 py-2 text-right">
                <Tooltip text="Contractueel afgesproken aantal uren per week.">
                  <span>Contract</span>
                </Tooltip>
              </th>
              <th className="px-4 py-2 text-right">
                <Tooltip text="Daadwerkelijk ingeplande uren in deze periode.">
                  <span>Planned</span>
                </Tooltip>
              </th>
              <th className="px-4 py-2 text-right">
                <Tooltip text="Verschil tussen ingeplande en contracturen (positief = meer, negatief = minder).">
                  <span>Delta</span>
                </Tooltip>
              </th>
              <th className="px-4 py-2 text-left">
                <Tooltip text="Nalevingsstatus: on-target, under contract, of over contract.">
                  <span>Status</span>
                </Tooltip>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((wc) => (
              <tr key={wc.employeeId} className="hover:bg-gray-50/60 transition-colors duration-100">
                <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                  {employeeNames.get(wc.employeeId) ?? wc.employeeId}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">
                  {wc.contractLabel}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-800">
                  {wc.plannedLabel}
                </td>
                <td className={[
                  'px-4 py-2.5 text-right tabular-nums font-medium',
                  wc.status === 'on-target' ? 'text-green-600' :
                  wc.status === 'under'     ? 'text-amber-600' : 'text-red-600',
                ].join(' ')}>
                  {wc.deltaLabel}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[wc.status]}`}>
                    {STATUS_LABEL[wc.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
