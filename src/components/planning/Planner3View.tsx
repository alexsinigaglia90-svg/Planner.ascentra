'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Users, Activity, Zap, Calendar, ArrowLeft, ArrowRight } from 'lucide-react'
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
  totalCapableFTE: number
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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shiftDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getWeekDates(centerDate: string): string[] {
  const d = new Date(centerDate + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  })
}

const DAY_NAMES_SHORT = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
const MONTHS_NL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${MONTHS_NL[d.getMonth()]} ${d.getFullYear()}`
}

function computeStatus(assignedFTE: number, capableFTE: number): ProcessFteCell['status'] {
  if (capableFTE === 0) return 'gray'
  const ratio = assignedFTE / capableFTE
  if (ratio >= 1) return 'green'
  if (ratio >= 0.5) return 'amber'
  return 'red'
}

// ─── Circular Progress Ring ─────────────────────────────────────────────────

function ProgressRing({ value, max, size = 44, strokeWidth = 3.5, color, label }: {
  value: number
  max: number
  size?: number
  strokeWidth?: number
  color: string
  label?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = max > 0 ? Math.min(value / max, 1) : 0
  const offset = circumference * (1 - ratio)

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        />
      </svg>
      {label && (
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums" style={{ color }}>
          {label}
        </span>
      )}
    </div>
  )
}

// ─── Status config ──────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  green: {
    bg: 'bg-emerald-50/80',
    border: 'border-emerald-200/60',
    text: 'text-emerald-700',
    dot: '#22c55e',
    glow: 'rgba(34,197,94,0.15)',
    ringColor: '#22c55e',
  },
  amber: {
    bg: 'bg-amber-50/80',
    border: 'border-amber-200/60',
    text: 'text-amber-700',
    dot: '#f59e0b',
    glow: 'rgba(245,158,11,0.15)',
    ringColor: '#f59e0b',
  },
  red: {
    bg: 'bg-red-50/80',
    border: 'border-red-200/60',
    text: 'text-red-700',
    dot: '#ef4444',
    glow: 'rgba(239,68,68,0.15)',
    ringColor: '#ef4444',
  },
  gray: {
    bg: 'bg-gray-50/80',
    border: 'border-gray-200/60',
    text: 'text-gray-400',
    dot: '#9ca3af',
    glow: 'rgba(156,163,175,0.08)',
    ringColor: '#9ca3af',
  },
} as const

// ─── Process Card ───────────────────────────────────────────────────────────

function ProcessCard({ cell, index }: { cell: ProcessFteCell; index: number }) {
  const cfg = STATUS_CONFIG[cell.status]
  const ratio = cell.capableFTE > 0 ? Math.round((cell.assignedFTE / cell.capableFTE) * 100) : 0

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className={`group relative rounded-xl border ${cfg.border} ${cfg.bg} p-3 cursor-default transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
      style={{ boxShadow: `0 1px 3px ${cfg.glow}` }}
    >
      <div className="flex items-start gap-2.5">
        <ProgressRing
          value={cell.assignedFTE}
          max={cell.capableFTE}
          size={36}
          strokeWidth={3}
          color={cfg.ringColor}
          label={`${ratio}%`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: cell.processColor ?? '#9ca3af' }}
            />
            <span className={`text-[12px] font-semibold truncate ${cfg.text}`}>
              {cell.processName}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-[18px] font-bold tabular-nums leading-none ${cfg.text}`}>
              {cell.assignedFTE}
            </span>
            <span className="text-[11px] text-gray-400 font-medium">
              / {cell.capableFTE}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Team Section ───────────────────────────────────────────────────────────

function TeamSection({ node, index }: { node: TeamNode; index: number }) {
  const totalAssigned = node.processCells.reduce((s, c) => s + c.assignedFTE, 0)
  const totalCapable = node.processCells.reduce((s, c) => s + c.capableFTE, 0)
  const teamColor = node.teamColor ?? '#6366f1'

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className="relative"
    >
      {/* Team header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shadow-sm"
            style={{ backgroundColor: teamColor }}
          >
            {node.teamName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-gray-900">{node.teamName}</span>
              {node.activeShiftName && (
                <span
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ backgroundColor: `${teamColor}15`, color: teamColor, border: `1px solid ${teamColor}25` }}
                >
                  <Activity className="w-2.5 h-2.5" />
                  {node.activeShiftName}
                </span>
              )}
            </div>
            <span className="text-[11px] text-gray-400">
              {node.headcountInDept} medewerker{node.headcountInDept !== 1 ? 's' : ''}
              {totalCapable > 0 && (
                <> &middot; <span className="tabular-nums">{totalAssigned}/{totalCapable}</span> bezet</>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Process grid */}
      {node.processCells.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {node.processCells.map((cell, i) => (
            <ProcessCard key={cell.processId} cell={cell} index={i} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-4 py-3">
          <p className="text-[11px] text-gray-400 italic">Geen actieve processen gekoppeld</p>
        </div>
      )}
    </motion.div>
  )
}

// ─── Department Panel ───────────────────────────────────────────────────────

function DeptPanel({
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
  const ratio = node.totalCapableFTE > 0
    ? Math.round((node.totalAssignedFTE / node.totalCapableFTE) * 100)
    : 0
  const healthStatus = node.totalCapableFTE === 0 ? 'gray'
    : ratio >= 100 ? 'green'
    : ratio >= 50 ? 'amber'
    : 'red'
  const healthCfg = STATUS_CONFIG[healthStatus]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className="group/dept relative rounded-2xl border border-gray-200/80 bg-white overflow-hidden transition-shadow duration-300 hover:shadow-lg"
      style={{
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)',
      }}
    >
      {/* Top accent bar */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${node.deptColor}, ${node.deptColor}88)` }} />

      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50/60"
      >
        {/* Department icon */}
        <div
          className="relative h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${node.deptColor}12`, border: `1.5px solid ${node.deptColor}30` }}
        >
          <Users className="w-4.5 h-4.5" style={{ color: node.deptColor }} />
        </div>

        {/* Name + stats */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold text-gray-900 truncate">{node.deptName}</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${healthCfg.bg} ${healthCfg.border} border ${healthCfg.text}`}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: healthCfg.dot }} />
              {ratio}%
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[11px] text-gray-400">
              {node.teamNodes.length} ploeg{node.teamNodes.length !== 1 ? 'en' : ''}
            </span>
            <span className="text-[11px] text-gray-300">&middot;</span>
            <span className="text-[11px] text-gray-400 tabular-nums">
              <span className="font-semibold text-gray-600">{node.totalAssignedFTE}</span>
              {' / '}
              {node.totalCapableFTE} FTE
            </span>
          </div>
        </div>

        {/* Progress ring */}
        <ProgressRing
          value={node.totalAssignedFTE}
          max={node.totalCapableFTE}
          size={42}
          strokeWidth={3.5}
          color={healthCfg.ringColor}
        />

        {/* Chevron */}
        <motion.div
          animate={{ rotate: collapsed ? 0 : 180 }}
          transition={{ duration: 0.2 }}
          className="text-gray-300 flex-shrink-0"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </button>

      {/* Collapsible body */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-5 pb-5 space-y-5">
              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

              {/* Team sections */}
              {node.teamNodes.map((team, i) => (
                <TeamSection key={team.teamId} node={team} index={i} />
              ))}

              {/* Orphan processes */}
              {node.orphanProcesses.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="h-6 w-6 rounded-md bg-gray-100 flex items-center justify-center">
                      <Zap className="w-3 h-3 text-gray-400" />
                    </div>
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      Zonder ploeg
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {node.orphanProcesses.map((cell, i) => (
                      <ProcessCard key={cell.processId} cell={cell} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {node.teamNodes.length === 0 && node.orphanProcesses.length === 0 && (
                <div className="flex flex-col items-center py-8 text-center">
                  <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center mb-2">
                    <Users className="w-4 h-4 text-gray-300" />
                  </div>
                  <p className="text-[12px] text-gray-400">
                    Geen ploegen of processen geconfigureerd.
                  </p>
                </div>
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

  const toggleDept = useCallback((deptId: string) => {
    setCollapsedDepts((prev) => {
      const next = new Set(prev)
      if (next.has(deptId)) next.delete(deptId)
      else next.add(deptId)
      return next
    })
  }, [])

  // ── Lookup tables ──────────────────────────────────────────────────────────

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

  const capabilityMap = useMemo(
    () => new Map(processScores.map((s) => [`${s.employeeId}:${s.processId}`, s.level])),
    [processScores],
  )

  const processShiftMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const link of processShiftLinks) {
      const set = map.get(link.processId) ?? new Set<string>()
      set.add(link.shiftTemplateId)
      map.set(link.processId, set)
    }
    return map
  }, [processShiftLinks])

  const assignmentSet = useMemo(() => {
    const set = new Set<string>()
    for (const a of assignments) {
      set.add(`${a.rosterDay.date}:${a.shiftTemplateId}:${a.employeeId}`)
    }
    return set
  }, [assignments])

  const templateMap = useMemo(
    () => new Map(templates.map((t) => [t.id, t])),
    [templates],
  )

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

      const deptTeams = teams.filter((team) =>
        (teamMemberMap.get(team.id) ?? []).some(
          (emp) => emp.department?.id === dept.id && emp.status === 'active',
        ),
      )

      let totalAssignedFTE = 0
      let totalCapableFTE = 0

      const teamNodes: TeamNode[] = deptTeams.map((team): TeamNode => {
        const teamDeptEmps = (teamMemberMap.get(team.id) ?? []).filter(
          (emp) => emp.department?.id === dept.id && emp.status === 'active',
        )

        const fullTeam = teamById.get(team.id)
        const activeShiftId = fullTeam
          ? getActiveShiftTemplateIdForTeam(fullTeam, selectedDate)
          : null
        const activeShiftName = activeShiftId
          ? (templateMap.get(activeShiftId)?.name ?? null)
          : null

        const processCells = deptProcs.map((proc) => buildProcessCell(proc, teamDeptEmps))

        const teamFTE = processCells.reduce((sum, c) => sum + c.assignedFTE, 0)
        const teamCap = processCells.reduce((sum, c) => sum + c.capableFTE, 0)
        totalAssignedFTE += teamFTE
        totalCapableFTE += teamCap

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
        totalCapableFTE,
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
    let greenCount = 0
    let amberCount = 0
    let redCount = 0
    for (const dept of hierarchy) {
      for (const team of dept.teamNodes) {
        for (const cell of team.processCells) {
          assigned += cell.assignedFTE
          capable += cell.capableFTE
          if (cell.status === 'green') greenCount++
          else if (cell.status === 'amber') amberCount++
          else if (cell.status === 'red') redCount++
        }
      }
    }
    return { assigned, capable, greenCount, amberCount, redCount }
  }, [hierarchy])

  // ── Week dates for timeline ────────────────────────────────────────────────

  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate])

  const overallRatio = totals.capable > 0 ? Math.round((totals.assigned / totals.capable) * 100) : 0
  const overallStatus = totals.capable === 0 ? 'gray' : overallRatio >= 100 ? 'green' : overallRatio >= 50 ? 'amber' : 'red'

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── KPI Hero Strip ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Overall health */}
        <div className="ds-stat-card col-span-2 lg:col-span-1" style={{ '--stat-accent': STATUS_CONFIG[overallStatus].dot } as React.CSSProperties}>
          <div className="flex items-center gap-3">
            <ProgressRing
              value={totals.assigned}
              max={totals.capable}
              size={52}
              strokeWidth={4}
              color={STATUS_CONFIG[overallStatus].ringColor}
              label={`${overallRatio}%`}
            />
            <div>
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Bezetting</p>
              <p className="text-[22px] font-bold text-gray-900 tabular-nums leading-tight">
                {totals.assigned}
                <span className="text-[14px] font-medium text-gray-400"> / {totals.capable}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Green processes */}
        <div className="ds-stat-card" style={{ '--stat-accent': '#22c55e' } as React.CSSProperties}>
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Volledig bezet</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[26px] font-bold text-emerald-600 tabular-nums leading-none">{totals.greenCount}</span>
            <span className="text-[11px] text-gray-400">processen</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-emerald-400"
              initial={{ width: 0 }}
              animate={{ width: `${totals.greenCount + totals.amberCount + totals.redCount > 0 ? (totals.greenCount / (totals.greenCount + totals.amberCount + totals.redCount)) * 100 : 0}%` }}
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            />
          </div>
        </div>

        {/* Amber processes */}
        <div className="ds-stat-card" style={{ '--stat-accent': '#f59e0b' } as React.CSSProperties}>
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Deels bezet</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[26px] font-bold text-amber-600 tabular-nums leading-none">{totals.amberCount}</span>
            <span className="text-[11px] text-gray-400">processen</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-amber-400"
              initial={{ width: 0 }}
              animate={{ width: `${totals.greenCount + totals.amberCount + totals.redCount > 0 ? (totals.amberCount / (totals.greenCount + totals.amberCount + totals.redCount)) * 100 : 0}%` }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
            />
          </div>
        </div>

        {/* Red processes */}
        <div className="ds-stat-card" style={{ '--stat-accent': '#ef4444' } as React.CSSProperties}>
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Onderbezet</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[26px] font-bold text-red-600 tabular-nums leading-none">{totals.redCount}</span>
            <span className="text-[11px] text-gray-400">processen</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-red-400"
              initial={{ width: 0 }}
              animate={{ width: `${totals.greenCount + totals.amberCount + totals.redCount > 0 ? (totals.redCount / (totals.greenCount + totals.amberCount + totals.redCount)) * 100 : 0}%` }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
            />
          </div>
        </div>
      </div>

      {/* ── Timeline Date Picker ──────────────────────────────────────── */}
      <div className="ds-card p-1">
        <div className="flex items-center">
          {/* Prev week */}
          <button
            type="button"
            onClick={() => setSelectedDate((d) => shiftDays(d, -7))}
            className="flex items-center justify-center w-9 h-9 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Vorige week"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Week days */}
          <div className="flex-1 grid grid-cols-7 gap-1">
            {weekDates.map((dateStr, i) => {
              const d = new Date(dateStr + 'T00:00:00')
              const isSelected = dateStr === selectedDate
              const isToday = dateStr === today
              const isWeekend = i >= 5

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setSelectedDate(dateStr)}
                  className={[
                    'relative flex flex-col items-center py-2 rounded-xl transition-all duration-200',
                    isSelected
                      ? 'bg-[#4F6BFF] text-white shadow-md shadow-[#4F6BFF]/25'
                      : isToday
                        ? 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                        : isWeekend
                          ? 'text-gray-400 hover:bg-gray-50'
                          : 'text-gray-600 hover:bg-gray-50',
                  ].join(' ')}
                >
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
                    {DAY_NAMES_SHORT[i]}
                  </span>
                  <span className={`text-[16px] font-bold tabular-nums leading-tight mt-0.5 ${isSelected ? 'text-white' : ''}`}>
                    {d.getDate()}
                  </span>
                  {isToday && !isSelected && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[#4F6BFF]" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Next week */}
          <button
            type="button"
            onClick={() => setSelectedDate((d) => shiftDays(d, 7))}
            className="flex items-center justify-center w-9 h-9 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Volgende week"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Date label */}
        <div className="flex items-center justify-center gap-2 pt-1 pb-1">
          <Calendar className="w-3 h-3 text-gray-300" />
          <span className="text-[11px] font-medium text-gray-400">{formatDateFull(selectedDate)}</span>
          {selectedDate !== today && (
            <button
              type="button"
              onClick={() => setSelectedDate(today)}
              className="text-[10px] font-semibold text-[#4F6BFF] hover:text-[#3d57e0] transition-colors ml-1"
            >
              Vandaag
            </button>
          )}
        </div>
      </div>

      {/* ── Legend ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-5">
        {([
          ['green', 'Volledig bezet', '#22c55e'],
          ['amber', 'Deels bezet', '#f59e0b'],
          ['red', 'Onderbezet', '#ef4444'],
          ['gray', 'Geen data', '#9ca3af'],
        ] as const).map(([, label, color]) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[11px] text-gray-500">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Department Panels ─────────────────────────────────────────── */}
      <div className="space-y-4">
        {hierarchy.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
              <Users className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-500">Geen afdelingen gevonden</p>
            <p className="text-[12px] text-gray-400 mt-1">Voeg afdelingen toe via Instellingen om het overzicht te activeren.</p>
          </div>
        ) : (
          hierarchy.map((dept, i) => (
            <DeptPanel
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
