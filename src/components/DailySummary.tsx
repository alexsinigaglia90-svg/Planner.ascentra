import { prisma } from '@/lib/db/client'
import { getCurrentContext } from '@/lib/auth/context'
import { computeHealthScore } from '@/lib/ascentrai'

function isoToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Goedemorgen'
  if (h < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

export default async function DailySummary() {
  try {
    const { orgId, userId } = await getCurrentContext()
    const today = isoToday()
    const weekEnd = addDays(today, 6)

    const [user, health, sickCount, leaveRequests, assignmentsThisWeek, totalEmployees] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
      computeHealthScore(orgId),
      prisma.leaveRecord.count({
        where: { organizationId: orgId, type: 'absence', status: 'approved', startDate: { lte: today }, endDate: { gte: today } },
      }),
      prisma.leaveRecord.count({
        where: { organizationId: orgId, type: 'leave', status: 'pending' },
      }),
      prisma.assignment.count({
        where: { organizationId: orgId, rosterDay: { date: { gte: today, lte: weekEnd } } },
      }),
      prisma.employee.count({ where: { organizationId: orgId, status: 'active' } }),
    ])

    const firstName = user?.name?.split(' ')[0] ?? ''
    const topInsights = health.insights.slice(0, 3)

    return (
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50/50 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{greeting()}{firstName ? `, ${firstName}` : ''}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative w-10 h-10">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#F3F4F6" strokeWidth="2.5" />
                <circle cx="18" cy="18" r="14" fill="none"
                  stroke={health.level === 'critical' ? '#EF4444' : health.level === 'warning' ? '#F59E0B' : '#22C55E'}
                  strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${health.score} 100`} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-900 tabular-nums">{health.score}</span>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex flex-wrap gap-4 mb-4 text-[13px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#4F6BFF]" />
            <span className="text-gray-600"><strong className="text-gray-900">{assignmentsThisWeek}</strong> shifts deze week</span>
          </div>
          {sickCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-gray-600"><strong className="text-red-600">{sickCount}</strong> ziek gemeld</span>
            </div>
          )}
          {leaveRequests > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-gray-600"><strong className="text-amber-600">{leaveRequests}</strong> verlofaanvra{leaveRequests === 1 ? 'ag' : 'gen'}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-gray-600"><strong className="text-gray-900">{totalEmployees}</strong> medewerkers actief</span>
          </div>
        </div>

        {/* Action items */}
        {topInsights.length > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Actiepunten</p>
            <div className="space-y-1.5">
              {topInsights.map((insight, i) => (
                <div key={i} className="flex items-start gap-2 text-[12px]">
                  <span className="text-gray-300 shrink-0 mt-px">{i + 1}.</span>
                  <span className="text-gray-600">{insight.title}</span>
                  {insight.estimatedSavings && (
                    <span className="text-[10px] text-emerald-600 font-bold shrink-0 ml-auto">&euro;{insight.estimatedSavings}/m</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  } catch {
    return null
  }
}
