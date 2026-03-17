/**
 * OPEX Scenario Projector — 12-week forward cost projections.
 *
 * Models baseline (status quo), optimized (top actions applied),
 * and produces week-by-week cost forecasts with confidence bands.
 */

import type { CostBreakdown } from './opex'
import type { Advisory } from './opex-advisor'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScenarioWeek {
  week: number
  label: string
  cost: number
  lower: number     // -10% confidence band
  upper: number     // +10% confidence band
}

export interface Scenario {
  id: string
  name: string
  description: string
  weeks: ScenarioWeek[]
  totalCost: number
  avgWeeklyCost: number
  savingsVsBaseline?: number
}

export interface ScenarioComparison {
  baseline: Scenario
  optimized: Scenario
  totalSavings: number
  weeklyAvgSavings: number
  narrative: string
}

// ── Projection ───────────────────────────────────────────────────────────────

function weekLabel(weekOffset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + weekOffset * 7)
  const weekNum = getISOWeek(d)
  return `W${weekNum}`
}

function getISOWeek(d: Date): number {
  const date = new Date(d)
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
  const week1 = new Date(date.getFullYear(), 0, 4)
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}

export function projectScenarios(
  currentMonthCost: CostBreakdown,
  previousMonthCost: CostBreakdown,
  advisories: Advisory[],
): ScenarioComparison {
  const weeksToProject = 12
  const confidenceBand = 0.10 // ±10%

  // Weekly cost estimate from monthly
  const currentWeeklyCost = currentMonthCost.totalCost / 4.33
  const previousWeeklyCost = previousMonthCost.totalCost / 4.33

  // Trend: weekly cost change rate
  const trendRate = previousWeeklyCost > 0
    ? (currentWeeklyCost - previousWeeklyCost) / previousWeeklyCost / 4.33  // per-week growth rate
    : 0

  // Baseline: project forward with trend
  const baselineWeeks: ScenarioWeek[] = []
  for (let w = 1; w <= weeksToProject; w++) {
    const projected = currentWeeklyCost * Math.pow(1 + trendRate, w)
    baselineWeeks.push({
      week: w,
      label: weekLabel(w),
      cost: Math.round(projected),
      lower: Math.round(projected * (1 - confidenceBand)),
      upper: Math.round(projected * (1 + confidenceBand)),
    })
  }

  // Optimized: apply top 3 advisory savings progressively
  const topAdvisories = advisories.filter((a) => a.priority === 'high' || a.priority === 'medium').slice(0, 3)
  const weeklyAdvisorySaving = topAdvisories.reduce((s, a) => s + a.estimatedMonthlySaving / 4.33, 0)

  const optimizedWeeks: ScenarioWeek[] = []
  for (let w = 1; w <= weeksToProject; w++) {
    const baseProjected = currentWeeklyCost * Math.pow(1 + trendRate, w)
    // Savings ramp up linearly over first 4 weeks (implementation phase)
    const rampFactor = Math.min(1, w / 4)
    const saving = weeklyAdvisorySaving * rampFactor
    const projected = baseProjected - saving
    optimizedWeeks.push({
      week: w,
      label: weekLabel(w),
      cost: Math.round(Math.max(0, projected)),
      lower: Math.round(Math.max(0, projected * (1 - confidenceBand))),
      upper: Math.round(Math.max(0, projected * (1 + confidenceBand))),
    })
  }

  const baseline: Scenario = {
    id: 'baseline',
    name: 'Status Quo',
    description: 'Voortzetting van huidige personeelsmix en planning zonder wijzigingen.',
    weeks: baselineWeeks,
    totalCost: baselineWeeks.reduce((s, w) => s + w.cost, 0),
    avgWeeklyCost: Math.round(baselineWeeks.reduce((s, w) => s + w.cost, 0) / weeksToProject),
  }

  const optimized: Scenario = {
    id: 'optimized',
    name: 'Geoptimaliseerd',
    description: `Na uitvoering van ${topAdvisories.length} top-prioriteit aanbevelingen: ${topAdvisories.map((a) => a.title.toLowerCase()).join(', ')}.`,
    weeks: optimizedWeeks,
    totalCost: optimizedWeeks.reduce((s, w) => s + w.cost, 0),
    avgWeeklyCost: Math.round(optimizedWeeks.reduce((s, w) => s + w.cost, 0) / weeksToProject),
  }
  optimized.savingsVsBaseline = baseline.totalCost - optimized.totalCost

  const totalSavings = baseline.totalCost - optimized.totalCost
  const weeklyAvgSavings = Math.round(totalSavings / weeksToProject)

  const narrative = totalSavings > 0
    ? `Bij uitvoering van de top ${topAdvisories.length} aanbevelingen is de geschatte besparing over ${weeksToProject} weken €${totalSavings.toLocaleString('nl-NL')} (gemiddeld €${weeklyAvgSavings.toLocaleString('nl-NL')}/week). De besparingen bouwen op over de eerste 4 weken naarmate maatregelen effect krijgen.`
    : 'Huidige kostenstructuur is nagenoeg optimaal — minimale additionele besparingen beschikbaar.'

  return { baseline, optimized, totalSavings: Math.round(totalSavings), weeklyAvgSavings, narrative }
}
