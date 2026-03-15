/**
 * External & Internal Signals Engine
 *
 * Generates workforce planning signals from:
 * - Seasonal health patterns (flu, norovirus, pollen, heat)
 * - Dutch school holidays per region
 * - Public holidays & bridge days
 * - Retail/logistics peak periods
 * - Weather/daylight patterns
 * - Internal organizational patterns (day-of-week, post-vacation, dept trends)
 *
 * Pure computation — no external API calls in v1, uses known data models.
 */

import { prisma } from '@/lib/db/client'

// ── Types ────────────────────────────────────────────────────────────────────

export interface Signal {
  id: string
  category: 'health' | 'economy' | 'calendar' | 'weather' | 'internal'
  severity: 'high' | 'medium' | 'low' | 'info'
  title: string
  description: string
  impact: string
  startDate: string
  endDate: string
  icon: string
  expectedAbsenceIncrease?: number // percentage points
}

// ── Dutch school holidays 2026 (approximate) ─────────────────────────────────

const SCHOOL_HOLIDAYS_2026 = [
  { name: 'Voorjaarsvakantie Noord', start: '2026-02-21', end: '2026-03-01', region: 'Noord' },
  { name: 'Voorjaarsvakantie Midden', start: '2026-02-14', end: '2026-02-22', region: 'Midden' },
  { name: 'Voorjaarsvakantie Zuid', start: '2026-02-14', end: '2026-02-22', region: 'Zuid' },
  { name: 'Meivakantie', start: '2026-04-25', end: '2026-05-10', region: 'Alle' },
  { name: 'Zomervakantie Noord', start: '2026-07-04', end: '2026-08-16', region: 'Noord' },
  { name: 'Zomervakantie Midden', start: '2026-07-18', end: '2026-08-30', region: 'Midden' },
  { name: 'Zomervakantie Zuid', start: '2026-07-11', end: '2026-08-23', region: 'Zuid' },
  { name: 'Herfstvakantie', start: '2026-10-17', end: '2026-10-25', region: 'Alle' },
  { name: 'Kerstvakantie', start: '2026-12-19', end: '2027-01-03', region: 'Alle' },
]

// ── Public holidays 2026 ─────────────────────────────────────────────────────

const PUBLIC_HOLIDAYS_2026 = [
  { name: 'Nieuwjaarsdag', date: '2026-01-01' },
  { name: 'Goede Vrijdag', date: '2026-04-03' },
  { name: 'Eerste Paasdag', date: '2026-04-05' },
  { name: 'Tweede Paasdag', date: '2026-04-06' },
  { name: 'Koningsdag', date: '2026-04-27' },
  { name: 'Bevrijdingsdag', date: '2026-05-05' },
  { name: 'Hemelvaartsdag', date: '2026-05-14' },
  { name: 'Eerste Pinksterdag', date: '2026-05-24' },
  { name: 'Tweede Pinksterdag', date: '2026-05-25' },
  { name: 'Eerste Kerstdag', date: '2026-12-25' },
  { name: 'Tweede Kerstdag', date: '2026-12-26' },
]

// ── Seasonal health patterns (based on RIVM/WHO data models) ─────────────────

const HEALTH_PATTERNS = [
  {
    id: 'flu-season',
    title: 'Griepseizoen',
    description: 'Influenza piekperiode op basis van RIVM seizoenspatronen. Historisch 15-25% extra verzuim in deze weken.',
    impact: 'Verwacht 15-25% hoger kort verzuim. Plan extra vervanging en vermijd critical single-points-of-failure.',
    startMonth: 12, startDay: 15, endMonth: 3, endDay: 1,
    severity: 'high' as const,
    icon: '🤒',
    expectedAbsenceIncrease: 20,
  },
  {
    id: 'norovirus',
    title: 'Norovirus risico',
    description: 'Norovirus piekt nov-mrt. Zeer besmettelijk in gesloten werkruimtes — cluster-uitval mogelijk.',
    impact: 'Risico op hele teams die tegelijk uitvallen. Spreid teamleden over shifts.',
    startMonth: 11, startDay: 1, endMonth: 3, endDay: 15,
    severity: 'medium' as const,
    icon: '🦠',
    expectedAbsenceIncrease: 10,
  },
  {
    id: 'pollen-spring',
    title: 'Pollenseizoen voorjaar',
    description: 'Berkenpollen piek april-mei. Impact op buitenwerk en medewerkers met hooikoorts.',
    impact: 'Verwacht 5-8% meer kort verzuim en productiviteitsdaling bij buitenshifts.',
    startMonth: 4, startDay: 1, endMonth: 5, endDay: 31,
    severity: 'low' as const,
    icon: '🌿',
    expectedAbsenceIncrease: 6,
  },
  {
    id: 'pollen-summer',
    title: 'Graspollenseizoen',
    description: 'Graspollen piek juni-juli. Meest voorkomende hooikoortsperiode.',
    impact: 'Verwacht 5-10% productiviteitsdaling. Overweeg indoor herplaatsing voor getroffen medewerkers.',
    startMonth: 6, startDay: 1, endMonth: 7, endDay: 31,
    severity: 'low' as const,
    icon: '🌾',
    expectedAbsenceIncrease: 7,
  },
  {
    id: 'winter-depression',
    title: 'Winterdepressie periode',
    description: 'Korte dagen nov-feb zijn geassocieerd met 8-12% hoger verzuim (WHO/CBS data).',
    impact: 'Structureel hoger verzuim. Plan extra capaciteit in deze maanden.',
    startMonth: 11, startDay: 1, endMonth: 2, endDay: 28,
    severity: 'medium' as const,
    icon: '🌙',
    expectedAbsenceIncrease: 10,
  },
  {
    id: 'heat-risk',
    title: 'Hittegolf risico',
    description: 'Juli-augustus: kans op hittegolven (>30°C). Productiviteit daalt 10-15% bij extreme hitte.',
    impact: 'Plan extra pauzes, hydratatie, en eventueel extra personeel voor compensatie.',
    startMonth: 7, startDay: 1, endMonth: 8, endDay: 31,
    severity: 'medium' as const,
    icon: '🌡️',
    expectedAbsenceIncrease: 8,
  },
]

