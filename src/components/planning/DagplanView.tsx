'use client'

import { useMemo } from 'react'
import type { ShiftTemplate } from '@prisma/client'
import type { AssignmentWithRelations } from '@/lib/queries/assignments'
import type { EmployeeWithContext } from '@/lib/queries/employees'
import type { ProcessRow } from '@/lib/queries/processes'

type ProcessWithTiming = ProcessRow & {
  breakPriority?: string
  activeStartTime?: string | null
  activeEndTime?: string | null
}
import { LEVEL_COLORS, LEVEL_LABELS } from '@/components/workforce/SkillLevelIndicator'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  date: string
  shifts: ShiftTemplate[]
  assignments: AssignmentWithRelations[]
  employees: EmployeeWithContext[]
  processes: ProcessWithTiming[]
  processLevelMap: Map<string, number>
  breakCovers?: { sourceProcessId: string; targetProcessId: string; headcount: number }[]
}

interface ShiftBlock {
  shift: ShiftTemplate
  assignedEmployees: EmployeeWithContext[]
  breakBlock: { start: string; end: string; mode: string } | null
}

// ─── Time helpers ────────────────────────────────────────────────────────────

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const WEEKDAY_NL: Record<number, string> = { 0: 'Zondag', 1: 'Maandag', 2: 'Dinsdag', 3: 'Woensdag', 4: 'Donderdag', 5: 'Vrijdag', 6: 'Zaterdag' }
const MONTH_NL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']

// ─── Main Component ──────────────────────────────────────────────────────────

