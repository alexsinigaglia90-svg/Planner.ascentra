import type { AuditStats } from '@/lib/queries/auditLog'

const ACTION_LABELS: Record<string, string> = {
  create_assignment: 'Create',
  update_assignment: 'Update',
  delete_assignment: 'Delete',
  move_assignment: 'Move',
  copy_assignment: 'Copy',
  copy_day: 'Copy Day',
  copy_week: 'Copy Week',
  copy_employee_week: 'Emp. Week',
  copy_employee_schedule: 'Emp. Schedule',
  repeat_pattern: 'Repeat',
  autofill: 'Auto-fill',
  'plan-wizard': 'Plan Wizard',
  update_requirement: 'Requirement',
  invite_user: 'Invite',
  update_member_role: 'Role Change',
  update_user_status: 'Status Change',
  remove_member: 'Remove Member',
  generate_invite_link: 'Invite Link',
  generate_reset_link: 'Reset Link',
  reset_password: 'Password Reset',
  ai_action: 'AI Action',
}

function StatCard({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string
  value: string | number
  sub?: string
  accent: string
  icon: React.ReactNode
}) {
  return (
    <div
      className="ds-stat-card p-5"
      style={{ '--stat-accent': accent } as React.CSSProperties}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            {label}
          </p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
          {sub && (
            <p className="text-[11px] text-gray-400">{sub}</p>
          )}
        </div>
        <div
          className="flex items-center justify-center w-10 h-10 rounded-xl"
          style={{ background: `${accent}14` }}
        >
          <div style={{ color: accent }}>{icon}</div>
        </div>
      </div>
    </div>
  )
}

export default function AuditStatsBar({ stats }: { stats: AuditStats }) {
  const topActionLabel = stats.topAction
    ? ACTION_LABELS[stats.topAction.type] ?? stats.topAction.type
    : '—'

  const topActionPct = stats.topAction && stats.totalThisWeek > 0
    ? `${Math.round((stats.topAction.count / stats.totalThisWeek) * 100)}% of total`
    : undefined

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Today"
        value={stats.totalToday}
        sub={`${stats.totalThisWeek} this week`}
        accent="#4F6BFF"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="10" />
          </svg>
        }
      />

      <StatCard
        label="Active Users"
        value={stats.activeUsers}
        sub="this week"
        accent="#22C55E"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        }
      />

      <StatCard
        label="Top Action"
        value={topActionLabel}
        sub={topActionPct}
        accent="#7C8CFF"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        }
      />

      <StatCard
        label="Bulk Operations"
        value={stats.bulkOps}
        sub="this week"
        accent="#F59E0B"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 3H8l-2 4h12L16 3z" />
          </svg>
        }
      />
    </div>
  )
}
