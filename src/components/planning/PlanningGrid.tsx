'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import type { Employee } from '@/lib/queries/employees'
import type { AssignmentWithRelations } from '@/lib/queries/assignments'
import type { StaffingStatus } from '@/lib/staffing'
import type { ComplianceResult } from '@/lib/compliance'

export type Density = 'focus' | 'balanced' | 'power'

interface Props {
  employees: Employee[]
  dates: string[]
  assignments: AssignmentWithRelations[]
  density: Density
  selectedAssignmentId?: string | null
  readonly?: boolean
  onCellClick?: (employee: Employee, date: string) => void
  onAssignmentClick?: (assignment: AssignmentWithRelations) => void
  onAssignmentMove?: (assignmentId: string, targetEmployeeId: string, targetDate: string) => void
  onAssignmentCopy?: (assignmentId: string, targetEmployeeId: string, targetDate: string) => void
  /** Optional per-date staffing status for column header indicators */
  staffingMap?: Map<string, StaffingStatus>
  /** Optional compliance data for employee-column weekly status and cell daily signals */
  complianceData?: ComplianceResult
  /** Assignment IDs that violate their employee's team rotation schedule */
  rotationViolationIds?: Set<string>
}

const DENSITY_CONFIG: Record<Density, {
  colWidth: number
  empColWidth: number
  weekHeader: string
  dayHeader: string
  empCell: string
  dataCell: string
  cellMinH: string
  gap: string
  block: string
  blockName: string
  showTime: boolean
  maxVisible: number
}> = {
  focus: {
    colWidth: 168,
    empColWidth: 208,
    weekHeader: 'px-3 py-2',
    dayHeader: 'px-3 py-3',
    empCell: 'px-4 py-4',
    dataCell: 'px-2.5 py-3',
    cellMinH: 'min-h-[5rem]',
    gap: 'gap-2',
    block: 'px-3 py-2.5 rounded-xl',
    blockName: 'text-sm font-semibold',
    showTime: true,
    maxVisible: 4,
  },
  balanced: {
    colWidth: 136,
    empColWidth: 192,
    weekHeader: 'px-3 py-1.5',
    dayHeader: 'px-3 py-2',
    empCell: 'px-4 py-3',
    dataCell: 'px-2 py-2',
    cellMinH: 'min-h-[2.5rem]',
    gap: 'gap-1',
    block: 'px-2.5 py-2 rounded-lg',
    blockName: 'text-xs font-semibold',
    showTime: true,
    maxVisible: 3,
  },
  power: {
    colWidth: 108,
    empColWidth: 160,
    weekHeader: 'px-2 py-1',
    dayHeader: 'px-2 py-1.5',
    empCell: 'px-3 py-2',
    dataCell: 'px-1.5 py-1',
    cellMinH: 'min-h-0',
    gap: 'gap-0.5',
    block: 'px-2 py-1 rounded-md',
    blockName: 'text-xs font-medium',
    showTime: false,
    maxVisible: 2,
  },
}

function isoWeekNumber(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}

