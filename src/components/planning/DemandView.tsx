'use client'

import { useState, useMemo, useCallback, useTransition } from 'react'
import type { VolumeForecast, VolumeActual } from '@prisma/client'
import type { ProcessRow, EmployeeProcessScoreRow } from '@/lib/queries/processes'
import type { EmployeeWithContext } from '@/lib/queries/employees'
import {
  calculateDemand,
  calculateEfficiency,
  aggregateDailyDemand,
  calculateForecastAccuracy,
  detectSeasonalPatterns,
  type ProcessNorm,
  type VolumeForecastEntry,
} from '@/lib/demandEngine'
import { bulkSaveVolumeForecastsAction, importVolumesFromCSVAction } from '@/app/demand/actions'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DeptInfo { id: string; name: string }

interface Props {
  processes: ProcessRow[]
  allProcesses: ProcessRow[]
  forecasts: VolumeForecast[]
  actuals: VolumeActual[]
  employees: EmployeeWithContext[]
  processScores: EmployeeProcessScoreRow[]
  departments: DeptInfo[]
  startDate: string
  canEdit: boolean
}

type Tab = 'grid' | 'demand' | 'accuracy' | 'import'

// ─── Date helpers ────────────────────────────────────────────────────────────

const WEEKDAY_SHORT: Record<number, string> = { 1: 'Ma', 2: 'Di', 3: 'Wo', 4: 'Do', 5: 'Vr' }
const MONTH_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function generateWeekdays(startDate: string, weeks: number): string[] {
  const dates: string[] = []
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(startDate, i)
    const dow = new Date(d + 'T00:00:00').getDay()
    if (dow !== 0 && dow !== 6) dates.push(d)
  }
  return dates
}

