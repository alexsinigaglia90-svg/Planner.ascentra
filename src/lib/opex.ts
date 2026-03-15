/**
 * OPEX Cost Engine — computes workforce cost metrics.
 *
 * Uses configured hourly rates + actual assignments to calculate:
 * - Total labor cost per period
 * - Internal vs temp cost breakdown
 * - Cost per shift template
 * - Overtime costs
 * - Cost efficiency metrics
 */

import { prisma } from '@/lib/db/client'
import { shiftDurationMinutes } from '@/lib/compliance'

// ── Types ────────────────────────────────────────────────────────────────────

export interface CostConfig {
  internalHourlyRate: number
  tempHourlyRate: number
  overtimeMultiplier: number  // e.g. 1.5 = 150%
  currency: string
}

export interface CostBreakdown {
  totalCost: number
  internalCost: number
  tempCost: number
  overtimeCost: number
  totalHours: number
  internalHours: number
  tempHours: number
  overtimeHours: number
  costPerShift: { shiftName: string; cost: number; hours: number; assignments: number }[]
  costPerDepartment: { departmentName: string; cost: number; hours: number }[]
  avgCostPerHour: number
  tempPremium: number  // extra cost compared to if all were internal
  potentialSavings: number
}

const DEFAULT_CONFIG: CostConfig = {
  internalHourlyRate: 18,
  tempHourlyRate: 28,
  overtimeMultiplier: 1.5,
  currency: 'EUR',
}

// ── Main computation ─────────────────────────────────────────────────────────

export async function computeCostBreakdown(
  organizationId: string,
  startDate: string,
  endDate: string,
  config?: Partial<CostConfig>,
): Promise<CostBreakdown> {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  const assignments = await prisma.assignment.findMany({
    where: {
      organizationId,
      rosterDay: { date: { gte: startDate, lte: endDate } },
    },
    include: {
      employee: { select: { employeeType: true, contractHours: true, department: { select: { name: true } } } },
      shiftTemplate: { select: { name: true, startTime: true, endTime: true } },
    },
  })

  let internalHours = 0
  let tempHours = 0
  let overtimeHours = 0
  const shiftMap = new Map<string, { cost: number; hours: number; assignments: number }>()
  const deptMap = new Map<string, { cost: number; hours: number }>()

  // Track hours per employee for overtime detection
  const employeeHours = new Map<string, { total: number; contract: number; type: string }>()

  for (const a of assignments) {
    const minutes = shiftDurationMinutes(a.shiftTemplate.startTime, a.shiftTemplate.endTime)
    const hours = minutes / 60
    const isTemp = a.employee.employeeType === 'temp'

    // Accumulate employee hours
    const empEntry = employeeHours.get(a.employeeId) ?? { total: 0, contract: a.employee.contractHours, type: a.employee.employeeType }
    empEntry.total += hours
    employeeHours.set(a.employeeId, empEntry)

    if (isTemp) {
      tempHours += hours
    } else {
      internalHours += hours
    }

    // Per shift
    const shiftEntry = shiftMap.get(a.shiftTemplate.name) ?? { cost: 0, hours: 0, assignments: 0 }
    shiftEntry.hours += hours
    shiftEntry.cost += hours * (isTemp ? cfg.tempHourlyRate : cfg.internalHourlyRate)
    shiftEntry.assignments++
    shiftMap.set(a.shiftTemplate.name, shiftEntry)

    // Per department
    const deptName = a.employee.department?.name ?? 'Geen afdeling'
    const deptEntry = deptMap.get(deptName) ?? { cost: 0, hours: 0 }
    deptEntry.hours += hours
    deptEntry.cost += hours * (isTemp ? cfg.tempHourlyRate : cfg.internalHourlyRate)
    deptMap.set(deptName, deptEntry)
  }

  // Calculate overtime (hours over contract per week)
  // Simplified: if total > contractHours in the period, excess = overtime
  for (const [, emp] of employeeHours) {
    if (emp.type === 'internal' && emp.contract > 0) {
      // Rough weeks in period
      const periodDays = Math.max(1, (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000 + 1)
      const weeks = periodDays / 7
      const expectedHours = emp.contract * weeks
      if (emp.total > expectedHours) {
        overtimeHours += emp.total - expectedHours
      }
    }
  }

  const internalCost = internalHours * cfg.internalHourlyRate
  const tempCost = tempHours * cfg.tempHourlyRate
  const overtimeCost = overtimeHours * cfg.internalHourlyRate * (cfg.overtimeMultiplier - 1)
  const totalCost = internalCost + tempCost + overtimeCost
  const totalHours = internalHours + tempHours
  const avgCostPerHour = totalHours > 0 ? totalCost / totalHours : 0
  const tempPremium = tempHours * (cfg.tempHourlyRate - cfg.internalHourlyRate)
  const potentialSavings = tempPremium * 0.5 // conservative: could save 50% by converting temps

  return {
    totalCost: Math.round(totalCost),
    internalCost: Math.round(internalCost),
    tempCost: Math.round(tempCost),
    overtimeCost: Math.round(overtimeCost),
    totalHours: Math.round(totalHours * 10) / 10,
    internalHours: Math.round(internalHours * 10) / 10,
    tempHours: Math.round(tempHours * 10) / 10,
    overtimeHours: Math.round(overtimeHours * 10) / 10,
    costPerShift: Array.from(shiftMap.entries()).map(([name, data]) => ({
      shiftName: name, cost: Math.round(data.cost), hours: Math.round(data.hours * 10) / 10, assignments: data.assignments,
    })).sort((a, b) => b.cost - a.cost),
    costPerDepartment: Array.from(deptMap.entries()).map(([name, data]) => ({
      departmentName: name, cost: Math.round(data.cost), hours: Math.round(data.hours * 10) / 10,
    })).sort((a, b) => b.cost - a.cost),
    avgCostPerHour: Math.round(avgCostPerHour * 100) / 100,
    tempPremium: Math.round(tempPremium),
    potentialSavings: Math.round(potentialSavings),
  }
}