function formatShort(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatDayHeader(dateStr: string): { weekday: string; date: string } {
  const d = new Date(dateStr + 'T00:00:00')
  return {
    weekday: d.toLocaleDateString('en-GB', { weekday: 'short' }),
    date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
  }
}

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const TYPE_BADGE: Record<string, string> = {
  internal: 'bg-blue-100 text-blue-700',
  temp: 'bg-orange-100 text-orange-700',
}

const SHIFT_COLORS = [
  'bg-slate-800',
  'bg-blue-700',
  'bg-violet-700',
  'bg-teal-700',
  'bg-rose-700',
  'bg-amber-700',
]

export default function PlanningGrid({
  employees,
  dates,
  assignments,
  density,
  selectedAssignmentId,
  readonly,
  onCellClick,
  onAssignmentClick,
  onAssignmentMove,
  onAssignmentCopy,
  staffingMap,
  complianceData,
  rotationViolationIds,
}: Props) {
  // ── Drag state ─────────────────────────────────────────────────────────────
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCell, setDragOverCell] = useState<{ empId: string; date: string } | null>(null)
  const [isDuplicating, setIsDuplicating] = useState(false)
  // Prevent the mouseup after a drag finishing from triggering onClick
  const dragJustFinished = useRef(false)

  // ── Overflow expansion ─────────────────────────────────────────────────────
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set())
  const toggleExpand = useCallback((empId: string, date: string) => {
    const key = `${empId}:${date}`
    setExpandedCells((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // ── Memoized derived data ───────────────────────────────────────────────────
  const today = useMemo(() => todayString(), [])

  const draggingAssignment = useMemo(
    () => (draggingId ? (assignments.find((a) => a.id === draggingId) ?? null) : null),
    [draggingId, assignments]
  )

  const templateColorMap = useMemo(() => {
    const map = new Map<string, string>()
    let ci = 0
    for (const a of assignments) {
      if (!map.has(a.shiftTemplateId)) {
        map.set(a.shiftTemplateId, SHIFT_COLORS[ci % SHIFT_COLORS.length])
        ci++
      }
    }
    return map
  }, [assignments])

  const lookup = useMemo(() => {
    const map = new Map<string, Map<string, AssignmentWithRelations[]>>()
    for (const emp of employees) map.set(emp.id, new Map())
    for (const a of assignments) {
      const byDate = map.get(a.employeeId)
      if (!byDate) continue
      const date = a.rosterDay.date
      const list = byDate.get(date) ?? []
      list.push(a)
      byDate.set(date, list)
    }
    return map
  }, [employees, assignments])

  const weekGroups = useMemo(() => {
    const groups: Array<{ label: string; count: number }> = []
    for (let i = 0; i < dates.length; i += 7) {
      const chunk = dates.slice(i, i + 7)
      const wn = isoWeekNumber(chunk[0])
      groups.push({
        label: `W${wn} · ${formatShort(chunk[0])} – ${formatShort(chunk[chunk.length - 1])}`,
        count: chunk.length,
      })
    }
    return groups
  }, [dates])

  // ── Early exit ──────────────────────────────────────────────────────────────
  if (employees.length === 0) {
    return <p className="text-sm text-gray-500 py-6">Add employees first to start planning.</p>
  }

  const cfg = DENSITY_CONFIG[density]
  const totalWidth = cfg.empColWidth + dates.length * cfg.colWidth

  // The two-row thead needs sticky support.
  // Row 1 (week groups) sits at top:0; Row 2 (day headers) sits directly below Row 1.
  // Heights are computed from Tailwind spacing (1 unit = 4px) + text-xs line-height (16px).
  // border-collapse:collapse means borders do NOT add to cell height.
  //   focus  : py-2   = 8+16+8  = 32 px
  //   balanced: py-1.5 = 6+16+6  = 28 px
  //   power  : py-1   = 4+16+4  = 24 px
  const ROW1_HEIGHTS: Record<Density, number> = { focus: 32, balanced: 28, power: 24 }
  const row1H = ROW1_HEIGHTS[density]

  return (
    // overflow-x-auto handles horizontal scroll for wide tables.
    // overflow-y-clip is intentional: 'clip' does NOT form a scroll container,
    // so position:sticky on <th> inside looks past this div to <main
    // class="overflow-y-auto"> (the true page scroll container) — making
    // the sticky header work correctly.
    <div className="overflow-x-auto overflow-y-clip rounded-xl border border-gray-200 shadow-sm">
      <table
        className="border-collapse text-sm"
        style={{ minWidth: `${totalWidth}px`, width: `${totalWidth}px` }}
      >
        <thead>
          {/* Row 1: week group headers — sticky top-0 */}
          <tr>
            <th
              rowSpan={2}
              className={`sticky left-0 z-30 bg-slate-800 border-b border-r border-slate-700 text-left align-bottom ${cfg.empCell}`}
              style={{ width: cfg.empColWidth, minWidth: cfg.empColWidth, top: 0 }}
            />
            {weekGroups.map((wg, wi) => (
              <th
                key={wi}
                colSpan={wg.count}
                className={`sticky z-20 bg-slate-800 border-b border-r border-slate-700 text-left ${cfg.weekHeader}`}
                style={{ width: wg.count * cfg.colWidth, top: 0 }}
              >
                <span className="text-xs font-semibold text-slate-300 tracking-wide whitespace-nowrap">
                  {wg.label}
                </span>
              </th>
            ))}
          </tr>
          {/* Row 2: individual day headers — sticky below Row 1 */}
          <tr>
            {dates.map((date) => {
              const { weekday, date: shortDate } = formatDayHeader(date)
              const isToday = date === today
              const dayStatus = staffingMap?.get(date)
              return (
                <th
                  key={date}
                  className={[
                    'sticky z-20 border-b-2 border-r text-center',
                    'shadow-[0_4px_8px_-2px_rgba(0,0,0,0.10)]',
                    cfg.dayHeader,
                    isToday
                      ? 'bg-blue-600 border-b-blue-700 border-r-blue-500'
                      : 'bg-white border-b-slate-800 border-r-gray-200',
                  ].join(' ')}
                  style={{ width: cfg.colWidth, top: row1H }}
                >
                  <div className={`text-[10px] font-bold uppercase tracking-widest leading-none ${isToday ? 'text-blue-200' : 'text-gray-400'}`}>
                    {weekday}
                  </div>
                  <div className={[
                    'mt-1 leading-none font-bold tabular-nums',
                    density === 'power' ? 'text-sm' : 'text-base',
                    isToday ? 'text-white' : 'text-gray-900',
                  ].join(' ')}>
                    {shortDate}
                  </div>
                  {isToday && density !== 'power' && (
                    <div className="mt-1.5 mx-auto w-1.5 h-1.5 rounded-full bg-white/60" />
                  )}
                  {dayStatus && dayStatus !== 'staffed' && (
                    <div
                      className={[
                        'mt-1 h-0.5 rounded-full',
                        dayStatus === 'understaffed'
                          ? isToday ? 'bg-red-300' : 'bg-red-400'
                          : isToday ? 'bg-amber-300' : 'bg-amber-400',
                      ].join(' ')}
                    />
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {employees.map((emp) => {
            const byDate = lookup.get(emp.id)!
            const badge = TYPE_BADGE[emp.employeeType] ?? 'bg-gray-100 text-gray-600'
            const wc = complianceData?.weekly.get(emp.id) ?? null
            return (
              <tr key={emp.id} className="group">
                <td
                  className={`sticky left-0 z-10 bg-white group-hover:bg-gray-50/50 border-r border-gray-200 whitespace-nowrap transition-colors duration-150 ${cfg.empCell}`}
                >
                  <div className="font-medium text-gray-900 text-sm leading-tight">{emp.name}</div>
                  {density !== 'power' && (
                    <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${badge}`}>
                      {emp.employeeType}
                    </span>
                  )}
                  {density === 'power' && (
                    <div className={`text-xs font-medium capitalize mt-0.5 ${emp.employeeType === 'internal' ? 'text-blue-600' : 'text-orange-600'}`}>
                      {emp.contractHours}h
                    </div>
                  )}
                  {wc && (
                    <div className={[
                      'text-xs font-semibold leading-none mt-1',
                      wc.status === 'on-target' ? 'text-green-600' :
                      wc.status === 'under'     ? 'text-amber-600' : 'text-red-600',
                    ].join(' ')}>
                      {wc.status === 'on-target' ? '✓' : wc.deltaLabel}
                    </div>
                  )}
                </td>
                {dates.map((date) => {
                  const cells = byDate.get(date) ?? []
                  const isEmpty = cells.length === 0
                  const isToday = date === today
                  const dailySignal = complianceData?.dailySignals.get(`${emp.id}:${date}`)?.signal ?? null

                  // A valid drop target: something is being dragged AND this is not the source cell
                  const isDropTarget =
                    draggingAssignment !== null &&
                    dragOverCell?.empId === emp.id &&
                    dragOverCell?.date === date &&
                    !(draggingAssignment.employeeId === emp.id &&
                      draggingAssignment.rosterDay.date === date)

                  return (
                    <td
                      key={date}
                      onClick={() => {
                        if (dragJustFinished.current) return
                        onCellClick?.(emp, date)
                      }}
                      onDragOver={(e) => {
                        if (readonly || !draggingId) return
                        e.preventDefault()
                        const duplicating = e.altKey
                        e.dataTransfer.dropEffect = duplicating ? 'copy' : 'move'
                        if (isDuplicating !== duplicating) setIsDuplicating(duplicating)
                        if (dragOverCell?.empId !== emp.id || dragOverCell?.date !== date) {
                          setDragOverCell({ empId: emp.id, date })
                        }
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          setDragOverCell(null)
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (!draggingAssignment) return
                        const sameCell =
                          draggingAssignment.employeeId === emp.id &&
                          draggingAssignment.rosterDay.date === date
                        if (!sameCell) {
                          if (isDuplicating) {
                            onAssignmentCopy?.(draggingAssignment.id, emp.id, date)
                          } else {
                            onAssignmentMove?.(draggingAssignment.id, emp.id, date)
                          }
                        }
                        setDraggingId(null)
                        setDragOverCell(null)
                        setIsDuplicating(false)
                      }}
                      className={[
                        'border-r border-gray-100 align-top transition-all duration-150 group/cell',
                        cfg.dataCell,
                        isToday && !isDropTarget ? 'bg-blue-50/25' : '',
                        isDropTarget
                          ? isDuplicating
                            ? 'bg-green-50 ring-2 ring-inset ring-green-400/60'
                            : 'bg-blue-50 ring-2 ring-inset ring-blue-400/60'
                          : !readonly && onCellClick
                          ? isEmpty
                            ? 'cursor-pointer hover:bg-blue-50/40'
                            : 'cursor-pointer hover:bg-gray-50/60'
                          : '',
                      ].join(' ')}
                    >
                      {isEmpty ? (
                        <div className={`flex items-center justify-center ${cfg.cellMinH}`}>
                          {!readonly && onCellClick && (
                            <svg
                              className="w-3 h-3 text-gray-200 group-hover/cell:text-blue-300 transition-colors duration-150"
                              viewBox="0 0 12 12"
                              fill="none"
                              aria-hidden="true"
                            >
                              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          )}
                        </div>
                      ) : (
                        (() => {
                          const cellKey = `${emp.id}:${date}`
                          const isExpanded = expandedCells.has(cellKey)
                          const overflowCount = cells.length - cfg.maxVisible
                          const visibleCells = isExpanded ? cells : cells.slice(0, cfg.maxVisible)
                          return (
                            <div className={`flex flex-col ${cfg.gap} ${cfg.cellMinH}`}>
                              {visibleCells.map((a) => {
                                const color = templateColorMap.get(a.shiftTemplateId) ?? 'bg-slate-800'
                                const isSelected = a.id === selectedAssignmentId
                                const isDragging = a.id === draggingId
                                return (
                                  <div
                                    key={a.id}
                                    draggable={!readonly}
                                    title={`${a.shiftTemplate.name} · ${a.shiftTemplate.startTime}–${a.shiftTemplate.endTime} · ${emp.name}`}
                                    onDragStart={(e) => {
                                      if (readonly) return
                                      e.stopPropagation()
                                      e.dataTransfer.effectAllowed = 'copyMove'
                                      e.dataTransfer.setData('text/plain', a.id)
                                      setDraggingId(a.id)
                                      setIsDuplicating(e.altKey)
                                      dragJustFinished.current = false
                                    }}
                                    onDragEnd={() => {
                                      setDraggingId(null)
                                      setDragOverCell(null)
                                      setIsDuplicating(false)
                                      dragJustFinished.current = true
                                      setTimeout(() => { dragJustFinished.current = false }, 150)
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (dragJustFinished.current) return
                                      onAssignmentClick?.(a)
                                    }}
                                    className={[
                                      color,
                                      cfg.block,
                                      'shift-card-enter group/card relative text-white shadow transition-all duration-150 ease-out select-none overflow-hidden',
                                      !readonly && onAssignmentMove ? 'cursor-grab active:cursor-grabbing' : '',
                                      onAssignmentClick ? 'hover:shadow-lg hover:scale-[1.015] hover:-translate-y-px active:scale-[0.99] active:shadow-sm' : '',
                                      isSelected ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-black/20 shadow-xl scale-[1.01]' : '',
                                      isDragging ? (isDuplicating ? 'opacity-60 scale-[0.97]' : 'opacity-25 scale-[0.96]') : '',
                                    ].join(' ')}
                                  >
                                    {/* top-edge gloss line */}
                                    <div className="absolute inset-x-0 top-0 h-px bg-white/20 pointer-events-none" aria-hidden="true" />

                                    {isDragging && isDuplicating && (
                                      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white leading-none select-none">
                                        +
                                      </span>
                                    )}
                                    {rotationViolationIds?.has(a.id) && (
                                      <span
                                        className="absolute top-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-white leading-none select-none"
                                        title="Team rotation conflict: this employee is assigned to a different shift this week according to their team schedule"
                                      >
                                        !
                                      </span>
                                    )}

                                    {/* Primary: shift name */}
                                    <div className={`${cfg.blockName} leading-tight truncate`}>
                                      {a.shiftTemplate.name}
                                    </div>

                                    {/* Secondary: time with clock icon */}
                                    {cfg.showTime && (
                                      <div className="mt-1 flex items-center gap-1 min-w-0">
                                        <svg className="shrink-0 w-2.5 h-2.5 text-white/40" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                                          <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2" />
                                          <path d="M5 3v2.2l1.4 1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <span className="text-xs text-white/75 leading-none tabular-nums font-medium truncate">
                                          {a.shiftTemplate.startTime}–{a.shiftTemplate.endTime}
                                        </span>
                                      </div>
                                    )}

                                    {/* Quick action: open details — reveals on hover, hidden otherwise */}
                                    {onAssignmentClick && !readonly && !isDragging && (
                                      <div
                                        className="absolute inset-x-0 bottom-0 flex items-center justify-end px-1.5 pb-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-100"
                                        onClick={(e) => { e.stopPropagation(); onAssignmentClick(a) }}
                                      >
                                        <span className="inline-flex items-center gap-0.5 rounded bg-white/15 hover:bg-white/25 px-1.5 py-0.5 text-[10px] font-semibold text-white/90 transition-colors duration-100 cursor-pointer">
                                          <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                                            <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.3" />
                                            <path d="M5 4v3M5 3h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                                          </svg>
                                          Details
                                        </span>
                                      </div>
                                    )}

                                    {/* Future indicator zone — reserved for team/conflict/AI badges */}
                                    {isSelected && (
                                      <div className="mt-1.5 h-px bg-white/20" aria-hidden="true" />
                                    )}
                                  </div>
                                )
                              })}
                              {!isExpanded && overflowCount > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleExpand(emp.id, date)
                                  }}
                                  className="inline-flex items-center rounded border border-gray-200 bg-white/80 px-1.5 py-0.5 text-xs font-medium text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-colors duration-150"
                                >
                                  +{overflowCount} more
                                </button>
                              )}
                              {isExpanded && cells.length > cfg.maxVisible && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleExpand(emp.id, date)
                                  }}
                                  className="inline-flex items-center rounded border border-gray-200 bg-white/80 px-1.5 py-0.5 text-xs font-medium text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-colors duration-150"
                                >
                                  show less
                                </button>
                              )}
                              {dailySignal && (
                                <div className={[
                                  'self-start text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none',
                                  dailySignal === 'multi-shift' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700',
                                ].join(' ')} title={dailySignal}>
                                  {dailySignal === 'multi-shift' ? '×2' : dailySignal === 'heavy-load' ? '10h+' : '10h+ ×2'}
                                </div>
                              )}
                            </div>
                          )
                        })()
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}


