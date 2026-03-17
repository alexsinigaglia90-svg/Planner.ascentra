/**
 * OPEX Econometric Models — advanced economic analysis for workforce operations.
 *
 * Implements: Gini coefficient, marginal cost analysis, labor utilization index,
 * workforce gap (Okun-inspired), and temp-to-internal conversion NPV.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface GiniResult {
  coefficient: number         // 0-1 (0 = perfect equality)
  interpretation: string
  status: 'healthy' | 'moderate' | 'skewed' | 'critical'
  topQuintileShare: number    // % of hours worked by top 20%
}

export interface UtilizationEntry {
  employeeId: string
  name: string
  contractHours: number
  plannedHours: number
  utilization: number         // 0+
  status: 'under' | 'optimal' | 'over'
}

export interface UtilizationIndex {
  average: number             // mean utilization 0-1
  median: number
  standardDeviation: number
  underUtilized: number       // count <75%
  optimal: number             // count 75-105%
  overUtilized: number        // count >105%
  entries: UtilizationEntry[]
  narrative: string
}

export interface MarginalCostPoint {
  headcount: number
  totalCost: number
  marginalCost: number
  coverageGain: number        // additional coverage % from this person
}

export interface MarginalCostCurve {
  points: MarginalCostPoint[]
  optimalHeadcount: number    // where MC ≈ value of coverage
  currentHeadcount: number
  narrative: string
}

export interface TempConversionCandidate {
  employeeId: string
  name: string
  weeklyHours: number
  weeksActive: number
  weeklyPremium: number       // temp rate - internal rate × hours
  breakEvenWeeks: number      // onboarding cost / weekly premium
  npv12Month: number          // NPV of conversion over 12 months
  roi: number                 // NPV / onboarding cost
}

export interface TempConversionAnalysis {
  candidates: TempConversionCandidate[]
  totalAnnualSaving: number
  totalNpv: number
  narrative: string
}

export interface WorkforceGap {
  potentialOutput: number     // max theoretical output (100% coverage, 0% temp premium, 0% OT premium)
  actualOutput: number        // effective output with current inefficiencies
  gapPercent: number          // 0-100
  gapDrivers: { driver: string; impact: number; detail: string }[]
  narrative: string
}

export interface OvertimeAnalysis {
  currentRatio: number        // %
  optimalRatio: number        // %
  excessHours: number
  excessCost: number
  breakEvenFTE: number        // extra FTEs needed to eliminate excess OT
  narrative: string
}

// ── Input types ──────────────────────────────────────────────────────────────

export interface EconomicsInput {
  employees: {
    id: string
    name: string
    employeeType: 'internal' | 'temp'
    contractHours: number
    plannedHours: number
    weeklyHours: number
    weeksActive?: number
  }[]
  totalHours: number
  internalHours: number
  tempHours: number
  overtimeHours: number
  coverageRate: number        // 0-1
  totalRequired: number       // required shifts
  totalAssigned: number       // filled shifts
  internalHourlyRate: number
  tempHourlyRate: number
  overtimeMultiplier: number
  onboardingCostEstimate?: number  // default €800
}

// ── Gini Coefficient ─────────────────────────────────────────────────────────

export function computeGini(hours: number[]): GiniResult {
  if (hours.length <= 1) {
    return { coefficient: 0, interpretation: 'Onvoldoende data voor Gini-analyse.', status: 'healthy', topQuintileShare: 100 }
  }

  const sorted = [...hours].sort((a, b) => a - b)
  const n = sorted.length
  const total = sorted.reduce((s, h) => s + h, 0)

  if (total === 0) {
    return { coefficient: 0, interpretation: 'Geen uren geregistreerd.', status: 'healthy', topQuintileShare: 0 }
  }

  let sumOfDiffs = 0
  for (let i = 0; i < n; i++) {
    sumOfDiffs += (2 * (i + 1) - n - 1) * sorted[i]
  }
  const gini = Math.round((sumOfDiffs / (n * total)) * 1000) / 1000

  // Top quintile share
  const topStart = Math.floor(n * 0.8)
  const topHours = sorted.slice(topStart).reduce((s, h) => s + h, 0)
  const topQuintileShare = Math.round((topHours / total) * 100)

  let status: GiniResult['status'] = 'healthy'
  let interpretation = ''

  if (gini < 0.15) {
    status = 'healthy'
    interpretation = `Gini-coëfficiënt van ${gini.toFixed(3)} — werk is gelijkmatig verdeeld. Top 20% draagt ${topQuintileShare}% van de uren.`
  } else if (gini < 0.25) {
    status = 'moderate'
    interpretation = `Gini-coëfficiënt van ${gini.toFixed(3)} — lichte scheefheid in werkverdeling. Top 20% draagt ${topQuintileShare}% van de uren.`
  } else if (gini < 0.35) {
    status = 'skewed'
    interpretation = `Gini-coëfficiënt van ${gini.toFixed(3)} — aanzienlijke ongelijkheid. Top 20% draagt ${topQuintileShare}% van de uren. Dit verhoogt verzuimrisico bij zwaar belaste medewerkers.`
  } else {
    status = 'critical'
    interpretation = `Gini-coëfficiënt van ${gini.toFixed(3)} — kritieke ongelijkheid. Top 20% draagt ${topQuintileShare}% van de uren. Herverdeling is economisch en operationeel noodzakelijk.`
  }

  return { coefficient: gini, interpretation, status, topQuintileShare }
}

// ── Labor Utilization Index ──────────────────────────────────────────────────

export function computeUtilizationIndex(employees: EconomicsInput['employees']): UtilizationIndex {
  const internals = employees.filter((e) => e.employeeType === 'internal' && e.contractHours > 0)

  const entries: UtilizationEntry[] = internals.map((e) => {
    const util = e.plannedHours / e.contractHours
    return {
      employeeId: e.id,
      name: e.name,
      contractHours: e.contractHours,
      plannedHours: Math.round(e.plannedHours * 10) / 10,
      utilization: Math.round(util * 1000) / 1000,
      status: (util < 0.75 ? 'under' : util > 1.05 ? 'over' : 'optimal') as UtilizationEntry['status'],
    }
  }).sort((a, b) => a.utilization - b.utilization)

  const utils = entries.map((e) => e.utilization)
  const avg = utils.length > 0 ? utils.reduce((s, u) => s + u, 0) / utils.length : 0

  const sorted = [...utils].sort((a, b) => a - b)
  const median = sorted.length > 0
    ? sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)]
    : 0

  const variance = utils.length > 0
    ? utils.reduce((s, u) => s + Math.pow(u - avg, 2), 0) / utils.length
    : 0
  const stdDev = Math.sqrt(variance)

  const underUtilized = entries.filter((e) => e.status === 'under').length
  const optimal = entries.filter((e) => e.status === 'optimal').length
  const overUtilized = entries.filter((e) => e.status === 'over').length

  const narrative = entries.length === 0
    ? 'Geen interne medewerkers met contracturen gevonden.'
    : `Gemiddelde benutting: ${Math.round(avg * 100)}%. ${underUtilized} medewerker${underUtilized !== 1 ? 's' : ''} onder-benut (<75%), ${overUtilized} over-benut (>105%). Spreiding (σ): ${(stdDev * 100).toFixed(1)}pp.`

  return {
    average: Math.round(avg * 1000) / 1000,
    median: Math.round(median * 1000) / 1000,
    standardDeviation: Math.round(stdDev * 1000) / 1000,
    underUtilized,
    optimal,
    overUtilized,
    entries,
    narrative,
  }
}

// ── Temp-to-Internal Conversion NPV ──────────────────────────────────────────

export function computeTempConversionAnalysis(input: EconomicsInput): TempConversionAnalysis {
  const onboarding = input.onboardingCostEstimate ?? 800
  const weeklyDiscountRate = 0.05 / 52 // 5% annual → weekly

  const temps = input.employees.filter((e) => e.employeeType === 'temp' && e.weeklyHours > 0)

  const candidates: TempConversionCandidate[] = temps.map((t) => {
    const weeklyPremium = (input.tempHourlyRate - input.internalHourlyRate) * t.weeklyHours
    const breakEvenWeeks = weeklyPremium > 0 ? Math.ceil(onboarding / weeklyPremium) : 999

    // NPV over 52 weeks
    let npv = -onboarding
    for (let week = 1; week <= 52; week++) {
      npv += weeklyPremium / Math.pow(1 + weeklyDiscountRate, week)
    }

    return {
      employeeId: t.id,
      name: t.name,
      weeklyHours: Math.round(t.weeklyHours * 10) / 10,
      weeksActive: t.weeksActive ?? 0,
      weeklyPremium: Math.round(weeklyPremium * 100) / 100,
      breakEvenWeeks,
      npv12Month: Math.round(npv),
      roi: onboarding > 0 ? Math.round((npv / onboarding) * 100) / 100 : 0,
    }
  }).sort((a, b) => b.npv12Month - a.npv12Month)

  const totalAnnualSaving = candidates.reduce((s, c) => s + Math.max(0, c.npv12Month + onboarding), 0)
  const totalNpv = candidates.reduce((s, c) => s + c.npv12Month, 0)

  const top = candidates.slice(0, 3)
  const narrative = candidates.length === 0
    ? 'Geen uitzendkrachten om te analyseren voor conversie.'
    : `${candidates.length} temp${candidates.length !== 1 ? 's' : ''} geanalyseerd. ${top.length > 0 ? `Top kandidaat: ${top[0].name} met NPV van €${top[0].npv12Month.toLocaleString('nl-NL')} en break-even in ${top[0].breakEvenWeeks} weken.` : ''} Totaal jaarlijks besparingspotentieel: €${Math.round(totalAnnualSaving).toLocaleString('nl-NL')}.`

  return { candidates, totalAnnualSaving: Math.round(totalAnnualSaving), totalNpv: Math.round(totalNpv), narrative }
}

// ── Workforce Gap (Okun-inspired) ────────────────────────────────────────────

export function computeWorkforceGap(input: EconomicsInput): WorkforceGap {
  // Potential output: if coverage=100%, all internal, no overtime premium
  const potentialOutput = 100 // normalized to 100

  // Gap drivers
  const drivers: WorkforceGap['gapDrivers'] = []

  // 1. Coverage gap
  const coverageGap = Math.max(0, 1 - input.coverageRate) * 40 // max 40 impact
  if (coverageGap > 0) {
    drivers.push({
      driver: 'Bezettingstekort',
      impact: Math.round(coverageGap * 10) / 10,
      detail: `${Math.round((1 - input.coverageRate) * 100)}% onvervulde posities verlagen de effectieve output.`,
    })
  }

  // 2. Temp premium drag
  const tempRatio = input.totalHours > 0 ? input.tempHours / input.totalHours : 0
  const tempDrag = tempRatio > 0
    ? (input.tempHours / Math.max(1, input.totalHours)) * ((input.tempHourlyRate - input.internalHourlyRate) / input.internalHourlyRate) * 30
    : 0
  if (tempDrag > 0.5) {
    drivers.push({
      driver: 'Temp kostenpremie',
      impact: Math.round(tempDrag * 10) / 10,
      detail: `Temp uren kosten ${Math.round(((input.tempHourlyRate / input.internalHourlyRate) - 1) * 100)}% meer dan intern — dit drukt de kostenefficiëntie.`,
    })
  }

  // 3. Overtime premium drag
  const otDrag = input.overtimeHours > 0
    ? (input.overtimeHours / Math.max(1, input.totalHours)) * ((input.overtimeMultiplier - 1) * 100) * 0.3
    : 0
  if (otDrag > 0.5) {
    drivers.push({
      driver: 'Overurenpremie',
      impact: Math.round(otDrag * 10) / 10,
      detail: `${Math.round(input.overtimeHours)}h overuren tegen ${Math.round((input.overtimeMultiplier - 1) * 100)}% toeslag verlagen de kosteneffectiviteit.`,
    })
  }

  // 4. Utilization gap
  const utilGap = Math.max(0, 0.90 - (input.employees
    .filter((e) => e.employeeType === 'internal' && e.contractHours > 0)
    .reduce((sum, e) => sum + Math.min(1, e.plannedHours / e.contractHours), 0) /
    Math.max(1, input.employees.filter((e) => e.employeeType === 'internal' && e.contractHours > 0).length)
  )) * 20
  if (utilGap > 0.5) {
    drivers.push({
      driver: 'Onder-benutting',
      impact: Math.round(utilGap * 10) / 10,
      detail: 'Medewerkers werken minder uren dan gecontracteerd — betaalde capaciteit wordt niet benut.',
    })
  }

  const totalGap = Math.min(100, coverageGap + tempDrag + otDrag + utilGap)
  const actualOutput = Math.round((potentialOutput - totalGap) * 10) / 10

  drivers.sort((a, b) => b.impact - a.impact)

  const topDriver = drivers[0]
  const narrative = totalGap < 5
    ? `Uw organisatie opereert op ${actualOutput}% van haar theoretisch potentieel — nagenoeg optimaal.`
    : `Uw organisatie opereert op ${actualOutput}% van haar theoretisch potentieel (gap: ${Math.round(totalGap)}%). ${topDriver ? `Primaire oorzaak: ${topDriver.driver.toLowerCase()} (${topDriver.impact}pp impact).` : ''}`

  return {
    potentialOutput,
    actualOutput,
    gapPercent: Math.round(totalGap * 10) / 10,
    gapDrivers: drivers,
    narrative,
  }
}

// ── Overtime Threshold Analysis ──────────────────────────────────────────────

export function computeOvertimeAnalysis(input: EconomicsInput): OvertimeAnalysis {
  const currentRatio = input.totalHours > 0 ? input.overtimeHours / input.totalHours : 0
  const optimalRatio = 0.045 // 4.5% is economic sweet spot

  const excessHours = Math.max(0, input.overtimeHours - input.totalHours * optimalRatio)
  const excessCost = excessHours * input.internalHourlyRate * (input.overtimeMultiplier - 1)

  // How many FTEs needed to eliminate excess OT?
  const avgWeeklyHours = 36 // typical NL contract
  const breakEvenFTE = avgWeeklyHours > 0 ? Math.ceil(excessHours / avgWeeklyHours) : 0

  const narrative = currentRatio <= optimalRatio
    ? `Overurenratio van ${(currentRatio * 100).toFixed(1)}% is onder het optimale maximum van ${(optimalRatio * 100).toFixed(1)}%. Goed beheerst.`
    : `Overurenratio van ${(currentRatio * 100).toFixed(1)}% is ${((currentRatio - optimalRatio) * 100).toFixed(1)}pp boven optimaal. ${Math.round(excessHours)}h excess overuren kosten €${Math.round(excessCost).toLocaleString('nl-NL')} extra. ${breakEvenFTE} extra FTE zou deze overuren elimineren.`

  return {
    currentRatio: Math.round(currentRatio * 1000) / 1000,
    optimalRatio,
    excessHours: Math.round(excessHours * 10) / 10,
    excessCost: Math.round(excessCost),
    breakEvenFTE,
    narrative,
  }
}

// ── Convenience: compute all economics at once ───────────────────────────────

export interface EconomicsReport {
  gini: GiniResult
  utilization: UtilizationIndex
  tempConversion: TempConversionAnalysis
  workforceGap: WorkforceGap
  overtime: OvertimeAnalysis
}

export function computeEconomicsReport(input: EconomicsInput): EconomicsReport {
  const hours = input.employees.map((e) => e.plannedHours)

  return {
    gini: computeGini(hours),
    utilization: computeUtilizationIndex(input.employees),
    tempConversion: computeTempConversionAnalysis(input),
    workforceGap: computeWorkforceGap(input),
    overtime: computeOvertimeAnalysis(input),
  }
}