export function DagplanView({
  date,
  shifts,
  assignments,
  employees,
  processes,
  processLevelMap,
  breakCovers = [],
}: Props) {
  const d = new Date(date + 'T00:00:00')
  const dayLabel = `${WEEKDAY_NL[d.getDay()]} ${d.getDate()} ${MONTH_NL[d.getMonth()]} ${d.getFullYear()}`

  const empMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])

  // Build shift blocks with assigned employees
  const shiftBlocks: ShiftBlock[] = useMemo(() => {
    return shifts.map((shift) => {
      const shiftAssignments = assignments.filter(
        (a) => a.rosterDay.date === date && a.shiftTemplateId === shift.id,
      )
      const assignedEmps = shiftAssignments
        .map((a) => empMap.get(a.employeeId))
        .filter((e): e is EmployeeWithContext => !!e)
        .sort((a, b) => a.name.localeCompare(b.name))

      const breakMinutes = shift.breakMinutes ?? 30
      const breakMode = shift.breakMode ?? 'all'
      const shiftStart = parseTime(shift.startTime)
      const breakStart = shift.breakWindowStart
        ? parseTime(shift.breakWindowStart)
        : shiftStart + Math.floor(((parseTime(shift.endTime) > shiftStart ? parseTime(shift.endTime) : parseTime(shift.endTime) + 1440) - shiftStart) / 2) - Math.floor(breakMinutes / 2)

      return {
        shift,
        assignedEmployees: assignedEmps,
        breakBlock: breakMinutes > 0 ? {
          start: formatTime(breakStart),
          end: formatTime(breakStart + breakMinutes),
          mode: breakMode,
        } : null,
      }
    })
  }, [shifts, assignments, date, empMap])

  // Group processes by break priority for cover display
  const criticalProcesses = processes.filter((p) => p.breakPriority === 'critical')
  const flexibleProcesses = processes.filter((p) => p.breakPriority === 'flexible')

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header — printable */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{dayLabel}</h2>
          <p className="text-xs text-gray-500">{shifts.length} shifts &middot; {assignments.filter((a) => a.rosterDay.date === date).length} toewijzingen</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors print:hidden"
        >
          Afdrukken
        </button>
      </div>

      {/* Shift blocks */}
      {shiftBlocks.map(({ shift, assignedEmployees, breakBlock }) => (
        <div key={shift.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden print:break-inside-avoid">
          {/* Shift header */}
          <div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <div>
                <p className="text-sm font-bold text-gray-900">{shift.name}</p>
                <p className="text-[11px] text-gray-500 tabular-nums">{shift.startTime} — {shift.endTime}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-gray-600">{assignedEmployees.length} medewerkers</span>
              {breakBlock && (
                <span className="text-[10px] text-amber-600 bg-amber-50 rounded-md px-2 py-0.5 font-medium">
                  Pauze {breakBlock.start}-{breakBlock.end} ({shift.breakMode === 'all' ? 'tegelijk' : shift.breakMode === 'rotating' ? 'roulerend' : 'vrij'})
                </span>
              )}
            </div>
          </div>

          {/* Work phase: before break */}
          <div className="px-5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
              {shift.startTime} — {breakBlock?.start ?? shift.endTime} &middot; Werkblok
            </p>

            {/* Employee grid grouped by department */}
            <EmployeeGrid
              employees={assignedEmployees}
              processes={processes}
              processLevelMap={processLevelMap}
            />
          </div>

          {/* Break phase */}
          {breakBlock && (
            <div className="px-5 py-3 bg-amber-50/30 border-t border-b border-amber-100/50">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 mb-2">
                {breakBlock.start} — {breakBlock.end} &middot; Pauzeblok
              </p>

              {/* Show break cover movements */}
              {breakCovers.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {breakCovers.map((cover, i) => {
                    const source = processes.find((p) => p.id === cover.sourceProcessId)
                    const target = processes.find((p) => p.id === cover.targetProcessId)
                    if (!source || !target) return null

                    // Find actual employees from source process (by department match)
                    const sourceEmps = assignedEmployees
                      .filter((e) => {
                        // Check if employee has skill for source process
                        const level = processLevelMap.get(`${e.id}:${cover.sourceProcessId}`) ?? 0
                        return level >= 1
                      })
                      .slice(0, cover.headcount)

                    return (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-emerald-700 bg-emerald-50 rounded-md px-2 py-0.5">{source.name}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-medium text-red-700 bg-red-50 rounded-md px-2 py-0.5">{target.name}</span>
                        <span className="text-gray-500">{cover.headcount} medewerker{cover.headcount !== 1 ? 's' : ''}</span>
                        {sourceEmps.length > 0 && (
                          <span className="text-gray-400">
                            ({sourceEmps.map((e) => e.name.split(' ')[0]).join(', ')})
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Who's on break vs working */}
              {shift.breakMode === 'all' && (
                <p className="text-[10px] text-amber-600">Alle medewerkers tegelijk op pauze. Processen staan stil.</p>
              )}
              {shift.breakMode === 'rotating' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-semibold text-emerald-700 mb-1">Werken door</p>
                    <div className="flex flex-wrap gap-1">
                      {assignedEmployees.filter((_, i) => i % 2 === 0).map((emp) => (
                        <EmployeeChip key={emp.id} employee={emp} size="sm" />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-amber-700 mb-1">Op pauze</p>
                    <div className="flex flex-wrap gap-1">
                      {assignedEmployees.filter((_, i) => i % 2 === 1).map((emp) => (
                        <EmployeeChip key={emp.id} employee={emp} size="sm" muted />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Work phase: after break */}
          {breakBlock && (
            <div className="px-5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                {breakBlock.end} — {shift.endTime} &middot; Werkblok
              </p>
              <p className="text-[10px] text-gray-400">Alle medewerkers terug op eigen proces.</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Employee Grid (grouped by department) ───────────────────────────────────

function EmployeeGrid({
  employees,
  processes,
  processLevelMap,
}: {
  employees: EmployeeWithContext[]
  processes: ProcessWithTiming[]
  processLevelMap: Map<string, number>
}) {
  // Group by department
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; employees: EmployeeWithContext[] }>()

    for (const emp of employees) {
      const deptId = emp.department?.id ?? '__none__'
      const deptName = emp.department?.name ?? 'Geen afdeling'
      const group = map.get(deptId) ?? { name: deptName, employees: [] }
      group.employees.push(emp)
      map.set(deptId, group)
    }

    return Array.from(map.values())
  }, [employees])

  if (employees.length === 0) {
    return <p className="text-xs text-gray-400 italic">Geen medewerkers ingepland</p>
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.name}>
          <p className="text-[10px] font-semibold text-gray-500 mb-1">{group.name} ({group.employees.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {group.employees.map((emp) => {
              const maxLevel = processes.reduce((best, proc) => {
                const level = processLevelMap.get(`${emp.id}:${proc.id}`) ?? 0
                return Math.max(best, level)
              }, 0)

              return (
                <div
                  key={emp.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-100 bg-gray-50 px-2 py-1"
                >
                  <div
                    className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                    style={{ backgroundColor: LEVEL_COLORS[maxLevel] }}
                  >
                    {emp.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <span className="text-[10px] font-medium text-gray-700">{emp.name}</span>
                  {emp.employeeType === 'temp' && (
                    <span className="text-[8px] font-bold text-orange-500 bg-orange-50 rounded px-1">T</span>
                  )}
                  {/* Mini process levels */}
                  <div className="flex gap-px ml-0.5">
                    {processes.slice(0, 4).map((proc) => {
                      const level = processLevelMap.get(`${emp.id}:${proc.id}`) ?? 0
                      return (
                        <div
                          key={proc.id}
                          className="h-2 w-2 rounded-sm"
                          style={{
                            backgroundColor: level > 0 ? LEVEL_COLORS[level] : '#e5e7eb',
                            opacity: level > 0 ? 0.7 : 0.2,
                          }}
                          title={`${proc.name}: ${LEVEL_LABELS[level]}`}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Employee Chip ───────────────────────────────────────────────────────────

function EmployeeChip({
  employee,
  size = 'md',
  muted = false,
}: {
  employee: EmployeeWithContext
  size?: 'sm' | 'md'
  muted?: boolean
}) {
  const initials = employee.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 ${
        muted ? 'border-gray-200 bg-gray-100 opacity-50' : 'border-gray-200 bg-white'
      } ${size === 'sm' ? 'text-[9px]' : 'text-[10px]'}`}
    >
      <span className="font-bold text-gray-500">{initials}</span>
      <span className="text-gray-600">{employee.name.split(' ')[0]}</span>
    </span>
  )
}
