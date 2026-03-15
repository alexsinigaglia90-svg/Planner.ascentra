/**
 * Copilot Insight Engine — pure data-driven operational intelligence.
 *
 * Analyzes staffing, leave, skills, and costs to generate actionable advice.
 * No AI API calls — every insight is computed from existing data.
 *
 * Run server-side, called on page load or periodically.
 */

import { prisma } from '@/lib/db/client'

// ── Types ────────────────────────────────────────────────────────────────────

export interface Insight {
  type: 'cost_saving' | 'risk_warning' | 'training' | 'staffing' | 'compliance' | 'efficiency'
  priority: number  // 1=critical, 5=low
  title: string
  description: string
  action?: string
  estimatedSavings?: number  // €/month
  departmentId?: string
  departmentName?: string
  processId?: string
  employeeId?: string
  metadata?: Record<string, unknown>
}

export interface HealthScore {
  score: number  // 0-100
  level: 'critical' | 'warning' | 'good' | 'excellent'
  insights: Insight[]
  summary: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Main computation ─────────────────────────────────────────────────────────

export async function computeHealthScore(organizationId: string): Promise<HealthScore> {
  const today = isoToday()
  const weekEnd = addDays(today, 6)
  const monthEnd = addDays(today, 29)

  const insights: Insight[] = []

  // Fetch all data in parallel
  const [
    employees,
    templates,
    assignments,
    leaveRecords,
    processScores,
    processes,
    departments,
  ] = await Promise.all([
    prisma.employee.findMany({
      where: { organizationId, status: 'active' },
      select: { id: true, name: true, employeeType: true, contractHours: true, departmentId: true, teamId: true },
    }),
    prisma.shiftTemplate.findMany({
      where: { organizationId },
      select: { id: true, name: true, requiredEmployees: true, departmentId: true, startTime: true, endTime: true },
    }),
    prisma.assignment.findMany({
      where: {
        organizationId,
        rosterDay: { date: { gte: today, lte: weekEnd } },
      },
      select: { employeeId: true, shiftTemplateId: true, rosterDay: { select: { date: true } } },
    }),
    prisma.leaveRecord.findMany({
      where: {
        organizationId,
        status: { in: ['approved', 'pending'] },
        startDate: { lte: monthEnd },
        endDate: { gte: today },
      },
      select: { employeeId: true, startDate: true, endDate: true, type: true, category: true },
    }),
    prisma.employeeProcessScore.findMany({
      where: { organizationId },
      select: { employeeId: true, processId: true, level: true },
    }),
    prisma.process.findMany({
      where: { organizationId, active: true },
      select: { id: true, name: true, departmentId: true },
    }),
    prisma.department.findMany({
      where: { organizationId, archived: false },
      select: { id: true, name: true },
    }),
  ])

  const deptNames = new Map(departments.map((d) => [d.id, d.name]))
  const totalEmployees = employees.length
  const internalCount = employees.filter((e) => e.employeeType === 'internal').length
  const tempCount = employees.filter((e) => e.employeeType === 'temp').length

  // ── 1. Temp ratio analysis ─────────────────────────────────────────────
  if (totalEmployees > 0) {
    const tempRatio = tempCount / totalEmployees
    if (tempRatio > 0.3) {
      insights.push({
        type: 'cost_saving',
        priority: 2,
        title: 'Hoge temp inzet',
        description: `${Math.round(tempRatio * 100)}% van je bezetting bestaat uit uitzendkrachten (${tempCount} van ${totalEmployees}). Dit is significant duurder dan vast personeel.`,
        action: 'Overweeg vaste medewerkers aan te nemen voor structurele posities.',
        estimatedSavings: Math.round(tempCount * 200), // rough estimate
      })
    }
  }

  // ── 2. Leave/absence impact ────────────────────────────────────────────
  const activeLeave = leaveRecords.filter((r) => r.startDate <= today && r.endDate >= today)
  const absentPct = totalEmployees > 0 ? activeLeave.length / totalEmployees : 0
  if (absentPct > 0.15) {
    insights.push({
      type: 'risk_warning',
      priority: 1,
      title: 'Hoge afwezigheid',
      description: `${activeLeave.length} medewerkers (${Math.round(absentPct * 100)}%) zijn momenteel afwezig. Dit overschrijdt de 15% drempel.`,
      action: 'Controleer of vervanging nodig is voor de komende shifts.',
    })
  }

  // Future leave peaks
  for (let w = 1; w <= 4; w++) {
    const weekStart = addDays(today, w * 7)
    const weekEndDate = addDays(weekStart, 6)
    const onLeave = new Set<string>()
    for (const lr of leaveRecords) {
      if (lr.startDate <= weekEndDate && lr.endDate >= weekStart) onLeave.add(lr.employeeId)
    }
    const futurePct = totalEmployees > 0 ? onLeave.size / totalEmployees : 0
    if (futurePct > 0.2) {
      insights.push({
        type: 'staffing',
        priority: 2,
        title: `Hoge afwezigheid over ${w} ${w === 1 ? 'week' : 'weken'}`,
        description: `${onLeave.size} medewerkers (${Math.round(futurePct * 100)}%) zijn afwezig in die week. Plan nu vervanging.`,
        action: 'Overweeg temps aan te vragen of shifts te herverdelen.',
      })
      break // only show first critical week
    }
  }

  // ── 3. Skill matrix single-point-of-failure ────────────────────────────
  for (const proc of processes) {
    const trained = processScores.filter((s) => s.processId === proc.id && s.level >= 2)
    if (trained.length === 1) {
      const emp = employees.find((e) => e.id === trained[0].employeeId)
      insights.push({
        type: 'risk_warning',
        priority: 2,
        title: `Single point of failure: ${proc.name}`,
        description: `Alleen ${emp?.name ?? 'één medewerker'} is getraind (level ${trained[0].level}) op ${proc.name}. Als deze uitvalt, is er geen vervanging.`,
        action: `Train minimaal 1 extra medewerker op ${proc.name}.`,
        processId: proc.id,
        departmentId: proc.departmentId ?? undefined,
        departmentName: proc.departmentId ? deptNames.get(proc.departmentId) : undefined,
      })
    } else if (trained.length === 0 && processScores.some((s) => s.processId === proc.id)) {
      insights.push({
        type: 'training',
        priority: 1,
        title: `Geen getraind personeel: ${proc.name}`,
        description: `Niemand heeft level 2+ op ${proc.name}. Dit proces kan niet bemand worden met gekwalificeerd personeel.`,
        action: `Start direct een trainingsprogramma voor ${proc.name}.`,
        processId: proc.id,
      })
    }
  }

  // ── 4. Contract hours underutilization ─────────────────────────────────
  // Check employees with very low assignment counts this week
  const assignmentsByEmployee = new Map<string, number>()
  for (const a of assignments) {
    assignmentsByEmployee.set(a.employeeId, (assignmentsByEmployee.get(a.employeeId) ?? 0) + 1)
  }
  const underutilized = employees.filter((e) => {
    if (e.employeeType !== 'internal' || e.contractHours === 0) return false
    const assignCount = assignmentsByEmployee.get(e.id) ?? 0
    return assignCount === 0 && !activeLeave.some((l) => l.employeeId === e.id)
  })
  if (underutilized.length >= 3) {
    insights.push({
      type: 'efficiency',
      priority: 3,
      title: `${underutilized.length} medewerkers niet ingepland`,
      description: `${underutilized.map((e) => e.name).slice(0, 3).join(', ')}${underutilized.length > 3 ? ` +${underutilized.length - 3}` : ''} hebben deze week geen shifts. Je betaalt contracturen die niet worden benut.`,
      action: 'Plan deze medewerkers in of evalueer contracturen.',
      estimatedSavings: Math.round(underutilized.reduce((sum, e) => sum + e.contractHours * 15, 0) / 4), // rough weekly estimate / 4 for monthly
    })
  }

  // ── 5. Overstaffing detection ──────────────────────────────────────────
  // Check if any shift has more assignments than required this week
  const shiftAssignments = new Map<string, Set<string>>()
  for (const a of assignments) {
    const key = `${a.rosterDay.date}:${a.shiftTemplateId}`
    const set = shiftAssignments.get(key) ?? new Set()
    set.add(a.employeeId)
    shiftAssignments.set(key, set)
  }
  let overstaffedCount = 0
  for (const [key, empSet] of shiftAssignments) {
    const templateId = key.split(':')[1]
    const template = templates.find((t) => t.id === templateId)
    if (template && empSet.size > template.requiredEmployees) {
      overstaffedCount++
    }
  }
  if (overstaffedCount >= 3) {
    insights.push({
      type: 'cost_saving',
      priority: 3,
      title: 'Structurele overbezetting',
      description: `${overstaffedCount} shift-dag combinaties deze week zijn overbezet. Je zet meer mensen in dan nodig.`,
      action: 'Evalueer de bezetting en verlaag waar mogelijk.',
      estimatedSavings: Math.round(overstaffedCount * 50),
    })
  }

  // ── 6. Cross-training opportunities ────────────────────────────────────
  for (const dept of departments) {
    const deptProcesses = processes.filter((p) => p.departmentId === dept.id)
    const deptEmployees = employees.filter((e) => e.departmentId === dept.id && e.employeeType === 'internal')
    if (deptProcesses.length >= 2 && deptEmployees.length >= 3) {
      // Find employees only trained on 1 process
      const singleProcess = deptEmployees.filter((e) => {
        const scores = processScores.filter((s) => s.employeeId === e.id && s.level >= 2)
        return scores.length === 1
      })
      if (singleProcess.length >= 2) {
        insights.push({
          type: 'training',
          priority: 3,
          title: `Cross-training kans: ${dept.name}`,
          description: `${singleProcess.length} medewerkers in ${dept.name} zijn maar op 1 proces getraind. Cross-training verhoogt flexibiliteit en vermindert temp-afhankelijkheid.`,
          action: `Train ${singleProcess.slice(0, 2).map((e) => e.name).join(' en ')} op een extra proces.`,
          departmentId: dept.id,
          departmentName: dept.name,
        })
      }
    }
  }

  // ── Compute health score ───────────────────────────────────────────────
  let score = 100
  for (const insight of insights) {
    switch (insight.priority) {
      case 1: score -= 15; break
      case 2: score -= 8; break
      case 3: score -= 4; break
      case 4: score -= 2; break
      default: score -= 1; break
    }
  }
  score = Math.max(0, Math.min(100, score))

  const level: HealthScore['level'] =
    score >= 85 ? 'excellent' :
    score >= 65 ? 'good' :
    score >= 40 ? 'warning' :
    'critical'

  // Sort insights by priority (most critical first)
  insights.sort((a, b) => a.priority - b.priority)

  const summary =
    insights.length === 0 ? 'Alles ziet er goed uit — geen actiepunten.' :
    insights.length === 1 ? `1 aandachtspunt gevonden.` :
    `${insights.length} aandachtspunten gevonden.`

  return { score, level, insights, summary }
}

// ── Persist insights as advice records ───────────────────────────────────────

export async function syncInsightsToAdvice(organizationId: string, insights: Insight[]): Promise<void> {
  for (const insight of insights.slice(0, 10)) { // max 10 active at a time
    // Deduplicate: don't create if similar active advice exists
    const existing = await prisma.copilotAdvice.findFirst({
      where: {
        organizationId,
        type: insight.type,
        title: insight.title,
        status: { in: ['active', 'seen'] },
      },
    })
    if (existing) continue

    await prisma.copilotAdvice.create({
      data: {
        organizationId,
        type: insight.type,
        priority: insight.priority,
        title: insight.title,
        description: insight.description,
        action: insight.action ?? null,
        estimatedSavings: insight.estimatedSavings ?? null,
        departmentId: insight.departmentId ?? null,
        departmentName: insight.departmentName ?? null,
        processId: insight.processId ?? null,
        employeeId: insight.employeeId ?? null,
        metadata: insight.metadata ? JSON.stringify(insight.metadata) : null,
      },
    })
  }

  // Expire old advice that's no longer relevant (active > 14 days)
  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
  await prisma.copilotAdvice.updateMany({
    where: {
      organizationId,
      status: 'active',
      createdAt: { lt: twoWeeksAgo },
    },
    data: { status: 'expired' },
  })
}
