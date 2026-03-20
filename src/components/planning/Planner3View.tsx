'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ShiftTemplate } from '@prisma/client'
import type { EmployeeWithContext } from '@/lib/queries/employees'
import type { AssignmentWithRelations } from '@/lib/queries/assignments'
import type { TeamWithSlots } from '@/lib/queries/teams'
import type { ProcessShiftLinkRow } from '@/lib/queries/processShiftLinks'
import type { EmployeeProcessScoreRow } from '@/lib/queries/processes'
import { getActiveShiftTemplateIdForTeam } from '@/lib/teams'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Process3Row {
  id: string
  name: string
  color: string | null
  active: boolean
  departmentId: string | null
  sortOrder: number
}

export interface Dept3Info {
  id: string
  name: string
  color: string
}

interface ProcessFteCell {
  processId: string
  processName: string
  processColor: string | null
  assignedFTE: number
  capableFTE: number
  status: 'green' | 'amber' | 'red' | 'gray'
}

interface TeamNode {
  teamId: string
  teamName: string
  teamColor: string | null
  headcountInDept: number
  activeShiftTemplateId: string | null
  activeShiftName: string | null
  processCells: ProcessFteCell[]
}

interface DeptNode {
  deptId: string
  deptName: string
  deptColor: string
  totalAssignedFTE: number
  teamNodes: TeamNode[]
  orphanProcesses: ProcessFteCell[]
}

