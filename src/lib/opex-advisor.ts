/**
 * OPEX AI Advisory Engine — generates quantified, actionable recommendations.
 *
 * Produces C-level quality natural language analysis with concrete savings
 * estimates, economic reasoning, and prioritized action items.
 */

import type { HealthScore } from './opex-health'
import type { EconomicsReport } from './opex-economics'
import type { BenchmarkResult } from './opex-benchmarks'
import type { CostBreakdown } from './opex'

// ── Types ────────────────────────────────────────────────────────────────────

export interface Advisory {
  id: string
  priority: 'high' | 'medium' | 'low'
  category: 'conversion' | 'overtime' | 'utilization' | 'coverage' | 'stability' | 'training'
  title: string
  detail: string
  estimatedMonthlySaving: number
  timeframe: string
  confidence: 'high' | 'medium' | 'low'
  economicReasoning: string
}

export interface ExecutiveBriefing {
  headline: string
  subheadline: string
  keyMetrics: { label: string; value: string; trend?: 'up' | 'down' | 'flat'; good?: boolean }[]
  topActions: Advisory[]
  economicAnalysis: string      // multi-paragraph economic narrative
  benchmarkSummary: string      // how org compares to industry
}

// ── Advisory generation ──────────────────────────────────────────────────────

export function generateAdvisories(
  health: HealthScore,
  economics: EconomicsReport,
  costs: CostBreakdown,
): Advisory[] {
  const advisories: Advisory[] = []

  // 1. Temp conversion recommendations
  if (economics.tempConversion.candidates.length > 0) {
    const top = economics.tempConversion.candidates.filter((c) => c.npv12Month > 0).slice(0, 3)
    if (top.length > 0) {
      const totalSaving = top.reduce((s, c) => s + c.weeklyPremium * 4.33, 0)
      advisories.push({
        id: 'temp_conversion',
        priority: totalSaving > 500 ? 'high' : 'medium',
        category: 'conversion',
        title: `Converteer ${top.length} uitzendkracht${top.length > 1 ? 'en' : ''} naar intern`,
        detail: `${top.map((c) => c.name).join(', ')} — break-even gemiddeld ${Math.round(top.reduce((s, c) => s + c.breakEvenWeeks, 0) / top.length)} weken. NPV over 12 maanden: €${top.reduce((s, c) => s + c.npv12Month, 0).toLocaleString('nl-NL')}.`,
        estimatedMonthlySaving: Math.round(totalSaving),
        timeframe: `${Math.max(...top.map((c) => c.breakEvenWeeks))} weken tot break-even`,
        confidence: 'high',
        economicReasoning: `Het uurtariefverschil van €${(costs.avgCostPerHour > 0 ? Math.round((costs.tempPremium / Math.max(1, costs.tempHours)) * 100) / 100 : 0).toFixed(2)}/uur cumuleert significant over tijd. Bij de huidige inzetfrequentie is de onboardingsinvestering binnen ${Math.min(...top.map((c) => c.breakEvenWeeks))} weken terugverdiend.`,
      })
    }
  }

  // 2. Overtime reduction
  if (economics.overtime.excessHours > 0) {
    advisories.push({
      id: 'overtime_reduction',
      priority: economics.overtime.excessCost > 300 ? 'high' : 'medium',
      category: 'overtime',
      title: 'Reduceer overuren naar optimaal niveau',
      detail: `${Math.round(economics.overtime.excessHours)}h boven het economisch optimum van ${(economics.overtime.optimalRatio * 100).toFixed(1)}%. Extra kosten: €${economics.overtime.excessCost.toLocaleString('nl-NL')}/periode.`,
      estimatedMonthlySaving: Math.round(economics.overtime.excessCost),
      timeframe: '2-4 weken',
      confidence: 'high',
      economicReasoning: `Overuren kosten ${Math.round((costs.avgCostPerHour * 1.5 - costs.avgCostPerHour))}% meer per uur dan reguliere uren. ${economics.overtime.breakEvenFTE > 0 ? `${economics.overtime.breakEvenFTE} extra FTE zou deze overuren elimineren tegen lagere marginale kosten.` : ''}`,
    })
  }

  // 3. Utilization improvement
  if (economics.utilization.underUtilized > 0) {
    const underEmp = economics.utilization.entries.filter((e) => e.status === 'under')
    const wastedHours = underEmp.reduce((s, e) => s + (e.contractHours * 0.85 - e.plannedHours), 0)
    if (wastedHours > 10) {
      advisories.push({
        id: 'utilization_boost',
        priority: 'medium',
        category: 'utilization',
        title: `Benut ${economics.utilization.underUtilized} onder-benutte medewerker${economics.utilization.underUtilized > 1 ? 's' : ''}`,
        detail: `${Math.round(wastedHours)}h betaalde maar ongebruikte capaciteit per periode. Herverdeling kan temp-inzet reduceren.`,
        estimatedMonthlySaving: Math.round(wastedHours * (costs.avgCostPerHour > 0 ? costs.avgCostPerHour * 0.3 : 5)),
        timeframe: '1-2 weken',
        confidence: 'medium',
        economicReasoning: 'Onder-benutte contracturen zijn een verzonken kost — deze medewerkers worden betaald ongeacht inzet. Elke verschoven uur van temp naar intern bespaart het tariefverschil.',
      })
    }
  }

  // 4. Work distribution (Gini)
  if (economics.gini.status === 'skewed' || economics.gini.status === 'critical') {
    advisories.push({
      id: 'work_distribution',
      priority: economics.gini.status === 'critical' ? 'high' : 'medium',
      category: 'utilization',
      title: 'Herverdeel werkbelasting gelijkmatiger',
      detail: `Gini-coëfficiënt van ${economics.gini.coefficient.toFixed(3)}. Top 20% draagt ${economics.gini.topQuintileShare}% van de uren — dit verhoogt verzuim- en verlooprisico.`,
      estimatedMonthlySaving: Math.round(economics.gini.coefficient * 500),
      timeframe: '4-8 weken',
      confidence: 'medium',
      economicReasoning: 'Econometrisch onderzoek toont dat scheve werkverdeling leidt tot 15-25% hoger verzuim bij overbelaste medewerkers, met bijbehorende vervangingskosten.',
    })
  }

  // 5. Coverage improvement
  const coverageFactor = health.factors.find((f) => f.id === 'coverage')
  if (coverageFactor && coverageFactor.actual < 90) {
    advisories.push({
      id: 'coverage_boost',
      priority: coverageFactor.actual < 80 ? 'high' : 'low',
      category: 'coverage',
      title: 'Verhoog bezettingsgraad naar ≥95%',
      detail: `Huidige bezetting: ${coverageFactor.actual}%. Elke procentpunt stijging verbetert de operationele output direct.`,
      estimatedMonthlySaving: Math.round((95 - coverageFactor.actual) * 50),
      timeframe: '1-3 weken',
      confidence: 'medium',
      economicReasoning: 'Onvervulde posities hebben een opportuniteitskost: gemiste productiviteit, overbelasting van aanwezige medewerkers, en potentieel klantverlies.',
    })
  }

  // 6. Schedule stability
  const stabilityFactor = health.factors.find((f) => f.id === 'stability')
  if (stabilityFactor && stabilityFactor.actual > 15) {
    advisories.push({
      id: 'schedule_stability',
      priority: 'low',
      category: 'stability',
      title: 'Stabiliseer weekplanning',
      detail: `${stabilityFactor.actual}% planwijzigingen per week — boven de norm van 10%. Dit verhoogt administratieve overhead en medewerkersonzekerheid.`,
      estimatedMonthlySaving: Math.round((stabilityFactor.actual - 10) * 20),
      timeframe: '4-6 weken',
      confidence: 'low',
      economicReasoning: 'Frequente planwijzigingen genereren transactiekosten: hertoewijzing, communicatie, en verminderde medewerkertevredenheid die doorwerkt in verloop.',
    })
  }

  return advisories.sort((a, b) => {
    const prio = { high: 0, medium: 1, low: 2 }
    return prio[a.priority] - prio[b.priority] || b.estimatedMonthlySaving - a.estimatedMonthlySaving
  })
}

