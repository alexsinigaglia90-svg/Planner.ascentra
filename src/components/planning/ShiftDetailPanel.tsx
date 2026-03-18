'use client'

import { useState, useMemo, useTransition } from 'react'
import { motion } from 'framer-motion'
import type { ShiftTemplate } from '@prisma/client'
import type { AssignmentWithRelations } from '@/lib/queries/assignments'
import type { EmployeeWithContext } from '@/lib/queries/employees'
import type { ProcessRow } from '@/lib/queries/processes'
import { LEVEL_COLORS, LEVEL_LABELS } from '@/components/workforce/SkillLevelIndicator'
import { createAssignmentAction, deleteAssignmentAction } from '@/app/planning/actions'
import { formatDateLabel } from './Planner2View'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DeptInfo {
  id: string
  name: string
  color?: string | null
}

interface Props {
  department: DeptInfo
  date: string
  shiftTemplate: ShiftTemplate
  assignments: AssignmentWithRelations[]
  employees: EmployeeWithContext[]
  processes: ProcessRow[]
  processLevelMap: Map<string, number>
  requirementsMap: Map<string, number>
  onBack: () => void
  canEdit: boolean
}

// ─── Skill Radar Mini ────────────────────────────────────────────────────────

function SkillRadar({
  employeeId,
  processes,
  processLevelMap,
}: {
  employeeId: string
  processes: ProcessRow[]
  processLevelMap: Map<string, number>
}) {
  if (processes.length === 0) return null
  const size = 60
  const cx = size / 2
  const cy = size / 2
  const maxR = 24

  const points = processes.map((proc, i) => {
    const angle = (Math.PI * 2 * i) / processes.length - Math.PI / 2
    const level = processLevelMap.get(`${employeeId}:${proc.id}`) ?? 0
    const r = (level / 4) * maxR
    return {
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      gridX: cx + Math.cos(angle) * maxR,
      gridY: cy + Math.sin(angle) * maxR,
      level,
      name: proc.name,
    }
  })

  const polygon = points.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      {/* Grid rings */}
      {[1, 2, 3, 4].map((ring) => (
        <circle key={ring} cx={cx} cy={cy} r={(ring / 4) * maxR} fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
      ))}
      {/* Grid lines */}
      {points.map((p, i) => (
        <line key={i} x1={cx} y1={cy} x2={p.gridX} y2={p.gridY} stroke="#e5e7eb" strokeWidth="0.5" />
      ))}
      {/* Data polygon */}
      <polygon points={polygon} fill="rgba(99, 102, 241, 0.15)" stroke="#6366f1" strokeWidth="1.5" />
      {/* Level dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={LEVEL_COLORS[p.level]} stroke="white" strokeWidth="1" />
      ))}
    </svg>
  )
}

// ─── Assigned Employee Card ──────────────────────────────────────────────────

function AssignedEmployeeCard({
  assignment,
  employee,
  processes,
  processLevelMap,
  canEdit,
  onRemove,
}: {
  assignment: AssignmentWithRelations
  employee: EmployeeWithContext
  processes: ProcessRow[]
  processLevelMap: Map<string, number>
  canEdit: boolean
  onRemove: (assignmentId: string) => void
}) {
  const initials = employee.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  const maxLevel = processes.reduce((best, proc) => {
    const level = processLevelMap.get(`${employee.id}:${proc.id}`) ?? 0
    return Math.max(best, level)
  }, 0)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 hover:shadow-sm transition-shadow group"
    >
      {/* Avatar with level ring */}
      <div className="relative shrink-0">
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: LEVEL_COLORS[maxLevel] }}
        >
          {initials}
        </div>
        {employee.employeeType === 'temp' && (
          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-orange-400 border-2 border-white flex items-center justify-center">
            <span className="text-[7px] font-bold text-white">T</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{employee.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-gray-400">{employee.contractHours}u/w</span>
          {employee.team && (
            <span className="text-[10px] text-gray-400">{employee.team.name}</span>
          )}
          {employee.employeeFunction && (
            <span className="text-[10px] text-gray-400">{employee.employeeFunction.name}</span>
          )}
        </div>
        {/* Process levels inline */}
        <div className="flex items-center gap-1 mt-1.5">
          {processes.map((proc) => {
            const level = processLevelMap.get(`${employee.id}:${proc.id}`) ?? 0
            return (
              <div
                key={proc.id}
                className="flex items-center gap-0.5"
                title={`${proc.name}: ${LEVEL_LABELS[level]} (${level})`}
              >
                <div
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{
                    backgroundColor: level > 0 ? LEVEL_COLORS[level] : '#e5e7eb',
                    opacity: level > 0 ? 0.8 : 0.3,
                  }}
                />
                <span className="text-[8px] text-gray-400 hidden group-hover:inline">{proc.name.slice(0, 3)}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Radar */}
      <SkillRadar
        employeeId={employee.id}
        processes={processes}
        processLevelMap={processLevelMap}
      />

      {/* Remove button */}
      {canEdit && (
        <button
          type="button"
          onClick={() => onRemove(assignment.id)}
          className="shrink-0 opacity-0 group-hover:opacity-100 h-7 w-7 rounded-lg flex items-center justify-center text-gray-300 hover:bg-red-50 hover:text-red-500 transition-all"
          title="Verwijder toewijzing"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </motion.div>
  )
}

// ─── Available Employee Card ─────────────────────────────────────────────────

function AvailableEmployeeCard({
  employee,
  processes,
  processLevelMap,
  onAssign,
  isPending,
}: {
  employee: EmployeeWithContext
  processes: ProcessRow[]
  processLevelMap: Map<string, number>
  onAssign: () => void
  isPending: boolean
}) {
  const initials = employee.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  const maxLevel = processes.reduce((best, proc) => {
    const level = processLevelMap.get(`${employee.id}:${proc.id}`) ?? 0
    return Math.max(best, level)
  }, 0)

  // Compute a "fitness score" for this shift
  const avgLevel = processes.length > 0
    ? processes.reduce((sum, proc) => sum + (processLevelMap.get(`${employee.id}:${proc.id}`) ?? 0), 0) / processes.length
    : 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-2.5 hover:bg-white hover:border-gray-200 hover:shadow-sm transition-all group"
    >
      <div
        className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
        style={{ backgroundColor: LEVEL_COLORS[maxLevel] ?? '#d1d5db' }}
      >
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-900 truncate">{employee.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-gray-400">{employee.contractHours}u/w</span>
          {/* Mini process levels */}
          {processes.slice(0, 5).map((proc) => {
            const level = processLevelMap.get(`${employee.id}:${proc.id}`) ?? 0
            return (
              <div
                key={proc.id}
                className="h-2 w-2 rounded-sm"
                style={{
                  backgroundColor: level > 0 ? LEVEL_COLORS[level] : '#e5e7eb',
                  opacity: level > 0 ? 0.7 : 0.2,
                }}
                title={`${proc.name}: L${level}`}
              />
            )
          })}
        </div>
      </div>

      {/* Fitness badge */}
      <span className={`text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
        avgLevel >= 2.5 ? 'bg-emerald-50 text-emerald-700'
        : avgLevel >= 1 ? 'bg-amber-50 text-amber-700'
        : 'bg-gray-100 text-gray-400'
      }`}>
        {avgLevel.toFixed(1)}
      </span>

      {/* Assign button */}
      <button
        type="button"
        onClick={onAssign}
        disabled={isPending}
        className="shrink-0 opacity-0 group-hover:opacity-100 h-7 rounded-lg bg-gray-900 px-2.5 text-[10px] font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-all"
      >
        {isPending ? '...' : '+ Toewijzen'}
      </button>
    </motion.div>
  )
}

// ─── Main Shift Detail Panel ─────────────────────────────────────────────────

export function ShiftDetailPanel({
  department,
  date,
  shiftTemplate,
  assignments,
  employees,
  processes,
  processLevelMap,
  requirementsMap,
  onBack,
  canEdit,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [assigningId, setAssigningId] = useState<string | null>(null)

  const dateLabel = formatDateLabel(date)
  const required = requirementsMap.get(shiftTemplate.id) ?? shiftTemplate.requiredEmployees

  // Assigned employees for this shift + date
  const shiftAssignments = useMemo(
    () => assignments.filter((a) => a.rosterDay.date === date && a.shiftTemplateId === shiftTemplate.id),
    [assignments, date, shiftTemplate.id],
  )

  // All assigned on this date (any shift)
  const assignedAnyShiftIds = useMemo(
    () => new Set(assignments.filter((a) => a.rosterDay.date === date).map((a) => a.employeeId)),
    [assignments, date],
  )

  // Employees assigned to this shift
  const assignedEmployees = useMemo(() => {
    const empMap = new Map(employees.map((e) => [e.id, e]))
    return shiftAssignments
      .map((a) => ({ assignment: a, employee: empMap.get(a.employeeId)! }))
      .filter((e) => e.employee)
  }, [shiftAssignments, employees])

  // Available employees — not assigned to any shift on this date, in this department, active
  const availableEmployees = useMemo(() => {
    return employees
      .filter((e) => {
        if (e.status !== 'active') return false
        if (assignedAnyShiftIds.has(e.id)) return false
        if (e.department?.id !== department.id) return false
        return true
      })
      .sort((a, b) => {
        // Sort by average process level descending
        const avgA = processes.reduce((sum, p) => sum + (processLevelMap.get(`${a.id}:${p.id}`) ?? 0), 0)
        const avgB = processes.reduce((sum, p) => sum + (processLevelMap.get(`${b.id}:${p.id}`) ?? 0), 0)
        return avgB - avgA
      })
  }, [employees, assignedAnyShiftIds, department.id, processes, processLevelMap])

  // Also show employees from OTHER departments as secondary pool
  const otherDeptEmployees = useMemo(() => {
    return employees
      .filter((e) => {
        if (e.status !== 'active') return false
        if (assignedAnyShiftIds.has(e.id)) return false
        if (e.department?.id === department.id) return false
        return true
      })
      .filter((e) => {
        // Only show if they have at least level 1 on any department process
        return processes.some((p) => (processLevelMap.get(`${e.id}:${p.id}`) ?? 0) >= 1)
      })
      .sort((a, b) => {
        const avgA = processes.reduce((sum, p) => sum + (processLevelMap.get(`${a.id}:${p.id}`) ?? 0), 0)
        const avgB = processes.reduce((sum, p) => sum + (processLevelMap.get(`${b.id}:${p.id}`) ?? 0), 0)
        return avgB - avgA
      })
      .slice(0, 10)
  }, [employees, assignedAnyShiftIds, department.id, processes, processLevelMap])

  const directAssigned = assignedEmployees.filter((e) => e.employee.employeeFunction?.overhead !== true).length
  const openSlots = Math.max(0, required - directAssigned)
  const status = directAssigned < required ? 'understaffed' : directAssigned > required ? 'overstaffed' : 'staffed'

  // ── Actions ────────────────────────────────────────────────────────────────

  function handleAssign(employeeId: string) {
    if (!canEdit) return
    setAssigningId(employeeId)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('date', date)
      fd.set('employeeId', employeeId)
      fd.set('shiftTemplateId', shiftTemplate.id)
      await createAssignmentAction(fd)
      setAssigningId(null)
    })
  }

  function handleRemove(assignmentId: string) {
    if (!canEdit) return
    startTransition(async () => {
      await deleteAssignmentAction(assignmentId)
    })
  }

  // Department processes (for skill context)
  const deptProcesses = useMemo(() => {
    // Show processes that at least one employee in this dept has scored on
    return processes.filter((proc) => {
      return employees.some((e) =>
        e.department?.id === department.id &&
        (processLevelMap.get(`${e.id}:${proc.id}`) ?? 0) > 0,
      )
    })
  }, [processes, employees, department.id, processLevelMap])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            {department.color && (
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: department.color }} />
            )}
            <h2 className="text-lg font-bold text-gray-900">
              {shiftTemplate.name}
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {dateLabel.day} {dateLabel.date} {dateLabel.month} &middot; {shiftTemplate.startTime} - {shiftTemplate.endTime} &middot; {department.name}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          &larr; Terug naar {department.name}
        </button>
      </div>

      {/* Status strip */}
      <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
        status === 'understaffed' ? 'border-red-200 bg-red-50'
        : status === 'overstaffed' ? 'border-blue-200 bg-blue-50'
        : 'border-emerald-200 bg-emerald-50'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${
            status === 'understaffed' ? 'bg-red-500' : status === 'overstaffed' ? 'bg-blue-400' : 'bg-emerald-500'
          }`} />
          <span className="text-sm font-semibold text-gray-900">
            {directAssigned}/{required} bezet
          </span>
        </div>
        {openSlots > 0 && (
          <span className="text-xs font-medium text-red-700">
            {openSlots} positie{openSlots !== 1 ? 's' : ''} open
          </span>
        )}
        {status === 'overstaffed' && (
          <span className="text-xs font-medium text-blue-700">
            {directAssigned - required} te veel
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-4">
        {/* Left: assigned + available */}
        <div className="space-y-4">
          {/* Assigned */}
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
              Ingepland ({assignedEmployees.length})
            </h3>
            {assignedEmployees.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-6 py-8 text-center">
                <p className="text-sm text-gray-400">Nog niemand ingepland</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {assignedEmployees.map(({ assignment, employee }) => (
                  <AssignedEmployeeCard
                    key={assignment.id}
                    assignment={assignment}
                    employee={employee}
                    processes={deptProcesses}
                    processLevelMap={processLevelMap}
                    canEdit={canEdit}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Available from same department */}
          {canEdit && availableEmployees.length > 0 && (
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                Beschikbaar — {department.name} ({availableEmployees.length})
              </h3>
              <div className="space-y-1">
                {availableEmployees.map((emp) => (
                  <AvailableEmployeeCard
                    key={emp.id}
                    employee={emp}
                    processes={deptProcesses}
                    processLevelMap={processLevelMap}
                    onAssign={() => handleAssign(emp.id)}
                    isPending={isPending && assigningId === emp.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Available from other departments (cross-trained) */}
          {canEdit && otherDeptEmployees.length > 0 && (
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                Cross-trained — andere afdelingen ({otherDeptEmployees.length})
              </h3>
              <div className="space-y-1">
                {otherDeptEmployees.map((emp) => (
                  <AvailableEmployeeCard
                    key={emp.id}
                    employee={emp}
                    processes={deptProcesses}
                    processLevelMap={processLevelMap}
                    onAssign={() => handleAssign(emp.id)}
                    isPending={isPending && assigningId === emp.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: skill context panel */}
        <div className="space-y-3">
          {/* Process legend */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
              Processen
            </h3>
            <div className="space-y-2">
              {deptProcesses.map((proc) => {
                const assignedWithSkill = assignedEmployees.filter(
                  (e) => (processLevelMap.get(`${e.employee.id}:${proc.id}`) ?? 0) >= 2,
                ).length

                return (
                  <div key={proc.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {proc.color && (
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: proc.color }} />
                      )}
                      <span className="text-xs text-gray-700">{proc.name}</span>
                    </div>
                    <span className={`text-[10px] font-bold tabular-nums ${
                      assignedWithSkill > 0 ? 'text-emerald-600' : 'text-gray-300'
                    }`}>
                      {assignedWithSkill} operationeel
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Level legend */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
              Skill Levels
            </h3>
            <div className="space-y-1.5">
              {LEVEL_LABELS.map((label, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: LEVEL_COLORS[i] }} />
                  <span className="text-[10px] text-gray-600">
                    <span className="font-semibold">{i}</span> — {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
