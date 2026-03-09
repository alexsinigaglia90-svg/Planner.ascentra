import type { Metadata } from 'next'
import { getCurrentContext } from '@/lib/auth/context'
import { getAuditLogs, getAuditActors } from '@/lib/queries/auditLog'
import AuditFiltersBar from '@/components/audit/AuditFiltersBar'
import AuditLogTable from '@/components/audit/AuditLogTable'

export const metadata: Metadata = {
  title: 'Audit Log — Planner',
  description: 'Change history for scheduling operations',
}

const ACTION_TYPES = [
  { value: 'create_assignment', label: 'Create assignment' },
  { value: 'update_assignment', label: 'Update assignment' },
  { value: 'delete_assignment', label: 'Delete assignment' },
  { value: 'move_assignment', label: 'Move assignment' },
  { value: 'copy_assignment', label: 'Copy assignment' },
  { value: 'copy_day', label: 'Copy day' },
  { value: 'copy_week', label: 'Copy week' },
  { value: 'copy_employee_week', label: 'Copy employee week' },
  { value: 'copy_employee_schedule', label: 'Copy employee schedule' },
  { value: 'repeat_pattern', label: 'Repeat pattern' },
  { value: 'autofill', label: 'Auto-fill' },
  { value: 'update_requirement', label: 'Update requirement' },
]

const ENTITY_TYPES = [
  { value: 'assignment', label: 'Assignment' },
  { value: 'requirement', label: 'Requirement' },
  { value: 'bulk', label: 'Bulk operation' },
]

interface SearchParams {
  from?: string
  to?: string
  userId?: string
  actionType?: string
  entityType?: string
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const { orgId } = await getCurrentContext()

  const [logs, actors] = await Promise.all([
    getAuditLogs(orgId, {
      from: sp.from,
      to: sp.to,
      userId: sp.userId,
      actionType: sp.actionType,
      entityType: sp.entityType,
    }),
    getAuditActors(orgId),
  ])

  return (
    <div className="max-w-6xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Audit Log</h1>
        <p className="mt-1 text-sm text-gray-500">
          Change history for all scheduling operations
        </p>
      </div>

      {/* Filters */}
      <AuditFiltersBar
        current={sp}
        actors={actors}
        actionTypes={ACTION_TYPES}
        entityTypes={ENTITY_TYPES}
      />

      {/* Log table */}
      <AuditLogTable logs={logs} />
    </div>
  )
}