interface Props {
  employees: EmployeeWithContext[]
  departments: Dept3Info[]
  processes: Process3Row[]
  processScores: EmployeeProcessScoreRow[]
  processShiftLinks: ProcessShiftLinkRow[]
  assignments: AssignmentWithRelations[]
  teams: TeamWithSlots[]
  templates: ShiftTemplate[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function shiftDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateNL(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const DAYS = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']
  const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function computeStatus(assignedFTE: number, capableFTE: number): ProcessFteCell['status'] {
  if (capableFTE === 0) return 'gray'
  const ratio = assignedFTE / capableFTE
  if (ratio >= 1) return 'green'
  if (ratio >= 0.5) return 'amber'
  return 'red'
}

// ─── ProcessPill ─────────────────────────────────────────────────────────────

const PILL_STYLES: Record<ProcessFteCell['status'], string> = {
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  red: 'border-red-200 bg-red-50 text-red-700',
  gray: 'border-gray-200 bg-gray-50 text-gray-400',
}

function ProcessPill({ cell }: { cell: ProcessFteCell }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none ${PILL_STYLES[cell.status]}`}
      title={`${cell.processName}: ${cell.assignedFTE} ingepland / ${cell.capableFTE} bekwaam`}
    >
      <span
        className="h-2 w-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: cell.processColor ?? '#9ca3af' }}
      />
      {cell.processName}
      <span className="font-bold tabular-nums">
        {cell.assignedFTE}
        <span className="font-normal opacity-60">/{cell.capableFTE}</span>
      </span>
    </span>
  )
}

// ─── TeamCard ─────────────────────────────────────────────────────────────────

function TeamCard({ node, index }: { node: TeamNode; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15, delay: index * 0.03 }}
      className="relative mx-4 mb-3 rounded-xl border border-gray-100 bg-gray-50/60 overflow-hidden"
    >
      {/* Left color strip */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ backgroundColor: node.teamColor ?? '#6366f1' }}
      />
      <div className="pl-4 pr-4 py-3">
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap mb-2.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: node.teamColor ?? '#6366f1' }}
          />
          <span className="text-sm font-semibold text-gray-800">{node.teamName}</span>
          <span className="text-[11px] text-gray-400">
            {node.headcountInDept} medewerker{node.headcountInDept !== 1 ? 's' : ''}
          </span>
          {node.activeShiftName ? (
            <span className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
              {node.activeShiftName}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] text-gray-400">
              Geen rotatie
            </span>
          )}
        </div>

        {/* Process pills */}
        {node.processCells.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {node.processCells.map((cell) => (
              <ProcessPill key={cell.processId} cell={cell} />
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-gray-400 italic">Geen actieve processen gekoppeld.</p>
        )}
      </div>
    </motion.div>
  )
}

// ─── DeptCard ─────────────────────────────────────────────────────────────────

function DeptCard({
  node,
  index,
  collapsed,
  onToggle,
}: {
  node: DeptNode
  index: number
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
    >
      {/* Dept header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50/70 transition-colors"
      >
        {/* Color accent square */}
        <span
          className="h-4 w-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: node.deptColor }}
        />
        <span className="text-[15px] font-bold text-gray-900 flex-1">{node.deptName}</span>

        {/* FTE summary */}
        {node.totalAssignedFTE > 0 && (
          <span className="text-[11px] font-medium text-gray-500 tabular-nums mr-1">
            {node.totalAssignedFTE} FTE gepland
          </span>
        )}

        {/* Chevron */}
        <span className="text-gray-400">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* Collapsible body */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="pt-1 pb-3">
              {/* Team nodes */}
              {node.teamNodes.map((team, i) => (
                <TeamCard key={team.teamId} node={team} index={i} />
              ))}

              {/* Orphan processes (dept has employees but no teams) */}
              {node.orphanProcesses.length > 0 && (
                <div className="mx-4 mb-3 rounded-xl border border-dashed border-gray-200 bg-gray-50/40 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                    Zonder ploeg
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {node.orphanProcesses.map((cell) => (
                      <ProcessPill key={cell.processId} cell={cell} />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {node.teamNodes.length === 0 && node.orphanProcesses.length === 0 && (
                <p className="mx-5 mb-3 text-[12px] text-gray-400 italic">
                  Geen ploegen of processen geconfigureerd voor deze afdeling.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Planner3View({
  employees,
  departments,
  processes,
  processScores,
  processShiftLinks,
  assignments,
  teams,
  templates,
}: Props) {
  const today = todayISO()
  const [selectedDate, setSelectedDate] = useState<string>(today)
  const [collapsedDepts, setCollapsedDepts] = useState<Set<string>>(new Set())

  function toggleDept(deptId: string) {
    setCollapsedDepts((prev) => {
      const next = new Set(prev)
      if (next.has(deptId)) next.delete(deptId)
      else next.add(deptId)
      return next
    })
  }

  // ── Lookup tables ──────────────────────────────────────────────────────────

  /** teamId → EmployeeWithContext[] (all employees in that team) */
  const teamMemberMap = useMemo(() => {
    const map = new Map<string, EmployeeWithContext[]>()
    for (const emp of employees) {
      if (!emp.team) continue
      const list = map.get(emp.team.id) ?? []
      list.push(emp)
      map.set(emp.team.id, list)
    }
    return map
  }, [employees])

  /** "employeeId:processId" → level (0–4) */
  const capabilityMap = useMemo(
    () => new Map(processScores.map((s) => [`${s.employeeId}:${s.processId}`, s.level])),
    [processScores],
  )

  /** processId → Set<shiftTemplateId> */
  const processShiftMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const link of processShiftLinks) {
      const set = map.get(link.processId) ?? new Set<string>()
      set.add(link.shiftTemplateId)
      map.set(link.processId, set)
    }
    return map
  }, [processShiftLinks])

  /** "date:shiftTemplateId:employeeId" → true */
  const assignmentSet = useMemo(() => {
    const set = new Set<string>()
    for (const a of assignments) {
      set.add(`${a.rosterDay.date}:${a.shiftTemplateId}:${a.employeeId}`)
    }
    return set
  }, [assignments])

  /** shiftTemplateId → ShiftTemplate */
  const templateMap = useMemo(
    () => new Map(templates.map((t) => [t.id, t])),
    [templates],
  )

  /** Full TeamWithSlots by id (for rotation lookups) */
  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams],
  )

  // ── Per-(dept, team, process) FTE helper ──────────────────────────────────

  function buildProcessCell(proc: Process3Row, empList: EmployeeWithContext[]): ProcessFteCell {
    const shiftIds = processShiftMap.get(proc.id) ?? new Set<string>()

    const capableFTE = empList.filter(
      (emp) => (capabilityMap.get(`${emp.id}:${proc.id}`) ?? 0) >= 1,
    ).length

    const assignedFTE =
      shiftIds.size === 0
        ? 0
        : empList.filter((emp) =>
            [...shiftIds].some((shiftId) =>
              assignmentSet.has(`${selectedDate}:${shiftId}:${emp.id}`),
            ),
          ).length

    return {
      processId: proc.id,
      processName: proc.name,
      processColor: proc.color,
      assignedFTE,
      capableFTE,
      status: computeStatus(assignedFTE, capableFTE),
    }
  }

  // ── Build hierarchy ────────────────────────────────────────────────────────

  const hierarchy = useMemo((): DeptNode[] => {
    const activeProcs = processes.filter((p) => p.active)

    return departments.map((dept): DeptNode => {
      const deptProcs = activeProcs.filter((p) => p.departmentId === dept.id)

      // Teams that have ≥1 active employee in this dept
      const deptTeams = teams.filter((team) =>
        (teamMemberMap.get(team.id) ?? []).some(
          (emp) => emp.department?.id === dept.id && emp.status === 'active',
        ),
      )

      let totalAssignedFTE = 0

      const teamNodes: TeamNode[] = deptTeams.map((team): TeamNode => {
        const teamDeptEmps = (teamMemberMap.get(team.id) ?? []).filter(
          (emp) => emp.department?.id === dept.id && emp.status === 'active',
        )

        // Use the full TeamWithSlots for rotation (from teams prop, not emp.team)
        const fullTeam = teamById.get(team.id)
        const activeShiftId = fullTeam
          ? getActiveShiftTemplateIdForTeam(fullTeam, selectedDate)
          : null
        const activeShiftName = activeShiftId
          ? (templateMap.get(activeShiftId)?.name ?? null)
          : null

        const processCells = deptProcs.map((proc) => buildProcessCell(proc, teamDeptEmps))

        const teamFTE = processCells.reduce((sum, c) => sum + c.assignedFTE, 0)
        totalAssignedFTE += teamFTE

        return {
          teamId: team.id,
          teamName: team.name,
          teamColor: team.color,
          headcountInDept: teamDeptEmps.length,
          activeShiftTemplateId: activeShiftId,
          activeShiftName,
          processCells,
        }
      })

      // Orphan processes: when dept has no teams at all
      const orphanProcesses: ProcessFteCell[] =
        deptTeams.length === 0
          ? deptProcs.map((proc) => {
              const deptEmps = employees.filter(
                (emp) => emp.department?.id === dept.id && emp.status === 'active',
              )
              return buildProcessCell(proc, deptEmps)
            })
          : []

      return {
        deptId: dept.id,
        deptName: dept.name,
        deptColor: dept.color,
        totalAssignedFTE,
        teamNodes,
        orphanProcesses,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedDate,
    departments,
    processes,
    teams,
    employees,
    teamMemberMap,
    capabilityMap,
    processShiftMap,
    assignmentSet,
    templateMap,
    teamById,
  ])

  // ── KPI totals ─────────────────────────────────────────────────────────────

  const totals = useMemo(() => {
    let assigned = 0
    let capable = 0
    for (const dept of hierarchy) {
      for (const team of dept.teamNodes) {
        for (const cell of team.processCells) {
          assigned += cell.assignedFTE
          capable += cell.capableFTE
        }
      }
    }
    return { assigned, capable }
  }, [hierarchy])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Control bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* KPI chips */}
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700">
            <span className="text-emerald-600 tabular-nums">{totals.assigned}</span>
            <span className="text-gray-400 ml-1 font-normal">/ {totals.capable} FTE bekwaam</span>
          </span>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedDate(today)}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Vandaag
          </button>
          <div className="flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden divide-x divide-gray-200">
            <button
              type="button"
              onClick={() => setSelectedDate((d) => shiftDays(d, -1))}
              className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-50 transition-colors text-[13px] leading-none"
              aria-label="Vorige dag"
            >
              ‹
            </button>
            <span className="px-3 py-1.5 text-[12px] font-medium text-gray-800 tabular-nums min-w-[140px] text-center">
              {formatDateNL(selectedDate)}
            </span>
            <button
              type="button"
              onClick={() => setSelectedDate((d) => shiftDays(d, 1))}
              className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-50 transition-colors text-[13px] leading-none"
              aria-label="Volgende dag"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-1">
        {([
          ['green', 'Volledig bezet'],
          ['amber', 'Deels bezet (50–99%)'],
          ['red', 'Onderbezet (< 50%)'],
          ['gray', 'Geen bekwaamheidsdata'],
        ] as const).map(([status, label]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${
              status === 'green' ? 'bg-emerald-400'
              : status === 'amber' ? 'bg-amber-400'
              : status === 'red' ? 'bg-red-400'
              : 'bg-gray-300'
            }`} />
            <span className="text-[10px] text-gray-400">{label}</span>
          </div>
        ))}
      </div>

      {/* Hierarchy */}
      <div className="space-y-3">
        {hierarchy.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-gray-400">Geen afdelingen gevonden.</p>
          </div>
        ) : (
          hierarchy.map((dept, i) => (
            <DeptCard
              key={dept.deptId}
              node={dept}
              index={i}
              collapsed={collapsedDepts.has(dept.deptId)}
              onToggle={() => toggleDept(dept.deptId)}
            />
          ))
        )}
      </div>
    </div>
  )
}