// ── Executive Briefing ───────────────────────────────────────────────────────

export function generateExecutiveBriefing(
  health: HealthScore,
  economics: EconomicsReport,
  costs: CostBreakdown,
  benchmarks: BenchmarkResult[],
  advisories: Advisory[],
): ExecutiveBriefing {
  const totalPotentialSaving = advisories.reduce((s, a) => s + a.estimatedMonthlySaving, 0)

  // Headline
  const headline = health.score >= 80
    ? `Uw OPEX scoort ${health.score}/100 — bovengemiddeld.`
    : `Uw OPEX scoort ${health.score}/100 — ${advisories.filter((a) => a.priority === 'high').length} acties kunnen €${totalPotentialSaving.toLocaleString('nl-NL')}/maand besparen.`

  const subheadline = `Grade ${health.grade} · Trend: ${health.trend === 'improving' ? 'verbeterend ▲' : health.trend === 'declining' ? 'dalend ▼' : 'stabiel ─'} · Workforce gap: ${economics.workforceGap.gapPercent.toFixed(1)}%`

  // Key metrics
  const keyMetrics = [
    { label: 'Health Score', value: `${health.score}/100`, trend: health.trend === 'improving' ? 'up' as const : health.trend === 'declining' ? 'down' as const : 'flat' as const, good: health.score >= 70 },
    { label: 'Kosten/uur', value: `€${costs.avgCostPerHour.toFixed(2)}`, good: costs.avgCostPerHour < 22 },
    { label: 'Workforce Gap', value: `${economics.workforceGap.gapPercent.toFixed(1)}%`, good: economics.workforceGap.gapPercent < 10 },
    { label: 'Besparingspotentieel', value: `€${totalPotentialSaving.toLocaleString('nl-NL')}/mnd`, good: true },
  ]

  // Economic analysis narrative
  const weakBenchmarks = benchmarks.filter((b) => b.rating === 'critical' || b.rating === 'below-average')
  const strongBenchmarks = benchmarks.filter((b) => b.rating === 'excellent' || b.rating === 'good')

  let economicAnalysis = `Uw organisatie opereert op ${economics.workforceGap.actualOutput}% van haar theoretisch potentieel. `

  if (economics.workforceGap.gapDrivers.length > 0) {
    economicAnalysis += `De ${economics.workforceGap.gapDrivers.length} belangrijkste drivers van deze gap zijn: `
    economicAnalysis += economics.workforceGap.gapDrivers
      .slice(0, 3)
      .map((d, i) => `${i + 1}) ${d.driver} (${d.impact}pp impact)`)
      .join(', ')
    economicAnalysis += '. '
  }

  economicAnalysis += `\n\nDe Gini-coëfficiënt van de werkverdeling is ${economics.gini.coefficient.toFixed(3)} (${economics.gini.status}). `
  economicAnalysis += `De gemiddelde arbeidsbenutting is ${Math.round(economics.utilization.average * 100)}% met een standaarddeviatie van ${(economics.utilization.standardDeviation * 100).toFixed(1)}pp. `

  if (economics.tempConversion.candidates.length > 0) {
    economicAnalysis += `\n\nTemp-conversie analyse toont een totaal NPV van €${economics.tempConversion.totalNpv.toLocaleString('nl-NL')} over 12 maanden bij conversie van alle ${economics.tempConversion.candidates.length} uitzendkrachten. `
  }

  economicAnalysis += `\n\n${economics.overtime.narrative}`

  // Benchmark summary
  let benchmarkSummary = ''
  if (weakBenchmarks.length > 0) {
    benchmarkSummary += `Op ${weakBenchmarks.length} van ${benchmarks.length} industrie-metrics scoort u onder het marktgemiddelde: ${weakBenchmarks.slice(0, 3).map((b) => b.benchmark.label.toLowerCase()).join(', ')}. `
  }
  if (strongBenchmarks.length > 0) {
    benchmarkSummary += `Sterke punten: ${strongBenchmarks.slice(0, 3).map((b) => b.benchmark.label.toLowerCase()).join(', ')}.`
  }
  if (benchmarks.length === 0) {
    benchmarkSummary = 'Onvoldoende data voor benchmarkvergelijking.'
  }

  return {
    headline,
    subheadline,
    keyMetrics,
    topActions: advisories.slice(0, 3),
    economicAnalysis,
    benchmarkSummary,
  }
}
