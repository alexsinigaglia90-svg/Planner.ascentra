import type { Metadata } from 'next'
import { getCurrentContext } from '@/lib/auth/context'
import { getAuditLogs, getAuditActors, getAuditStats } from '@/lib/queries/auditLog'
import AuditStatsBar from '@/components/audit/AuditStatsBar'
import AuditFiltersBar from '@/components/audit/AuditFiltersBar'
import AuditLogTable from '@/components/audit/AuditLogTable'
import AuditTimeline from '@/components/audit/AuditTimeline'

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
  { value: 'plan-wizard', label: 'Plan wizard' },
  { value: 'update_requirement', label: 'Update requirement' },
  { value: 'invite_user', label: 'Invite user' },
  { value: 'update_member_role', label: 'Change role' },
  { value: 'update_user_status', label: 'Change status' },
  { value: 'remove_member', label: 'Remove member' },
  { value: 'ai_action', label: 'AI action' },
]

const ENTITY_TYPES = [
  { value: 'assignment', label: 'Assignment' },
  { value: 'requirement', label: 'Requirement' },
  { value: 'bulk', label: 'Bulk operation' },
  { value: 'user', label: 'User' },
]

interface SearchParams {
  from?: string
  to?: string
  userId?: string
  actionType?: string
  entityType?: string
  view?: string
  page?: string
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const { orgId } = await getCurrentContext()

  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const view = sp.view === 'timeline' ? 'timeline' : 'table'

  const [result, actors, stats] = await Promise.all([
    getAuditLogs(orgId, {
      from: sp.from,
      to: sp.to,
      userId: sp.userId,
      actionType: sp.actionType,
      entityType: sp.entityType,
    }, page),
    getAuditActors(orgId),
    getAuditStats(orgId),
  ])

  return (
    <div className="max-w-6xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Audit Log</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track every change across your scheduling operations
        </p>
      </div>

      {/* Stats overview */}
      <AuditStatsBar stats={stats} />

      {/* Filters */}
      <AuditFiltersBar
        current={sp}
        actors={actors}
        actionTypes={ACTION_TYPES}
        entityTypes={ENTITY_TYPES}
        logs={result.logs}
        view={view}
      />

      {/* Log view */}
      {view === 'timeline' ? (
        <AuditTimeline
          logs={result.logs}
          actors={actors}
          total={result.total}
          page={result.page}
          totalPages={result.totalPages}
        />
      ) : (
        <AuditLogTable
          logs={result.logs}
          actors={actors}
          total={result.total}
          page={result.page}
          totalPages={result.totalPages}
        />
      )}
    </div>
  )
}
