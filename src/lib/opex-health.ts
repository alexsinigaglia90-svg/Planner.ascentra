/**
 * OPEX Health Score Engine — composite organizational health metric.
 *
 * Produces a single 0-100 score from 6 weighted factors, each independently
 * scored and explained. Designed for C-level executive dashboards.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface HealthFactor {
  id: string
  label: string
  weight: number           // 0-1, sum = 1
  score: number            // 0-100
  weighted: number         // score × weight
  status: 'excellent' | 'good' | 'warning' | 'critical'
  detail: string           // natural language explanation
  actual: number
  optimal: number
}

export interface HealthScore {
  score: number            // 0-100 composite
  grade: string            // A+, A, B+, B, C+, C, D, F
  trend: 'improving' | 'stable' | 'declining'
  factors: HealthFactor[]
  summary: string          // executive one-liner
}

export interface HealthInput {
  coverageRate: number          // 0-1
  tempRatio: number             // 0-1 (among direct labor)
  overtimeRatio: number         // 0-1 (overtime hours / total hours)
  avgUtilization: number        // 0-1 (planned / contract across employees)
  costPerFteTrend: number       // slope: negative = improving
  changeRate: number            // 0-1 (schedule changes per week / total assignments)
  previousScore?: number        // for trend calculation
}

// ── Score computation ────────────────────────────────────────────────────────

function clamp01(v: number): number { return Math.max(0, Math.min(1, v)) }

function factorStatus(score: number): HealthFactor['status'] {
  if (score >= 85) return 'excellent'
  if (score >= 65) return 'good'
  if (score >= 40) return 'warning'
  return 'critical'
}

function gradeFromScore(score: number): string {
  if (score >= 95) return 'A+'
  if (score >= 88) return 'A'
  if (score >= 80) return 'B+'
  if (score >= 72) return 'B'
  if (score >= 64) return 'C+'
  if (score >= 55) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

export function computeHealthScore(input: HealthInput): HealthScore {
  const factors: HealthFactor[] = []

  // 1. Coverage Efficiency (25%)
  const coverageScore = Math.round(clamp01(input.coverageRate / 0.95) * 100)
  factors.push({
    id: 'coverage',
    label: 'Bezettingsgraad',
    weight: 0.25,
    score: coverageScore,
    weighted: coverageScore * 0.25,
    status: factorStatus(coverageScore),
    actual: Math.round(input.coverageRate * 100),
    optimal: 95,
    detail: input.coverageRate >= 0.95
      ? `Uitstekend: ${Math.round(input.coverageRate * 100)}% bezetting, boven de doelstelling van 95%.`
      : `${Math.round(input.coverageRate * 100)}% bezetting — ${Math.round((0.95 - input.coverageRate) * 100)}pp onder de doelstelling van 95%.`,
  })

  // 2. Temp Leverage (20%)
  const tempScore = Math.round(clamp01(1 - Math.max(0, (input.tempRatio - 0.15) / 0.35)) * 100)
  factors.push({
    id: 'temp_leverage',
    label: 'Temp afhankelijkheid',
    weight: 0.20,
    score: tempScore,
    weighted: tempScore * 0.20,
    status: factorStatus(tempScore),
    actual: Math.round(input.tempRatio * 100),
    optimal: 15,
    detail: input.tempRatio <= 0.15
      ? `Gezond: temp ratio van ${Math.round(input.tempRatio * 100)}% is onder de drempel van 15%.`
      : `Temp ratio van ${Math.round(input.tempRatio * 100)}% — ${Math.round((input.tempRatio - 0.15) * 100)}pp boven de optimale 15%. Elke pp reductie bespaart kosten.`,
  })

  // 3. Overtime Control (15%)
  const otScore = Math.round(clamp01(1 - Math.max(0, (input.overtimeRatio - 0.05) / 0.15)) * 100)
  factors.push({
    id: 'overtime',
    label: 'Overurenbeheersing',
    weight: 0.15,
    score: otScore,
    weighted: otScore * 0.15,
    status: factorStatus(otScore),
    actual: Math.round(input.overtimeRatio * 100 * 10) / 10,
    optimal: 5,
    detail: input.overtimeRatio <= 0.05
      ? `Goed beheerst: overurenratio van ${(input.overtimeRatio * 100).toFixed(1)}% is binnen de norm van 5%.`
      : `Overurenratio van ${(input.overtimeRatio * 100).toFixed(1)}% — ${((input.overtimeRatio - 0.05) * 100).toFixed(1)}pp boven de economisch optimale 5%.`,
  })

  // 4. Labor Utilization (20%)
  const utilScore = Math.round(clamp01(input.avgUtilization / 0.90) * 100)
  factors.push({
    id: 'utilization',
    label: 'Arbeidsbenutting',
    weight: 0.20,
    score: utilScore,
    weighted: utilScore * 0.20,
    status: factorStatus(utilScore),
    actual: Math.round(input.avgUtilization * 100),
    optimal: 90,
    detail: input.avgUtilization >= 0.90
      ? `Optimaal: ${Math.round(input.avgUtilization * 100)}% van contracturen benut.`
      : `${Math.round(input.avgUtilization * 100)}% benutting — ${Math.round((0.90 - input.avgUtilization) * 100)}pp onder het doel van 90%. Onder-benutte capaciteit kost geld.`,
  })

  // 5. Cost Efficiency (10%)
  const costTrendScore = Math.round(clamp01(input.costPerFteTrend <= 0 ? 1 : 1 - Math.min(1, input.costPerFteTrend / 0.10)) * 100)
  factors.push({
    id: 'cost_efficiency',
    label: 'Kostenefficiëntie',
    weight: 0.10,
    score: costTrendScore,
    weighted: costTrendScore * 0.10,
    status: factorStatus(costTrendScore),
    actual: Math.round(input.costPerFteTrend * 100),
    optimal: 0,
    detail: input.costPerFteTrend <= 0
      ? 'Kosten per FTE dalen — positieve trend.'
      : `Kosten per FTE stijgen met ${Math.round(input.costPerFteTrend * 100)}% — negatieve trend die aandacht vereist.`,
  })

  // 6. Schedule Stability (10%)
  const stabilityScore = Math.round(clamp01(1 - Math.max(0, (input.changeRate - 0.10) / 0.30)) * 100)
  factors.push({
    id: 'stability',
    label: 'Planningstabiliteit',
    weight: 0.10,
    score: stabilityScore,
    weighted: stabilityScore * 0.10,
    status: factorStatus(stabilityScore),
    actual: Math.round(input.changeRate * 100),
    optimal: 10,
    detail: input.changeRate <= 0.10
      ? `Stabiel: ${Math.round(input.changeRate * 100)}% wijzigingen per week, onder de norm van 10%.`
      : `${Math.round(input.changeRate * 100)}% planwijzigingen per week — instabiliteit verhoogt administratieve kosten.`,
  })

  const composite = Math.round(factors.reduce((sum, f) => sum + f.weighted, 0))
  const grade = gradeFromScore(composite)

  // Trend
  let trend: HealthScore['trend'] = 'stable'
  if (input.previousScore !== undefined) {
    const diff = composite - input.previousScore
    if (diff >= 3) trend = 'improving'
    else if (diff <= -3) trend = 'declining'
  }

  // Summary
  const weakest = [...factors].sort((a, b) => a.score - b.score)[0]
  const summary = composite >= 80
    ? `Uw organisatie scoort ${composite}/100 (${grade}) — bovengemiddeld op alle fronten.`
    : `Uw organisatie scoort ${composite}/100 (${grade}). Primaire verbeterkans: ${weakest.label.toLowerCase()} (${weakest.score}/100).`

  return { score: composite, grade, trend, factors, summary }
}