function formatDateLabel(dateStr: string): { day: string; date: string; month: string } {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay() === 0 ? 7 : d.getDay()
  return { day: WEEKDAY_SHORT[dow] ?? '', date: String(d.getDate()), month: MONTH_SHORT[d.getMonth()] }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function DemandView({
  processes,
  allProcesses,
  forecasts: initialForecasts,
  actuals,
  // employees available for future efficiency drill-down
  processScores,
  startDate,
  canEdit,
}: Props) {
  const [tab, setTab] = useState<Tab>('grid')
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)

  // Grid state: processId × date → volume
  const [gridData, setGridData] = useState<Map<string, number>>(() => {
    const map = new Map<string, number>()
    for (const f of initialForecasts) {
      map.set(`${f.processId}:${f.date}`, f.volume)
    }
    return map
  })

  const [hasChanges, setHasChanges] = useState(false)
  const dates = useMemo(() => generateWeekdays(startDate, 6), [startDate])

  // CSV import state
  const [csvText, setCsvText] = useState('')
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)

  // ── Process norms ────────────────────────────────────────────────────────

  const processNorms: ProcessNorm[] = useMemo(
    () => processes.map((p) => ({
      id: p.id,
      name: p.name,
      normUnit: p.normUnit,
      normPerHour: p.normPerHour,
      departmentId: null, // Will be resolved from allProcesses if needed
    })),
    [processes],
  )

  // ── Efficiency per process ───────────────────────────────────────────────

  const processEfficiencies = useMemo(() => {
    const map = new Map<string, number>()
    for (const proc of processes) {
      const levels = processScores
        .filter((s) => s.processId === proc.id)
        .map((s) => ({ employeeId: s.employeeId, level: s.level }))
      map.set(proc.id, calculateEfficiency(proc.id, levels))
    }
    return map
  }, [processes, processScores])

  // ── Demand calculation ───────────────────────────────────────────────────

  const forecastEntries: VolumeForecastEntry[] = useMemo(() => {
    const entries: VolumeForecastEntry[] = []
    gridData.forEach((volume, key) => {
      const [processId, date] = key.split(':')
      if (volume > 0) {
        entries.push({ processId, date, volume, confidence: 'firm', source: 'manual' })
      }
    })
    return entries
  }, [gridData])

  const demandResults = useMemo(
    () => calculateDemand({ forecasts: forecastEntries, processes: processNorms, processEfficiencies }),
    [forecastEntries, processNorms, processEfficiencies],
  )

  const dailySummaries = useMemo(
    () => aggregateDailyDemand(demandResults, processNorms),
    [demandResults, processNorms],
  )

  // ── Forecast accuracy ────────────────────────────────────────────────────

  const forecastAccuracy = useMemo(
    () => calculateForecastAccuracy(
      initialForecasts.map((f) => ({ processId: f.processId, date: f.date, volume: f.volume })),
      actuals.map((a) => ({ processId: a.processId, date: a.date, volume: a.volume })),
      processNorms,
    ),
    [initialForecasts, actuals, processNorms],
  )

  // ── Seasonal patterns ────────────────────────────────────────────────────

  const seasonalPatterns = useMemo(
    () => detectSeasonalPatterns(
      actuals.map((a) => ({ processId: a.processId, date: a.date, volume: a.volume })),
      processNorms,
    ),
    [actuals, processNorms],
  )

  // ── KPIs ─────────────────────────────────────────────────────────────────

  const totalVolume = forecastEntries.reduce((s, e) => s + e.volume, 0)
  const totalRequiredHours = demandResults.reduce((s, r) => s + r.requiredHours, 0)
  const totalRequiredFTE = demandResults.reduce((s, r) => s + r.requiredFTE, 0)
  const avgEfficiency = processEfficiencies.size > 0
    ? Array.from(processEfficiencies.values()).reduce((s, e) => s + e, 0) / processEfficiencies.size
    : 1

  // ── Grid handlers ────────────────────────────────────────────────────────

  const updateCell = useCallback((processId: string, date: string, value: number) => {
    setGridData((prev) => {
      const next = new Map(prev)
      if (value > 0) {
        next.set(`${processId}:${date}`, value)
      } else {
        next.delete(`${processId}:${date}`)
      }
      return next
    })
    setHasChanges(true)
  }, [])

  function saveGrid() {
    const entries: { processId: string; date: string; volume: number }[] = []
    gridData.forEach((volume, key) => {
      const [processId, date] = key.split(':')
      entries.push({ processId, date, volume })
    })

    startTransition(async () => {
      const res = await bulkSaveVolumeForecastsAction(entries)
      if (res.ok) {
        setToast(`${res.count} volumes opgeslagen`)
        setHasChanges(false)
        setTimeout(() => setToast(null), 3000)
      } else {
        setToast(res.error ?? 'Fout bij opslaan')
        setTimeout(() => setToast(null), 3000)
      }
    })
  }

  function handleImportCSV() {
    if (!csvText.trim()) return

    const lines = csvText.trim().split('\n').filter((l) => l.trim())
    if (lines.length < 2) return

    // Parse: expect header row + data rows
    // Format: Process,Date,Volume or Process,YYYY-MM-DD,YYYY-MM-DD,...
    const headerCells = lines[0].split(',').map((c) => c.trim())

    // Detect format: pivoted (dates as columns) or list (Process,Date,Volume)
    const isDateHeader = headerCells.length > 2 && /^\d{4}-\d{2}-\d{2}$/.test(headerCells[1])

    const rows: { processName: string; date: string; volume: number }[] = []

    if (isDateHeader) {
      // Pivoted: Process, 2026-03-18, 2026-03-19, ...
      const dateCols = headerCells.slice(1)
      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(',').map((c) => c.trim())
        const processName = cells[0]
        for (let j = 0; j < dateCols.length; j++) {
          const vol = parseFloat(cells[j + 1])
          if (!isNaN(vol) && vol >= 0) {
            rows.push({ processName, date: dateCols[j], volume: vol })
          }
        }
      }
    } else {
      // List: Process,Date,Volume
      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(',').map((c) => c.trim())
        if (cells.length >= 3) {
          const vol = parseFloat(cells[2])
          if (!isNaN(vol)) {
            rows.push({ processName: cells[0], date: cells[1], volume: vol })
          }
        }
      }
    }

    startTransition(async () => {
      const res = await importVolumesFromCSVAction(rows)
      if (res.ok) {
        setImportResult({ imported: res.imported ?? 0, skipped: res.skipped ?? 0 })
        setToast(`${res.imported} volumes geimporteerd`)
        setTimeout(() => setToast(null), 3000)
      } else {
        setToast(res.error ?? 'Import mislukt')
        setTimeout(() => setToast(null), 3000)
      }
    })
  }

  // ── Detect week boundaries ───────────────────────────────────────────────

  const weekStarts = useMemo(() => {
    const starts = new Set<string>()
    let lastWeek = -1
    for (const date of dates) {
      const d = new Date(date + 'T00:00:00')
      const dow = d.getDay()
      if (dow === 1 || lastWeek === -1) {
        starts.add(date)
        lastWeek = dow
      }
    }
    return starts
  }, [dates])

  // ─── Render ──────────────────────────────────────────────────────────────

  if (processes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white px-8 py-16 text-center">
        <p className="text-sm font-semibold text-gray-900 mb-1">Geen processen met normen</p>
        <p className="text-[13px] text-gray-500 max-w-sm mx-auto">
          Voeg productienormen toe aan processen (norm per uur) om demand planning te activeren.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Totaal Volume</p>
          <p className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">{Math.round(totalVolume).toLocaleString()}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">eenheden (6 weken)</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Benodigde Uren</p>
          <p className="text-xl font-bold text-blue-600 tabular-nums mt-0.5">{Math.round(totalRequiredHours).toLocaleString()}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">totaal arbeid</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Benodigde FTE</p>
          <p className="text-xl font-bold text-emerald-600 tabular-nums mt-0.5">{totalRequiredFTE.toFixed(1)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">op 8-uurs shift</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Gem. Efficiency</p>
          <p className={`text-xl font-bold tabular-nums mt-0.5 ${avgEfficiency >= 0.9 ? 'text-emerald-600' : avgEfficiency >= 0.7 ? 'text-amber-600' : 'text-red-600'}`}>
            {Math.round(avgEfficiency * 100)}%
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">skill-gewogen</p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-0.5 border-b border-gray-200">
        {([
          { key: 'grid' as Tab, label: 'Volume Grid' },
          { key: 'demand' as Tab, label: 'Demand Analysis' },
          { key: 'accuracy' as Tab, label: 'Forecast Accuracy' },
          { key: 'import' as Tab, label: 'Import' },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Grid Tab ────────────────────────────────────────────────────────── */}
      {tab === 'grid' && (
        <div className="space-y-3">
          {canEdit && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">Klik op een cel om het volume in te voeren. Wijzigingen worden pas opgeslagen na klik op &quot;Opslaan&quot;.</p>
              <button
                type="button"
                onClick={saveGrid}
                disabled={!hasChanges || isPending}
                className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                {isPending ? 'Opslaan...' : hasChanges ? 'Opslaan' : 'Opgeslagen'}
              </button>
            </div>
          )}

          <div className="overflow-auto rounded-2xl border border-gray-200 shadow-sm bg-white" style={{ maxHeight: 'calc(100vh - 380px)' }}>
            <table className="min-w-full border-collapse text-sm">
              <thead className="sticky top-0 z-20">
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="sticky left-0 z-30 bg-gray-50 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400 w-48 min-w-[12rem] border-r border-gray-200">
                    Proces
                  </th>
                  {dates.map((date) => {
                    const label = formatDateLabel(date)
                    const isToday = date === new Date().toISOString().slice(0, 10)
                    const isWeekStart = weekStarts.has(date) && date !== dates[0]
                    return (
                      <th key={date} className={`px-1 py-2 text-center min-w-[70px] ${isWeekStart ? 'border-l-2 border-gray-200' : ''}`}>
                        <p className={`text-[10px] font-medium ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>{label.day}</p>
                        <p className={`text-xs font-bold tabular-nums ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>{label.date}</p>
                        <p className="text-[9px] text-gray-300">{label.month}</p>
                      </th>
                    )
                  })}
                  <th className="bg-gray-50 px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-widest text-gray-400 min-w-[60px]">
                    Totaal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/80">
                {processes.map((proc) => {
                  const rowTotal = dates.reduce((sum, date) => sum + (gridData.get(`${proc.id}:${date}`) ?? 0), 0)
                  return (
                    <tr key={proc.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="sticky left-0 z-10 bg-white px-4 py-2.5 border-r border-gray-200">
                        <div className="flex items-center gap-2">
                          {proc.color && <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: proc.color }} />}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-900 truncate">{proc.name}</p>
                            <p className="text-[10px] text-gray-400">{proc.normPerHour}/{proc.normUnit ?? 'u'}/uur</p>
                          </div>
                        </div>
                      </td>
                      {dates.map((date) => {
                        const key = `${proc.id}:${date}`
                        const value = gridData.get(key) ?? 0
                        const isWeekStart = weekStarts.has(date) && date !== dates[0]
                        return (
                          <td key={date} className={`px-1 py-1 ${isWeekStart ? 'border-l-2 border-gray-200' : ''}`}>
                            <input
                              type="number"
                              min={0}
                              value={value || ''}
                              onChange={(e) => updateCell(proc.id, date, parseFloat(e.target.value) || 0)}
                              disabled={!canEdit}
                              className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs text-center tabular-nums text-gray-700 hover:border-gray-200 focus:border-gray-400 focus:bg-white focus:outline-none transition-colors disabled:opacity-50"
                              placeholder="-"
                            />
                          </td>
                        )
                      })}
                      <td className="px-3 py-2 text-center">
                        <span className="text-xs font-bold tabular-nums text-gray-700">{rowTotal > 0 ? Math.round(rowTotal).toLocaleString() : '-'}</span>
                      </td>
                    </tr>
                  )
                })}
                {/* Daily totals row */}
                <tr className="bg-gray-50/50 border-t border-gray-200">
                  <td className="sticky left-0 z-10 bg-gray-50/50 px-4 py-2 border-r border-gray-200">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">FTE nodig</p>
                  </td>
                  {dates.map((date) => {
                    const daySummary = dailySummaries.find((s) => s.date === date)
                    const fte = daySummary?.totalRequiredFTE ?? 0
                    const isWeekStart = weekStarts.has(date) && date !== dates[0]
                    return (
                      <td key={date} className={`px-1 py-2 text-center ${isWeekStart ? 'border-l-2 border-gray-200' : ''}`}>
                        <span className={`text-xs font-bold tabular-nums ${fte > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                          {fte > 0 ? fte.toFixed(1) : '-'}
                        </span>
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 text-center">
                    <span className="text-xs font-bold tabular-nums text-blue-600">
                      {totalRequiredFTE > 0 ? totalRequiredFTE.toFixed(1) : '-'}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Demand Analysis Tab ─────────────────────────────────────────────── */}
      {tab === 'demand' && (
        <div className="space-y-4">
          {/* Daily demand chart (text-based bar chart) */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Dagelijkse FTE Behoefte</h3>
            <div className="space-y-2">
              {dailySummaries.map((day) => {
                const label = formatDateLabel(day.date)
                const maxFTE = Math.max(...dailySummaries.map((d) => d.totalRequiredFTE), 1)
                const pct = (day.totalRequiredFTE / maxFTE) * 100
                return (
                  <div key={day.date} className="flex items-center gap-3">
                    <div className="w-16 text-right">
                      <span className="text-[10px] text-gray-400">{label.day}</span>
                      <span className="text-xs font-bold tabular-nums text-gray-700 ml-1">{label.date}</span>
                    </div>
                    <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-lg transition-all duration-500 flex items-center px-2"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      >
                        {pct > 20 && (
                          <span className="text-[10px] font-bold text-white tabular-nums">{day.totalRequiredFTE.toFixed(1)}</span>
                        )}
                      </div>
                    </div>
                    {pct <= 20 && (
                      <span className="text-[10px] font-bold text-gray-600 tabular-nums w-8">{day.totalRequiredFTE.toFixed(1)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Per-process breakdown */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Per Proces Breakdown</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400">Proces</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400">Volume</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400">Norm/uur</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400">Efficiency</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400">Uren</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400">FTE (P10)</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400">FTE (P50)</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400">FTE (P90)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {processes.map((proc) => {
                  const procResults = demandResults.filter((r) => r.processId === proc.id)
                  const totalVol = procResults.reduce((s, r) => s + r.volume, 0)
                  const totalHours = procResults.reduce((s, r) => s + r.requiredHours, 0)
                  const totalP10 = procResults.reduce((s, r) => s + r.requiredFTE_P10, 0)
                  const totalP50 = procResults.reduce((s, r) => s + r.requiredFTE_P50, 0)
                  const totalP90 = procResults.reduce((s, r) => s + r.requiredFTE_P90, 0)
                  const eff = processEfficiencies.get(proc.id) ?? 1

                  if (totalVol === 0) return null

                  return (
                    <tr key={proc.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {proc.color && <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: proc.color }} />}
                          <span className="text-xs font-medium text-gray-900">{proc.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums font-semibold text-gray-700">{Math.round(totalVol).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-gray-500">{proc.normPerHour}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-xs tabular-nums font-semibold ${eff >= 0.9 ? 'text-emerald-600' : eff >= 0.7 ? 'text-amber-600' : 'text-red-600'}`}>
                          {Math.round(eff * 100)}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums font-semibold text-blue-600">{Math.round(totalHours)}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-emerald-600">{totalP10.toFixed(1)}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums font-bold text-gray-900">{totalP50.toFixed(1)}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-red-600">{totalP90.toFixed(1)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Seasonal patterns */}
          {seasonalPatterns.some((p) => p.hasPattern) && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Seizoenspatronen</h3>
              <p className="text-xs text-gray-500 mb-4">Weekdagindices op basis van historische volumes. 1.0 = gemiddeld.</p>
              <div className="space-y-2">
                {seasonalPatterns.filter((p) => p.hasPattern).map((pattern) => (
                  <div key={pattern.processId} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-gray-900 w-24 truncate">{pattern.processName}</span>
                    <div className="flex gap-1">
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => {
                        const idx = pattern.weekdayIndices[day] ?? 1
                        return (
                          <div
                            key={day}
                            className="w-10 h-8 rounded-md flex items-center justify-center text-[10px] font-bold tabular-nums"
                            style={{
                              backgroundColor: idx > 1.1 ? `rgba(239,68,68,${Math.min((idx - 1) * 2, 0.3)})` :
                                idx < 0.9 ? `rgba(16,185,129,${Math.min((1 - idx) * 2, 0.3)})` : 'rgba(0,0,0,0.03)',
                              color: idx > 1.1 ? '#dc2626' : idx < 0.9 ? '#059669' : '#6b7280',
                            }}
                            title={`${day}: ${idx}`}
                          >
                            {idx.toFixed(2)}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Accuracy Tab ────────────────────────────────────────────────────── */}
      {tab === 'accuracy' && (
        <div className="space-y-4">
          {forecastAccuracy.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white px-8 py-16 text-center">
              <p className="text-sm font-semibold text-gray-900 mb-1">Geen accuracy data</p>
              <p className="text-[13px] text-gray-500 max-w-sm mx-auto">
                Voer werkelijke volumes in (VolumeActual) om forecast accuracy te berekenen.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Forecast vs. Realisatie</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">MAPE = Mean Absolute Percentage Error. Bias: positief = overschatting.</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400">Proces</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400">MAPE</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400">Bias</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400">Datapunten</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {forecastAccuracy.map((acc) => (
                    <tr key={acc.processId}>
                      <td className="px-4 py-2.5 text-xs font-medium text-gray-900">{acc.processName}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-xs font-bold tabular-nums ${acc.mape <= 0.1 ? 'text-emerald-600' : acc.mape <= 0.2 ? 'text-amber-600' : 'text-red-600'}`}>
                          {(acc.mape * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-xs font-bold tabular-nums ${acc.bias > 0 ? 'text-amber-600' : 'text-blue-600'}`}>
                          {acc.bias > 0 ? '+' : ''}{(acc.bias * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-gray-500">{acc.dataPoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Import Tab ──────────────────────────────────────────────────────── */}
      {tab === 'import' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">CSV Import</h3>
            <p className="text-xs text-gray-500 mb-4">
              Plak of upload een CSV met volumes. Twee formaten worden ondersteund:
            </p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Lijst formaat</p>
                <pre className="text-[10px] text-gray-600 font-mono">
                  Process,Date,Volume{'\n'}Picking,2026-03-18,15000{'\n'}Packing,2026-03-18,8000
                </pre>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Pivot formaat</p>
                <pre className="text-[10px] text-gray-600 font-mono">
                  Process,2026-03-18,2026-03-19{'\n'}Picking,15000,14000{'\n'}Packing,8000,7500
                </pre>
              </div>
            </div>

            <textarea
              value={csvText}
              onChange={(e) => { setCsvText(e.target.value); setImportResult(null) }}
              placeholder="Plak hier CSV data..."
              rows={8}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-mono text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:outline-none resize-y"
            />

            <div className="flex items-center justify-between mt-3">
              {importResult && (
                <p className="text-xs text-gray-600">
                  <span className="font-semibold text-emerald-600">{importResult.imported}</span> geimporteerd
                  {importResult.skipped > 0 && (
                    <>, <span className="font-semibold text-amber-600">{importResult.skipped}</span> overgeslagen</>
                  )}
                </p>
              )}
              <button
                type="button"
                onClick={handleImportCSV}
                disabled={!csvText.trim() || isPending}
                className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-40 transition-colors ml-auto"
              >
                {isPending ? 'Importeren...' : 'Importeer'}
              </button>
            </div>
          </div>

          {/* Existing processes reference */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Beschikbare Processen (voor matching)</h3>
            <div className="flex flex-wrap gap-2">
              {allProcesses.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1 text-[10px] font-medium text-gray-600">
                  {p.color && <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />}
                  {p.name}
                  {p.normPerHour ? <span className="text-gray-400">({p.normPerHour}/u)</span> : <span className="text-red-400">(geen norm)</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
