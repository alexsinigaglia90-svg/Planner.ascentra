/**
 * OPEX Industry Benchmarks — warehouse/logistics sector standards.
 *
 * Static reference data from public sources:
 * CBS (NL), Eurostat, BLS (US), Deloitte Logistics, Aberdeen Group, ABU, Randstad.
 *
 * Used to position an organization's metrics against industry percentiles.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface Benchmark {
  id: string
  label: string
  unit: string
  /** Lower is better (cost metrics) or higher is better (efficiency) */
  direction: 'lower-is-better' | 'higher-is-better'
  p25: number   // bottom quartile
  p50: number   // median
  p75: number   // top quartile
  p90: number   // best-in-class
  source: string
  category: 'cost' | 'mix' | 'efficiency' | 'absence' | 'stability'
}

export type PercentileRating = 'critical' | 'below-average' | 'average' | 'good' | 'excellent'

export interface BenchmarkResult {
  benchmark: Benchmark
  actual: number
  percentile: number         // 0-100 estimated position
  rating: PercentileRating
  gapToP75: number           // distance to top quartile (negative = already there)
  narrative: string          // natural language positioning
}

// ── Industry benchmark data ──────────────────────────────────────────────────

export const BENCHMARKS: Benchmark[] = [
  // Cost metrics (lower is better)
  {
    id: 'cost_per_fte',
    label: 'Kosten per FTE / maand',
    unit: '€',
    direction: 'lower-is-better',
    p25: 3800, p50: 3200, p75: 2800, p90: 2400,
    source: 'CBS 2024',
    category: 'cost',
  },
  {
    id: 'avg_hourly_rate',
    label: 'Gem. uurtarief (blended)',
    unit: '€/uur',
    direction: 'lower-is-better',
    p25: 26, p50: 22, p75: 19, p90: 17,
    source: 'Eurostat',
    category: 'cost',
  },
  {
    id: 'temp_premium_pct',
    label: 'Temp premie vs intern',
    unit: '%',
    direction: 'lower-is-better',
    p25: 65, p50: 55, p75: 45, p90: 35,
    source: 'Randstad/ABU',
    category: 'cost',
  },

  // Mix metrics (lower is better for most)
  {
    id: 'temp_ratio',
    label: 'Temp ratio',
    unit: '%',
    direction: 'lower-is-better',
    p25: 35, p50: 22, p75: 15, p90: 8,
    source: 'ABU 2024',
    category: 'mix',
  },
  {
    id: 'overhead_ratio',
    label: 'Overhead ratio',
    unit: '%',
    direction: 'lower-is-better',
    p25: 25, p50: 18, p75: 12, p90: 8,
    source: 'BLS',
    category: 'mix',
  },
  {
    id: 'overtime_ratio',
    label: 'Overuren ratio',
    unit: '%',
    direction: 'lower-is-better',
    p25: 12, p50: 7, p75: 4.5, p90: 2.5,
    source: 'CBS 2024',
    category: 'mix',
  },

  // Efficiency metrics (higher is better)
  {
    id: 'labor_utilization',
    label: 'Arbeidsbenutting',
    unit: '%',
    direction: 'higher-is-better',
    p25: 72, p50: 82, p75: 89, p90: 94,
    source: 'Aberdeen Group',
    category: 'efficiency',
  },
  {
    id: 'schedule_adherence',
    label: 'Planning nakoming',
    unit: '%',
    direction: 'higher-is-better',
    p25: 78, p50: 86, p75: 92, p90: 97,
    source: 'Gartner',
    category: 'efficiency',
  },
  {
    id: 'coverage_rate',
    label: 'Bezettingsgraad',
    unit: '%',
    direction: 'higher-is-better',
    p25: 82, p50: 90, p75: 96, p90: 99,
    source: 'Intern benchmark',
    category: 'efficiency',
  },

  // Absence metrics (lower is better)
  {
    id: 'sick_leave_pct',
    label: 'Ziekteverzuim',
    unit: '%',
    direction: 'lower-is-better',
    p25: 7.5, p50: 5.2, p75: 3.8, p90: 2.5,
    source: 'CBS 2024',
    category: 'absence',
  },

  // Stability metrics
  {
    id: 'schedule_changes',
    label: 'Planwijzigingen / week',
    unit: '%',
    direction: 'lower-is-better',
    p25: 22, p50: 14, p75: 8, p90: 3,
    source: 'Intern benchmark',
    category: 'stability',
  },
]

