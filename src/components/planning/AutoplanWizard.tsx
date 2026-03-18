'use client'

import { useState, useMemo, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ShiftTemplate } from '@prisma/client'
import type { EmployeeWithContext } from '@/lib/queries/employees'
import type { ProcessRow } from '@/lib/queries/processes'
import type { DepartmentDayStats } from '@/lib/demand'
import { generatePlanAction, type PlanWizardInput, type PlanWizardResult } from '@/app/planning/actions'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AutoplanScope {
  departmentIds: string[]
  shiftTemplateIds: string[]
  dateRange?: { start: string; end: string }
  // Pre-filled from zoom context
  fromZoomLevel: 'birds-eye' | 'department' | 'shift-detail'
}

type WizardStep = 'scope' | 'demand' | 'strategy' | 'constraints' | 'preview' | 'result'

interface DeptInfo {
  id: string
  name: string
  color?: string | null
}

interface Props {
  departments: DeptInfo[]
  templates: ShiftTemplate[]
  employees: EmployeeWithContext[]
  processes: ProcessRow[]
  processLevelMap: Map<string, number>
  deptDayStats: DepartmentDayStats[]
  dates?: string[]
  scope: AutoplanScope
  onClose: () => void
  onComplete: () => void
}

// ─── Step indicator ──────────────────────────────────────────────────────────

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'scope', label: 'Scope' },
  { key: 'demand', label: 'Demand' },
  { key: 'strategy', label: 'Strategie' },
  { key: 'constraints', label: 'Checks' },
  { key: 'preview', label: 'Preview' },
  { key: 'result', label: 'Resultaat' },
]

function StepIndicator({ current, steps }: { current: WizardStep; steps: typeof STEPS }) {
  const currentIdx = steps.findIndex((s) => s.key === current)
  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center gap-1">
          <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-all ${
            i === currentIdx ? 'bg-gray-900 text-white' :
            i < currentIdx ? 'bg-emerald-50 text-emerald-700' :
            'bg-gray-100 text-gray-400'
          }`}>
            {i < currentIdx && (
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {step.label}
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px w-4 ${i < currentIdx ? 'bg-emerald-300' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Week selector ───────────────────────────────────────────────────────────

function WeekSelector({
  selectedWeeks,
  onToggle,
}: {
  selectedWeeks: Set<number>
  onToggle: (week: number) => void
}) {
  const weeks = [0, 1, 2, 3, 4, 5]
  const now = new Date()
  const day = now.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day

  return (
    <div className="grid grid-cols-6 gap-2">
      {weeks.map((w) => {
        const monday = new Date(now)
        monday.setDate(now.getDate() + mondayOffset + w * 7)
        const friday = new Date(monday)
        friday.setDate(monday.getDate() + 4)
        const label = `${monday.getDate()}/${monday.getMonth() + 1}`
        const selected = selectedWeeks.has(w)

        return (
          <button
            key={w}
            type="button"
            onClick={() => onToggle(w)}
            className={`rounded-xl border p-3 text-center transition-all ${
              selected
                ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            <p className="text-[10px] font-medium opacity-70">Week {w + 1}</p>
            <p className="text-sm font-bold tabular-nums mt-0.5">{label}</p>
            <p className="text-[9px] opacity-50 mt-0.5">{w === 0 ? 'Deze week' : `+${w}w`}</p>
          </button>
        )
      })}
    </div>
  )
}

// ─── Main Wizard Component ───────────────────────────────────────────────────

