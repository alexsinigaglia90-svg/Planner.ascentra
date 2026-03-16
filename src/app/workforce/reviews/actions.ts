'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { getCurrentContext, canMutate } from '@/lib/auth/context'

// ── Types ───────────────────────────────────────────────────────────────────

export type Verdict = 'improved' | 'same' | 'declined'

export interface ReviewQueueItem {
  employeeId: string
  employeeName: string
  employeeType: string
  department: string | null
  team: string | null
  processId: string
  processName: string
  processColor: string | null
  currentLevel: number
  lastReviewedAt: string | null  // ISO date or null
  daysSinceReview: number | null // null = never reviewed
}

export interface ReviewStats {
  totalReviews: number
  improved: number
  same: number
  declined: number
  levelUps: number
  levelDowns: number
}

export interface EmployeeTrend {
  employeeId: string
  employeeName: string
  department: string | null
  reviews: {
    processName: string
    verdict: Verdict
    previousLevel: number
    newLevel: number
    createdAt: string
  }[]
  improved: number
  same: number
  declined: number
}

export interface PeriodSummary {
  period: string
  improved: number
  same: number
  declined: number
  total: number
  levelUps: number
  levelDowns: number
}

// ── Review period helper ────────────────────────────────────────────────────

function currentPeriod(): string {
  const d = new Date()
  const q = Math.ceil((d.getMonth() + 1) / 3)
  return `${d.getFullYear()}-Q${q}`
}

// ── Get review queue ────────────────────────────────────────────────────────

export async function getReviewQueue(limit = 10): Promise<ReviewQueueItem[]> {
  const { orgId } = await getCurrentContext()

  // Get all employee-process scores with relations
  const scores = await prisma.employeeProcessScore.findMany({
    where: { organizationId: orgId, level: { gte: 1 } }, // only review employees with at least level 1
    include: {
      employee: {
        select: {
          id: true, name: true, employeeType: true, status: true,
          department: { select: { name: true } },
          team: { select: { name: true } },
        },
      },
      process: { select: { id: true, name: true, color: true, active: true } },
    },
  })

  // Filter to active employees and active processes
  const activeScores = scores.filter((s) => s.employee.status === 'active' && s.process.active)

  // Get the last review for each employee-process pair
  const lastReviews = await prisma.skillReview.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
    distinct: ['employeeId', 'processId'],
    select: { employeeId: true, processId: true, createdAt: true },
  })

  const reviewMap = new Map<string, Date>()
  for (const r of lastReviews) {
    reviewMap.set(`${r.employeeId}:${r.processId}`, r.createdAt)
  }

  const now = new Date()
  const items: ReviewQueueItem[] = activeScores.map((s) => {
    const lastReview = reviewMap.get(`${s.employeeId}:${s.processId}`)
    const daysSinceReview = lastReview
      ? Math.floor((now.getTime() - lastReview.getTime()) / 86400000)
      : null

    return {
      employeeId: s.employeeId,
      employeeName: s.employee.name,
      employeeType: s.employee.employeeType,
      department: s.employee.department?.name ?? null,
      team: s.employee.team?.name ?? null,
      processId: s.processId,
      processName: s.process.name,
      processColor: s.process.color,
      currentLevel: s.level,
      lastReviewedAt: lastReview?.toISOString() ?? null,
      daysSinceReview,
    }
  })

  // Smart priority sorting:
  // 1. Never reviewed (daysSinceReview === null) first
  // 2. Longest since last review
  // 3. Level 1 (in-training) gets priority boost
  items.sort((a, b) => {
    // Never reviewed first
    if (a.daysSinceReview === null && b.daysSinceReview !== null) return -1
    if (a.daysSinceReview !== null && b.daysSinceReview === null) return 1

    // Both never reviewed — level 1 (learning) first
    if (a.daysSinceReview === null && b.daysSinceReview === null) {
      if (a.currentLevel === 1 && b.currentLevel !== 1) return -1
      if (a.currentLevel !== 1 && b.currentLevel === 1) return 1
      return a.employeeName.localeCompare(b.employeeName)
    }

    // Both have reviews — priority boost for level 1
    const aPriority = (a.daysSinceReview ?? 0) + (a.currentLevel === 1 ? 30 : 0)
    const bPriority = (b.daysSinceReview ?? 0) + (b.currentLevel === 1 ? 30 : 0)
    return bPriority - aPriority // higher priority = more urgent
  })

  return items.slice(0, limit)
}

// ── Submit a review verdict ─────────────────────────────────────────────────