// ── Percentile positioning ───────────────────────────────────────────────────

function interpolatePercentile(value: number, b: Benchmark): number {
  const { p25, p50, p75, p90, direction } = b

  // For "lower is better", lower values = higher percentile
  if (direction === 'lower-is-better') {
    if (value >= p25) return Math.max(0, 25 - ((value - p25) / Math.max(1, p25)) * 25)
    if (value >= p50) return 25 + ((p25 - value) / Math.max(1, p25 - p50)) * 25
    if (value >= p75) return 50 + ((p50 - value) / Math.max(1, p50 - p75)) * 25
    if (value >= p90) return 75 + ((p75 - value) / Math.max(1, p75 - p90)) * 15
    return Math.min(100, 90 + ((p90 - value) / Math.max(1, p90)) * 10)
  }

  // For "higher is better", higher values = higher percentile
  if (value <= p25) return Math.max(0, 25 - ((p25 - value) / Math.max(1, p25)) * 25)
  if (value <= p50) return 25 + ((value - p25) / Math.max(1, p50 - p25)) * 25
  if (value <= p75) return 50 + ((value - p50) / Math.max(1, p75 - p50)) * 25
  if (value <= p90) return 75 + ((value - p75) / Math.max(1, p90 - p75)) * 15
  return Math.min(100, 90 + ((value - p90) / Math.max(1, p90)) * 10)
}

function ratingFromPercentile(pct: number): PercentileRating {
  if (pct >= 80) return 'excellent'
  if (pct >= 60) return 'good'
  if (pct >= 40) return 'average'
  if (pct >= 20) return 'below-average'
  return 'critical'
}

function generateNarrative(b: Benchmark, actual: number, rating: PercentileRating, gapToP75: number): string {
  const name = b.label.toLowerCase()
  const unit = b.unit === '%' ? '%' : ` ${b.unit}`

  if (rating === 'excellent') {
    return `Uw ${name} van ${fmt(actual)}${unit} is best-in-class. U presteert boven het 75e percentiel (${fmt(b.p75)}${unit}).`
  }
  if (rating === 'good') {
    return `Uw ${name} is ${fmt(actual)}${unit} — bovengemiddeld. Het marktgemiddelde is ${fmt(b.p50)}${unit}.`
  }
  if (rating === 'average') {
    const gap = Math.abs(gapToP75)
    return `Uw ${name} van ${fmt(actual)}${unit} zit rond het marktgemiddelde (${fmt(b.p50)}${unit}). Een verbetering van ${fmt(gap)}${unit === '%' ? 'pp' : unit} brengt u in het top-kwartiel.`
  }
  if (rating === 'below-average') {
    return `Uw ${name} van ${fmt(actual)}${unit} ligt onder het marktgemiddelde van ${fmt(b.p50)}${unit}. Dit verdient aandacht.`
  }
  return `Uw ${name} van ${fmt(actual)}${unit} is kritiek — ruim onder het sectorgemiddelde van ${fmt(b.p50)}${unit}. Directe actie aanbevolen.`
}

function fmt(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString('nl-NL') : n.toLocaleString('nl-NL', { maximumFractionDigits: 1 })
}

// ── Public API ───────────────────────────────────────────────────────────────

export function positionAgainstBenchmark(benchmarkId: string, actual: number): BenchmarkResult | null {
  const b = BENCHMARKS.find((bm) => bm.id === benchmarkId)
  if (!b) return null

  const percentile = Math.round(interpolatePercentile(actual, b))
  const rating = ratingFromPercentile(percentile)

  const gapToP75 = b.direction === 'lower-is-better'
    ? actual - b.p75   // positive = still above P75 (bad)
    : b.p75 - actual   // positive = still below P75 (bad)

  return {
    benchmark: b,
    actual,
    percentile,
    rating,
    gapToP75: Math.round(gapToP75 * 10) / 10,
    narrative: generateNarrative(b, actual, rating, gapToP75),
  }
}

export function positionAll(metrics: Record<string, number>): BenchmarkResult[] {
  const results: BenchmarkResult[] = []
  for (const [id, value] of Object.entries(metrics)) {
    const r = positionAgainstBenchmark(id, value)
    if (r) results.push(r)
  }
  return results.sort((a, b) => a.percentile - b.percentile) // worst first
}
