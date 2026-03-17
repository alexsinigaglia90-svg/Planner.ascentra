import { getCurrentContext } from '@/lib/auth/context'
import { computeCostBreakdown } from '@/lib/opex'
import { computeHealthScore } from '@/lib/opex-health'
import { computeEconomicsReport, type EconomicsInput } from '@/lib/opex-economics'
import { positionAll } from '@/lib/opex-benchmarks'
import { generateAdvisories, generateExecutiveBriefing } from '@/lib/opex-advisor'
import { projectScenarios } from '@/lib/opex-scenarios'
import { prisma } from '@/lib/db/client'
import { shiftDurationMinutes } from '@/lib/compliance'
import OpexDashboard from '@/components/settings/OpexDashboard'

function monthBounds(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month + 1, 0)
  const end = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
  return { start, end }
}

export default async function CostsPage() {
  const { orgId } = await getCurrentContext()
  const now = new Date()

  // ── Cost breakdowns (6 months) ──────────────────────────────────────────
  const months: { label: string; start: string; end: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const bounds = monthBounds(d.getFullYear(), d.getMonth())
    months.push({ label: d.toLocaleDateString('nl-NL', { month: 'short' }), ...bounds })
  }

  const breakdowns = await Promise.all(
    months.map((m) => computeCostBreakdown(orgId, m.start, m.end)),
  )

  const trend = months.map((m, i) => ({
    label: m.label,
    totalCost: breakdowns[i].totalCost,
    internalCost: breakdowns[i].internalCost,
    tempCost: breakdowns[i].tempCost,
    overtimeCost: breakdowns[i].overtimeCost,
  }))

  const current = breakdowns[breakdowns.length - 1]
  const previous = breakdowns[breakdowns.length - 2]

  // ── Fetch employee data for economics ───────────────────────────────────
  const currentMonth = months[months.length - 1]
  const [employees, assignments, auditCount] = await Promise.all([
    prisma.employee.findMany({
      where: { organizationId: orgId, status: 'active' },
      select: { id: true, name: true, employeeType: true, contractHours: true },
    }),
    prisma.assignment.findMany({
      where: { organizationId: orgId, rosterDay: { date: { gte: currentMonth.start, lte: currentMonth.end } } },
      include: { shiftTemplate: { select: { startTime: true, endTime: true } } },
    }),
    prisma.auditLog.count({
      where: { organizationId: orgId, createdAt: { gte: new Date(currentMonth.start) } },
    }),
  ])

  // Compute per-employee hours
  const empHoursMap = new Map<string, number>()
  for (const a of assignments) {
    const hrs = shiftDurationMinutes(a.shiftTemplate.startTime, a.shiftTemplate.endTime) / 60
    empHoursMap.set(a.employeeId, (empHoursMap.get(a.employeeId) ?? 0) + hrs)
  }

  // Estimate weeks active for temps
  const tempFirstSeen = new Map<string, string>()
  for (const a of assignments) {
    const emp = employees.find((e) => e.id === a.employeeId)
    if (emp?.employeeType === 'temp') {
      const existing = tempFirstSeen.get(a.employeeId)
      const date = (a as { rosterDayId: string }).rosterDayId // proxy
      if (!existing || date < existing) tempFirstSeen.set(a.employeeId, date)
    }
  }

  // Period weeks
  const periodDays = Math.max(1, (new Date(currentMonth.end).getTime() - new Date(currentMonth.start).getTime()) / 86400000 + 1)
  const periodWeeks = periodDays / 7

  const economicsEmployees: EconomicsInput['employees'] = employees.map((e) => {
    const planned = empHoursMap.get(e.id) ?? 0
    return {
      id: e.id,
      name: e.name,
      employeeType: e.employeeType as 'internal' | 'temp',
      contractHours: e.contractHours * periodWeeks,
      plannedHours: planned,
      weeklyHours: planned / Math.max(1, periodWeeks),
      weeksActive: e.employeeType === 'temp' ? Math.round(periodWeeks) : undefined,
    }
  })

  // ── Coverage rate ───────────────────────────────────────────────────────
  const totalRequired = current.totalHours > 0 ? current.totalHours + (current.totalHours * (current.potentialSavings > 0 ? 0.05 : 0)) : 0
  const coverageRate = totalRequired > 0 ? Math.min(1, current.totalHours / Math.max(1, totalRequired + current.totalHours * 0.05)) : 0.95

  // ── Health Score ────────────────────────────────────────────────────────
  const tempRatio = current.totalHours > 0 ? current.tempHours / current.totalHours : 0
  const overtimeRatio = current.totalHours > 0 ? current.overtimeHours / current.totalHours : 0
  const avgUtil = employees.filter((e) => e.employeeType === 'internal' && e.contractHours > 0).length > 0
    ? employees.filter((e) => e.employeeType === 'internal' && e.contractHours > 0)
        .reduce((sum, e) => sum + Math.min(1, (empHoursMap.get(e.id) ?? 0) / (e.contractHours * periodWeeks)), 0) /
      employees.filter((e) => e.employeeType === 'internal' && e.contractHours > 0).length
    : 0.85

  const costTrend = previous.totalCost > 0 ? (current.totalCost - previous.totalCost) / previous.totalCost : 0
  const changeRate = assignments.length > 0 ? Math.min(1, auditCount / (assignments.length * 2)) : 0.1

  const health = computeHealthScore({
    coverageRate: Math.max(0, Math.min(1, coverageRate)),
    tempRatio,
    overtimeRatio,
    avgUtilization: avgUtil,
    costPerFteTrend: costTrend,
    changeRate,
  })

  // ── Economics Report ────────────────────────────────────────────────────
  const economicsInput: EconomicsInput = {
    employees: economicsEmployees,
    totalHours: current.totalHours,
    internalHours: current.internalHours,
    tempHours: current.tempHours,
    overtimeHours: current.overtimeHours,
    coverageRate,
    totalRequired: Math.round(totalRequired),
    totalAssigned: Math.round(current.totalHours),
    internalHourlyRate: 18,
    tempHourlyRate: 28,
    overtimeMultiplier: 1.5,
    onboardingCostEstimate: 800,
  }

  const economics = computeEconomicsReport(economicsInput)

  // ── Benchmarks ──────────────────────────────────────────────────────────
  const fteCount = employees.filter((e) => e.employeeType === 'internal').length || 1
  const benchmarkMetrics: Record<string, number> = {
    cost_per_fte: current.totalCost / fteCount,
    avg_hourly_rate: current.avgCostPerHour,
    temp_premium_pct: current.tempHours > 0 ? ((28 - 18) / 18) * 100 : 0,
    temp_ratio: tempRatio * 100,
    overtime_ratio: overtimeRatio * 100,
    labor_utilization: avgUtil * 100,
    coverage_rate: coverageRate * 100,
    schedule_changes: changeRate * 100,
  }

  const benchmarks = positionAll(benchmarkMetrics)

  // ── Advisories ──────────────────────────────────────────────────────────
  const advisories = generateAdvisories(health, economics, current)

  // ── Executive Briefing ──────────────────────────────────────────────────
  const briefing = generateExecutiveBriefing(health, economics, current, benchmarks, advisories)

  // ── Scenarios ───────────────────────────────────────────────────────────
  const scenarios = projectScenarios(current, previous, advisories)

  return (
    <OpexDashboard
      current={current}
      previous={previous}
      trend={trend}
      health={health}
      economics={economics}
      benchmarks={benchmarks}
      advisories={advisories}
      briefing={briefing}
      scenarios={scenarios}
    />
  )
}