export function AutoplanWizard({
  departments,
  templates,
  employees,
  processes,
  processLevelMap,
  deptDayStats,
  // dates not used directly — wizard uses weekOffsets
  scope: initialScope,
  onClose,
  onComplete,
}: Props) {
  const [step, setStep] = useState<WizardStep>(() => {
    // Skip scope step if already scoped from zoom context
    if (initialScope.fromZoomLevel === 'shift-detail') return 'demand'
    if (initialScope.fromZoomLevel === 'department') return 'scope'
    return 'scope'
  })

  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<PlanWizardResult | null>(null)

  // ── Scope state ──────────────────────────────────────────────────────────
  const [selectedDeptIds, setSelectedDeptIds] = useState<Set<string>>(() => {
    const ids = new Set(initialScope.departmentIds)
    // Auto-include unassigned shifts if any templates lack a department
    if (templates.some((t) => !t.departmentId)) ids.add('__unassigned__')
    return ids
  })
  const [selectedWeeks, setSelectedWeeks] = useState<Set<number>>(
    new Set([0, 1, 2, 3, 4, 5]),
  )
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(
    new Set(initialScope.shiftTemplateIds.length > 0
      ? initialScope.shiftTemplateIds
      : templates.map((t) => t.id)),
  )

  // ── Strategy state ───────────────────────────────────────────────────────
  const [priorityOrder, setPriorityOrder] = useState<'internal-first' | 'temp-first'>('internal-first')
  const [mode, setMode] = useState<'performance' | 'training'>('performance')
  const [fairSpread, setFairSpread] = useState(true)
  const [respectContractHours, setRespectContractHours] = useState(true)
  const [maxOvertimeHours, setMaxOvertimeHours] = useState(4)

  // ── Derived data ─────────────────────────────────────────────────────────

  // Templates for selected departments (include unassigned templates when __unassigned__ is selected or no filter)
  const scopedTemplates = useMemo(() => {
    if (selectedDeptIds.size === 0) return templates
    return templates.filter((t) =>
      (t.departmentId && selectedDeptIds.has(t.departmentId)) ||
      (!t.departmentId && selectedDeptIds.has('__unassigned__'))
    )
  }, [templates, selectedDeptIds])

  // Demand preview
  const demandPreview = useMemo(() => {
    const preview: { deptName: string; shiftName: string; totalRequired: number; totalAssigned: number; gap: number }[] = []

    for (const stat of deptDayStats) {
      if (!selectedDeptIds.has(stat.departmentId)) continue

      for (const shift of stat.shiftBreakdown) {
        if (!selectedTemplateIds.has(shift.shiftTemplateId)) continue

        const existing = preview.find((p) => p.deptName === stat.departmentName && p.shiftName === shift.shiftName)
        if (existing) {
          existing.totalRequired += shift.required
          existing.totalAssigned += shift.directAssigned
          existing.gap += Math.max(0, shift.required - shift.directAssigned)
        } else {
          preview.push({
            deptName: stat.departmentName,
            shiftName: shift.shiftName,
            totalRequired: shift.required,
            totalAssigned: shift.directAssigned,
            gap: Math.max(0, shift.required - shift.directAssigned),
          })
        }
      }
    }

    return preview
  }, [deptDayStats, selectedDeptIds, selectedTemplateIds])

  // Constraint checks
  const constraintChecks = useMemo(() => {
    const checks: { label: string; status: 'ok' | 'warning' | 'critical'; detail: string }[] = []

    // Available employees in scope
    const scopedEmployees = employees.filter((e) =>
      e.status === 'active' &&
      e.department &&
      selectedDeptIds.has(e.department.id),
    )
    checks.push({
      label: 'Beschikbare medewerkers',
      status: scopedEmployees.length > 0 ? 'ok' : 'critical',
      detail: `${scopedEmployees.length} medewerkers in geselecteerde afdelingen`,
    })

    // Total gaps
    const totalGap = demandPreview.reduce((s, p) => s + p.gap, 0)
    checks.push({
      label: 'Openstaande posities',
      status: totalGap === 0 ? 'ok' : totalGap > scopedEmployees.length ? 'critical' : 'warning',
      detail: `${totalGap} posities moeten worden ingevuld`,
    })

    // Skill coverage
    const processesInScope = processes.filter((p) =>
      scopedEmployees.some((e) => (processLevelMap.get(`${e.id}:${p.id}`) ?? 0) >= 2),
    )
    checks.push({
      label: 'Skill dekking',
      status: processesInScope.length >= processes.length * 0.7 ? 'ok' : 'warning',
      detail: `${processesInScope.length}/${processes.length} processen hebben operationele medewerkers`,
    })

    // Temp ratio
    const tempCount = scopedEmployees.filter((e) => e.employeeType === 'temp').length
    const tempRatio = scopedEmployees.length > 0 ? tempCount / scopedEmployees.length : 0
    checks.push({
      label: 'Temp ratio',
      status: tempRatio > 0.4 ? 'warning' : 'ok',
      detail: `${Math.round(tempRatio * 100)}% uitzendkrachten (${tempCount}/${scopedEmployees.length})`,
    })

    return checks
  }, [employees, selectedDeptIds, demandPreview, processes, processLevelMap])

  // ── Navigation ───────────────────────────────────────────────────────────

  const stepOrder: WizardStep[] = ['scope', 'demand', 'strategy', 'constraints', 'preview', 'result']
  const currentIdx = stepOrder.indexOf(step)

  function goNext() {
    if (currentIdx < stepOrder.length - 1) {
      setStep(stepOrder[currentIdx + 1])
    }
  }
  function goPrev() {
    if (currentIdx > 0) {
      setStep(stepOrder[currentIdx - 1])
    }
  }

  // ── Execute plan ─────────────────────────────────────────────────────────

  function executePlan() {
    startTransition(async () => {
      // Run for each selected department
      const combinedResult: PlanWizardResult = {
        totalCreated: 0,
        totalRemaining: 0,
        totalSlots: 0,
        byShift: [],
        conflicts: [],
      }

      for (const deptId of selectedDeptIds) {
        const deptTemplates = templates.filter(
          (t) => t.departmentId === deptId && selectedTemplateIds.has(t.id),
        )
        if (deptTemplates.length === 0) continue

        const input: PlanWizardInput = {
          weekOffsets: Array.from(selectedWeeks).sort(),
          departmentId: deptId,
          shiftTemplateIds: deptTemplates.map((t) => t.id),
          priorityOrder,
          separateOverhead: true,
          mode,
          processAssignment: 'fixed',
          traineeCount: 0,
          respectContractHours,
          maxOvertimeHours,
          fairSpread,
        }

        const res = await generatePlanAction(input)
        combinedResult.totalCreated += res.totalCreated
        combinedResult.totalRemaining += res.totalRemaining
        combinedResult.totalSlots += res.totalSlots
        combinedResult.byShift.push(...res.byShift)
        combinedResult.conflicts.push(...res.conflicts)
        if (res.error) combinedResult.error = res.error
      }

      setResult(combinedResult)
      setStep('result')
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const activeSteps = STEPS.filter((s) => {
    if (s.key === 'result') return step === 'result'
    return true
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative z-10 w-full max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden"
        style={{ maxHeight: 'calc(100vh - 80px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Autoplan</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {initialScope.fromZoomLevel === 'birds-eye' && 'Alle afdelingen plannen'}
              {initialScope.fromZoomLevel === 'department' && `${departments.find((d) => initialScope.departmentIds[0] === d.id)?.name ?? ''} plannen`}
              {initialScope.fromZoomLevel === 'shift-detail' && 'Shift invullen'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-3 border-b border-gray-50 bg-gray-50/50">
          <StepIndicator current={step} steps={activeSteps} />
        </div>

        {/* Step content */}
        <div className="px-6 py-5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <AnimatePresence mode="wait">
            {/* ── Step 1: Scope ──────────────────────────────────────── */}
            {step === 'scope' && (
              <motion.div key="scope" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Afdelingen</h3>
                  <div className="flex flex-wrap gap-2">
                    {departments.map((dept) => {
                      const selected = selectedDeptIds.has(dept.id)
                      const tplCount = templates.filter((t) => t.departmentId === dept.id).length
                      if (tplCount === 0) return null
                      return (
                        <button
                          key={dept.id}
                          type="button"
                          onClick={() => {
                            const next = new Set(selectedDeptIds)
                            if (selected) { next.delete(dept.id) } else { next.add(dept.id) }
                            setSelectedDeptIds(next)
                          }}
                          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                            selected
                              ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {dept.color && <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selected ? 'white' : dept.color, opacity: selected ? 0.7 : 1 }} />}
                          {dept.name}
                          <span className={`text-[10px] ${selected ? 'text-gray-400' : 'text-gray-400'}`}>{tplCount} shifts</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Periode (6 weken)</h3>
                  <WeekSelector
                    selectedWeeks={selectedWeeks}
                    onToggle={(w) => {
                      const next = new Set(selectedWeeks)
                      if (next.has(w)) { next.delete(w) } else { next.add(w) }
                      setSelectedWeeks(next)
                    }}
                  />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Shifts</h3>
                  <div className="flex flex-wrap gap-2">
                    {scopedTemplates.map((tpl) => {
                      const selected = selectedTemplateIds.has(tpl.id)
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => {
                            const next = new Set(selectedTemplateIds)
                            if (selected) { next.delete(tpl.id) } else { next.add(tpl.id) }
                            setSelectedTemplateIds(next)
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                            selected
                              ? 'border-gray-900 bg-gray-900 text-white'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {tpl.name}
                          <span className="opacity-50">{tpl.startTime}-{tpl.endTime}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Demand ─────────────────────────────────────── */}
            {step === 'demand' && (
              <motion.div key="demand" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <p className="text-xs text-gray-500">Overzicht van de vraag per afdeling en shift voor de geselecteerde periode.</p>

                {/* Summary KPIs */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Totaal nodig</p>
                    <p className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">{demandPreview.reduce((s, p) => s + p.totalRequired, 0)}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Reeds ingevuld</p>
                    <p className="text-xl font-bold text-emerald-600 tabular-nums mt-0.5">{demandPreview.reduce((s, p) => s + p.totalAssigned, 0)}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Open posities</p>
                    <p className="text-xl font-bold text-red-600 tabular-nums mt-0.5">{demandPreview.reduce((s, p) => s + p.gap, 0)}</p>
                  </div>
                </div>

                {/* Demand table */}
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400">Afdeling</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400">Shift</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400">Nodig</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400">Ingevuld</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400">Gap</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {demandPreview.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="px-4 py-2 text-xs font-medium text-gray-900">{row.deptName}</td>
                          <td className="px-4 py-2 text-xs text-gray-600">{row.shiftName}</td>
                          <td className="px-4 py-2 text-xs text-gray-700 text-right tabular-nums font-semibold">{row.totalRequired}</td>
                          <td className="px-4 py-2 text-xs text-emerald-600 text-right tabular-nums font-semibold">{row.totalAssigned}</td>
                          <td className={`px-4 py-2 text-xs text-right tabular-nums font-bold ${row.gap > 0 ? 'text-red-600' : 'text-gray-300'}`}>{row.gap}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Strategy ───────────────────────────────────── */}
            {step === 'strategy' && (
              <motion.div key="strategy" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                {/* Priority */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Prioriteit</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: 'internal-first' as const, label: 'Intern eerst', desc: 'Interne medewerkers hebben voorrang' },
                      { value: 'temp-first' as const, label: 'Temp eerst', desc: 'Uitzendkrachten eerst inzetten' },
                    ]).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPriorityOrder(opt.value)}
                        className={`rounded-xl border p-4 text-left transition-all ${
                          priorityOrder === opt.value
                            ? 'border-gray-900 bg-gray-50 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mode */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Modus</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: 'performance' as const, label: 'Performance', desc: 'Hoogste skill levels eerst' },
                      { value: 'training' as const, label: 'Training', desc: 'Mix van levels voor ontwikkeling' },
                    ]).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setMode(opt.value)}
                        className={`rounded-xl border p-4 text-left transition-all ${
                          mode === opt.value
                            ? 'border-gray-900 bg-gray-50 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-3">
                  <ToggleRow label="Eerlijke spreiding" desc="Uren gelijk verdelen over medewerkers" value={fairSpread} onChange={setFairSpread} />
                  <ToggleRow label="Contracturen respecteren" desc="Niet boven contracturen plannen" value={respectContractHours} onChange={setRespectContractHours} />
                  {respectContractHours && (
                    <div className="pl-4 border-l-2 border-gray-100">
                      <label className="text-xs text-gray-600 block mb-1">Max overwerk (uren/week)</label>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={maxOvertimeHours}
                        onChange={(e) => setMaxOvertimeHours(parseInt(e.target.value) || 0)}
                        className="w-20 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm tabular-nums text-gray-900 focus:outline-none focus:border-gray-400"
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Step 4: Constraints ────────────────────────────────── */}
            {step === 'constraints' && (
              <motion.div key="constraints" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <p className="text-xs text-gray-500">Automatische checks op beschikbaarheid en capaciteit.</p>

                <div className="space-y-2">
                  {constraintChecks.map((check, i) => (
                    <div key={i} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                      check.status === 'ok' ? 'border-emerald-200 bg-emerald-50/50' :
                      check.status === 'warning' ? 'border-amber-200 bg-amber-50/50' :
                      'border-red-200 bg-red-50/50'
                    }`}>
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                        check.status === 'ok' ? 'bg-emerald-500' :
                        check.status === 'warning' ? 'bg-amber-400' :
                        'bg-red-500'
                      }`}>
                        {check.status === 'ok' ? (
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
                        ) : (
                          <span className="text-[8px] font-bold text-white">!</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-gray-900">{check.label}</p>
                        <p className="text-[11px] text-gray-500">{check.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Step 5: Preview ─────────────────────────────────────── */}
            {step === 'preview' && (
              <motion.div key="preview" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3">
                  <p className="text-xs text-sky-800 font-medium">
                    De optimizer gaat {demandPreview.reduce((s, p) => s + p.gap, 0)} openstaande posities invullen
                    over {selectedWeeks.size} weken, voor {selectedDeptIds.size} afdeling{selectedDeptIds.size !== 1 ? 'en' : ''}.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <SummaryCard label="Afdelingen" value={selectedDeptIds.size} />
                  <SummaryCard label="Weken" value={selectedWeeks.size} />
                  <SummaryCard label="Shifts" value={selectedTemplateIds.size} />
                  <SummaryCard label="Open posities" value={demandPreview.reduce((s, p) => s + p.gap, 0)} />
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Instellingen</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-gray-100 px-3 py-2">
                      <span className="text-gray-400">Prioriteit:</span> <span className="font-medium text-gray-900">{priorityOrder === 'internal-first' ? 'Intern eerst' : 'Temp eerst'}</span>
                    </div>
                    <div className="rounded-lg border border-gray-100 px-3 py-2">
                      <span className="text-gray-400">Modus:</span> <span className="font-medium text-gray-900">{mode === 'performance' ? 'Performance' : 'Training'}</span>
                    </div>
                    <div className="rounded-lg border border-gray-100 px-3 py-2">
                      <span className="text-gray-400">Fair spread:</span> <span className="font-medium text-gray-900">{fairSpread ? 'Aan' : 'Uit'}</span>
                    </div>
                    <div className="rounded-lg border border-gray-100 px-3 py-2">
                      <span className="text-gray-400">Max overwerk:</span> <span className="font-medium text-gray-900">{maxOvertimeHours}u</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Step 6: Result ──────────────────────────────────────── */}
            {step === 'result' && result && (
              <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                {/* Success/error header */}
                <div className={`rounded-xl border px-5 py-4 ${result.error ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${result.error ? 'bg-red-500' : 'bg-emerald-500'}`}>
                      {result.error ? (
                        <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M1 1L11 11M11 1L1 11" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        {result.error ? 'Er is een fout opgetreden' : 'Planning succesvol gegenereerd'}
                      </p>
                      {result.error && <p className="text-xs text-red-700 mt-0.5">{result.error}</p>}
                    </div>
                  </div>
                </div>

                {/* Result KPIs */}
                <div className="grid grid-cols-3 gap-3">
                  <SummaryCard label="Aangemaakt" value={result.totalCreated} variant="positive" />
                  <SummaryCard label="Openstaand" value={result.totalRemaining} variant={result.totalRemaining > 0 ? 'warning' : 'default'} />
                  <SummaryCard label="Totaal slots" value={result.totalSlots} />
                </div>

                {/* Per-shift breakdown */}
                {result.byShift.length > 0 && (
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400">Shift</th>
                          <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400">Aangemaakt</th>
                          <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400">Resterend</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {result.byShift.map((row, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2 text-xs font-medium text-gray-900">{row.shiftName}</td>
                            <td className="px-4 py-2 text-xs text-emerald-600 text-right tabular-nums font-bold">{row.created}</td>
                            <td className={`px-4 py-2 text-xs text-right tabular-nums font-bold ${row.remaining > 0 ? 'text-amber-600' : 'text-gray-300'}`}>{row.remaining}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Conflicts */}
                {result.conflicts.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 mb-2">Waarschuwingen</p>
                    <ul className="space-y-1">
                      {result.conflicts.slice(0, 10).map((c, i) => (
                        <li key={i} className="text-xs text-amber-800">{c}</li>
                      ))}
                      {result.conflicts.length > 10 && (
                        <li className="text-xs text-amber-600">+{result.conflicts.length - 10} meer...</li>
                      )}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            type="button"
            onClick={step === 'result' ? () => { onComplete(); onClose() } : goPrev}
            disabled={step === 'scope' && initialScope.fromZoomLevel === 'birds-eye'}
            className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {step === 'result' ? 'Sluiten' : '\u2190 Terug'}
          </button>

          {step === 'preview' ? (
            <button
              type="button"
              onClick={executePlan}
              disabled={isPending || selectedDeptIds.size === 0}
              className="rounded-lg bg-gray-900 px-6 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Planning genereren...
                </>
              ) : (
                'Plan genereren'
              )}
            </button>
          ) : step !== 'result' ? (
            <button
              type="button"
              onClick={goNext}
              disabled={step === 'scope' && selectedDeptIds.size === 0}
              className="rounded-lg bg-gray-900 px-5 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              Volgende &rarr;
            </button>
          ) : null}
        </div>
      </motion.div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  desc,
  value,
  onChange,
}: {
  label: string
  desc: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
      <div>
        <p className="text-xs font-semibold text-gray-900">{label}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${value ? 'bg-gray-900' : 'bg-gray-300'}`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  variant = 'default',
}: {
  label: string
  value: number
  variant?: 'default' | 'positive' | 'warning'
}) {
  const color =
    variant === 'positive' ? 'text-emerald-600' :
    variant === 'warning' ? 'text-amber-600' :
    'text-gray-900'

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className={`text-xl font-bold tabular-nums mt-0.5 ${color}`}>{value}</p>
    </div>
  )
}