export async function submitReviewAction(
  employeeId: string,
  processId: string,
  verdict: Verdict,
): Promise<{ ok: true; newLevel: number; levelChanged: boolean } | { ok: false; error: string }> {
  const { orgId, userId, role } = await getCurrentContext()
  if (!canMutate(role)) return { ok: false, error: 'Geen toegang.' }

  try {
    // Get current level
    const score = await prisma.employeeProcessScore.findUnique({
      where: { employeeId_processId: { employeeId, processId } },
      select: { level: true },
    })
    if (!score) return { ok: false, error: 'Score niet gevonden.' }

    const previousLevel = score.level
    const period = currentPeriod()

    // Get recent reviews to calculate streak
    const recentReviews = await prisma.skillReview.findMany({
      where: { organizationId: orgId, employeeId, processId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { verdict: true },
    })

    // Calculate new streak including this verdict
    let streak = 1
    for (const r of recentReviews) {
      if (r.verdict === verdict) streak++
      else break
    }

    // Determine if level changes
    let newLevel = previousLevel
    let levelChanged = false

    if (verdict === 'improved' && streak >= 3 && previousLevel < 4) {
      newLevel = previousLevel + 1
      levelChanged = true
    } else if (verdict === 'declined' && streak >= 2 && previousLevel > 0) {
      newLevel = previousLevel - 1
      levelChanged = true
    }

    // Create review record and optionally update level
    await prisma.$transaction(async (tx) => {
      await tx.skillReview.create({
        data: {
          organizationId: orgId,
          employeeId,
          processId,
          previousLevel,
          verdict,
          newLevel,
          reviewedBy: userId,
          period,
        },
      })

      if (levelChanged) {
        await tx.employeeProcessScore.update({
          where: { employeeId_processId: { employeeId, processId } },
          data: { level: newLevel },
        })
      }
    })

    revalidatePath('/workforce/skills')
    revalidatePath('/workforce/reviews')
    return { ok: true, newLevel, levelChanged }
  } catch (err) {
    console.error('submitReviewAction error:', err)
    return { ok: false, error: 'Kon review niet opslaan.' }
  }
}

// ── Analytics: get stats for current period ─────────────────────────────────

export async function getReviewAnalytics(): Promise<{
  currentPeriod: ReviewStats
  periodTrends: PeriodSummary[]
  employeeTrends: EmployeeTrend[]
  topImprovers: { name: string; count: number }[]
}> {
  const { orgId } = await getCurrentContext()
  const period = currentPeriod()

  // Current period stats
  const currentReviews = await prisma.skillReview.findMany({
    where: { organizationId: orgId, period },
    select: { verdict: true, previousLevel: true, newLevel: true },
  })

  const currentPeriodStats: ReviewStats = {
    totalReviews: currentReviews.length,
    improved: currentReviews.filter((r) => r.verdict === 'improved').length,
    same: currentReviews.filter((r) => r.verdict === 'same').length,
    declined: currentReviews.filter((r) => r.verdict === 'declined').length,
    levelUps: currentReviews.filter((r) => r.newLevel > r.previousLevel).length,
    levelDowns: currentReviews.filter((r) => r.newLevel < r.previousLevel).length,
  }

  // Period trends (last 6 periods)
  const allReviews = await prisma.skillReview.findMany({
    where: { organizationId: orgId },
    select: { period: true, verdict: true, previousLevel: true, newLevel: true },
    orderBy: { createdAt: 'asc' },
  })

  const periodMap = new Map<string, PeriodSummary>()
  for (const r of allReviews) {
    const existing = periodMap.get(r.period) ?? { period: r.period, improved: 0, same: 0, declined: 0, total: 0, levelUps: 0, levelDowns: 0 }
    existing.total++
    if (r.verdict === 'improved') existing.improved++
    else if (r.verdict === 'same') existing.same++
    else existing.declined++
    if (r.newLevel > r.previousLevel) existing.levelUps++
    if (r.newLevel < r.previousLevel) existing.levelDowns++
    periodMap.set(r.period, existing)
  }
  const periodTrends = [...periodMap.values()].slice(-6)

  // Employee trends (recent reviews per employee)
  const employeeReviews = await prisma.skillReview.findMany({
    where: { organizationId: orgId },
    include: {
      employee: { select: { id: true, name: true, department: { select: { name: true } } } },
      process: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  const empMap = new Map<string, EmployeeTrend>()
  for (const r of employeeReviews) {
    const key = r.employeeId
    const existing = empMap.get(key) ?? {
      employeeId: r.employeeId,
      employeeName: r.employee.name,
      department: r.employee.department?.name ?? null,
      reviews: [],
      improved: 0,
      same: 0,
      declined: 0,
    }
    existing.reviews.push({
      processName: r.process.name,
      verdict: r.verdict as Verdict,
      previousLevel: r.previousLevel,
      newLevel: r.newLevel,
      createdAt: r.createdAt.toISOString(),
    })
    if (r.verdict === 'improved') existing.improved++
    else if (r.verdict === 'same') existing.same++
    else existing.declined++
    empMap.set(key, existing)
  }
  const employeeTrends = [...empMap.values()]

  // Top improvers
  const topImprovers = employeeTrends
    .map((e) => ({ name: e.employeeName, count: e.improved }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return { currentPeriod: currentPeriodStats, periodTrends, employeeTrends, topImprovers }
}