// ── Peak business periods ────────────────────────────────────────────────────

const BUSINESS_PEAKS = [
  { id: 'sinterklaas', title: 'Sinterklaas piekperiode', start: '2026-11-15', end: '2026-12-05', icon: '🎁', description: 'Logistiek/retail piekperiode. Historisch 1.5-2x normaal volume.', impact: 'Bezetting opschalen. Temps vroegtijdig reserveren.' },
  { id: 'black-friday', title: 'Black Friday week', start: '2026-11-23', end: '2026-11-30', icon: '🛒', description: 'E-commerce piek. Enorme volume-stijging in warehousing en logistiek.', impact: 'Maximale bezetting nodig. Plan geen verlof in deze week.' },
  { id: 'kerst-logistiek', title: 'Kerst logistiek piek', start: '2026-12-01', end: '2026-12-23', icon: '🎄', description: 'Langste piekperiode van het jaar voor logistiek en distributie.', impact: 'Structureel hogere bezetting nodig. Verlofstop overwegen.' },
  { id: 'q1-start', title: 'Q1 opstart', start: '2026-01-05', end: '2026-01-16', icon: '🚀', description: 'Eerste weken na kerst: opstart, achterstallige orders, hoog verzuim na feestdagen.', impact: 'Post-vakantie effect: 10-15% meer ziekmeldingen. Extra capaciteit inplannen.' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function healthPatternDates(pattern: typeof HEALTH_PATTERNS[0], year: number): { start: string; end: string } {
  const startYear = pattern.startMonth >= 10 ? year : year // flu season starts in current year
  let endYear = year
  if (pattern.endMonth < pattern.startMonth) endYear = year + 1

  return {
    start: `${startYear}-${String(pattern.startMonth).padStart(2, '0')}-${String(pattern.startDay).padStart(2, '0')}`,
    end: `${endYear}-${String(pattern.endMonth).padStart(2, '0')}-${String(pattern.endDay).padStart(2, '0')}`,
  }
}

// ── Main computation ─────────────────────────────────────────────────────────

export async function computeSignals(organizationId: string): Promise<Signal[]> {
  const today = isoToday()
  const horizon = addMonths(today, 3) // look 3 months ahead
  const year = new Date().getFullYear()
  const signals: Signal[] = []

  // ── Health patterns ────────────────────────────────────────────────────
  for (const pattern of HEALTH_PATTERNS) {
    const dates = healthPatternDates(pattern, year)
    // Check if pattern is within our horizon (active now or upcoming)
    if (dates.end >= today && dates.start <= horizon) {
      const isActive = dateInRange(today, dates.start, dates.end)
      signals.push({
        id: pattern.id,
        category: 'health',
        severity: isActive ? pattern.severity : 'info',
        title: pattern.title,
        description: pattern.description,
        impact: pattern.impact,
        startDate: dates.start,
        endDate: dates.end,
        icon: pattern.icon,
        expectedAbsenceIncrease: pattern.expectedAbsenceIncrease,
      })
    }
  }

  // ── School holidays ────────────────────────────────────────────────────
  for (const holiday of SCHOOL_HOLIDAYS_2026) {
    if (holiday.end >= today && holiday.start <= horizon) {
      const isActive = dateInRange(today, holiday.start, holiday.end)
      signals.push({
        id: `school-${holiday.name.toLowerCase().replace(/\s/g, '-')}`,
        category: 'calendar',
        severity: isActive ? 'medium' : 'low',
        title: holiday.name,
        description: `Schoolvakantie ${holiday.region}. Verwacht 20-30% meer verlofaanvragen van ouders.`,
        impact: 'Plan tijdig vervanging voor medewerkers met schoolgaande kinderen.',
        startDate: holiday.start,
        endDate: holiday.end,
        icon: '🏫',
        expectedAbsenceIncrease: 15,
      })
    }
  }

  // ── Public holidays + bridge days ──────────────────────────────────────
  for (const holiday of PUBLIC_HOLIDAYS_2026) {
    if (holiday.date >= today && holiday.date <= horizon) {
      const dayOfWeek = new Date(holiday.date + 'T00:00:00').getDay()
      const isBridgeOpportunity = dayOfWeek === 4 || dayOfWeek === 2 // Thursday or Tuesday
      signals.push({
        id: `holiday-${holiday.date}`,
        category: 'calendar',
        severity: 'info',
        title: holiday.name,
        description: isBridgeOpportunity
          ? `${holiday.name} valt op ${dayOfWeek === 4 ? 'donderdag' : 'dinsdag'} — verwacht brugdag-verlof.`
          : `Nationale feestdag. Verminderde beschikbaarheid.`,
        impact: isBridgeOpportunity ? 'Hoog brugdag-risico. Tot 40% extra verlofaanvragen.' : 'Plan met verminderde bezetting.',
        startDate: holiday.date,
        endDate: holiday.date,
        icon: '🇳🇱',
        expectedAbsenceIncrease: isBridgeOpportunity ? 25 : 0,
      })
    }
  }

  // ── Business peaks ─────────────────────────────────────────────────────
  for (const peak of BUSINESS_PEAKS) {
    if (peak.end >= today && peak.start <= horizon) {
      const isActive = dateInRange(today, peak.start, peak.end)
      signals.push({
        id: peak.id,
        category: 'economy',
        severity: isActive ? 'high' : 'medium',
        title: peak.title,
        description: peak.description,
        impact: peak.impact,
        startDate: peak.start,
        endDate: peak.end,
        icon: peak.icon,
      })
    }
  }

  // ── Internal patterns (from org data) ──────────────────────────────────
  try {
    // Monday effect — check if org has this pattern
    const leaveRecords = await prisma.leaveRecord.findMany({
      where: { organizationId, type: 'absence', status: 'approved' },
      select: { startDate: true },
      take: 200,
      orderBy: { createdAt: 'desc' },
    })

    if (leaveRecords.length >= 20) {
      const dayCounts = [0, 0, 0, 0, 0, 0, 0] // Sun-Sat
      for (const r of leaveRecords) {
        const day = new Date(r.startDate + 'T00:00:00').getDay()
        dayCounts[day]++
      }
      const avg = leaveRecords.length / 7
      const mondayRatio = dayCounts[1] / Math.max(1, avg)
      if (mondayRatio > 1.3) {
        signals.push({
          id: 'internal-monday-effect',
          category: 'internal',
          severity: 'low',
          title: 'Maandag-effect gedetecteerd',
          description: `Jouw organisatie heeft ${Math.round(mondayRatio * 100 - 100)}% meer ziekmeldingen op maandag dan gemiddeld.`,
          impact: 'Overweeg extra capaciteit op maandag of onderzoek onderliggende oorzaken.',
          startDate: today,
          endDate: horizon,
          icon: '📊',
        })
      }

      // Post-vacation spike detection
      const postVacationCount = leaveRecords.filter((r) => {
        const d = new Date(r.startDate + 'T00:00:00')
        return d.getMonth() === 0 && d.getDate() <= 14 // first 2 weeks of January
      }).length
      const normalMonthAvg = leaveRecords.length / 12
      if (postVacationCount > normalMonthAvg * 1.5) {
        signals.push({
          id: 'internal-post-vacation',
          category: 'internal',
          severity: 'medium',
          title: 'Post-vakantie verzuimpiek',
          description: 'Historisch patroon: eerste weken na kerstvakantie tonen significant hoger verzuim.',
          impact: 'Plan extra buffer-capaciteit voor de eerste 2 weken van januari.',
          startDate: `${year + 1}-01-01`,
          endDate: `${year + 1}-01-14`,
          icon: '📈',
          expectedAbsenceIncrease: 15,
        })
      }
    }
  } catch {
    // Silently skip internal patterns if data access fails
  }

  // Sort: active signals first, then by start date
  signals.sort((a, b) => {
    const aActive = dateInRange(today, a.startDate, a.endDate) ? 0 : 1
    const bActive = dateInRange(today, b.startDate, b.endDate) ? 0 : 1
    if (aActive !== bActive) return aActive - bActive
    return a.startDate.localeCompare(b.startDate)
  })

  return signals
}
