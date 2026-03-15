'use client'

import { useState, useMemo, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DepartmentWithChildren } from '@/lib/queries/locations'
import { generatePlanAction, type PlanWizardResult } from '@/app/planning/actions'
import FireworksCelebration from '@/components/planning/FireworksCelebration'

// ── Types ────────────────────────────────────────────────────────────────────

interface WizardState {
  step: number
  direction: 1 | -1
  // Step 1 — Scope
  selectedWeeks: Set<number> // week offsets from current (0–5)
  // Step 2 — Department
  departmentId: string | null
  // Step 3 — Shifts
  selectedShiftIds: Set<string>
  // Step 4 — Priority
  priorityOrder: 'internal-first' | 'temp-first'
  separateOverhead: boolean
  // Step 5 — Strategy
  mode: 'performance' | 'training'
  processAssignment: 'fixed' | 'rotate'
  // Step 6 — Training (conditional)
  trainingProcessId: string | null
  traineeCount: number
  traineeSelection: 'auto' | 'manual'
  selectedTraineeIds: Set<string>
  // Step 7 — Constraints
  respectContractHours: boolean
  maxOvertimeHours: number
  fairSpread: boolean
  // Step 8 — Preview (computed)
  // Step 9 — Temp request (conditional)
  tempAction: 'use-pool' | 'request-new' | null
}

const DEFAULTS: WizardState = {
  step: 0,
  direction: 1,
  selectedWeeks: new Set([0, 1, 2, 3, 4, 5]),
  departmentId: null,
  selectedShiftIds: new Set(),
  priorityOrder: 'internal-first',
  separateOverhead: true,
  mode: 'performance',
  processAssignment: 'fixed',
  trainingProcessId: null,
  traineeCount: 2,
  traineeSelection: 'auto',
  selectedTraineeIds: new Set(),
  respectContractHours: true,
  maxOvertimeHours: 4,
  fairSpread: true,
  tempAction: null,
}

const TOTAL_STEPS = 9

interface ProcessInfo {
  id: string
  name: string
  departmentId: string | null
  active: boolean
}

interface EmployeeWithScores {
  id: string
  name: string
  employeeType: string
  departmentId: string | null
  contractHours: number
  processScores: { processId: string; level: number }[]
}

interface Props {
  open: boolean
  onClose: () => void
  departments: DepartmentWithChildren[]
  templates: { id: string; name: string; startTime: string; endTime: string; departmentId: string | null }[]
  employees: EmployeeWithScores[]
  processes: ProcessInfo[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getWeekLabel(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay() + 1 + offset * 7) // Monday of that week
  const end = new Date(d)
  end.setDate(end.getDate() + 6)
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
}

function getWeekNumber(offset: number): number {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay() + 1 + offset * 7)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}

// ── Step components ─────────────────────────────────────────────────────────

function StepScope({ state, onChange }: { state: WizardState; onChange: (s: Partial<WizardState>) => void }) {
  function toggleWeek(offset: number) {
    const next = new Set(state.selectedWeeks)
    if (next.has(offset)) next.delete(offset); else next.add(offset)
    onChange({ selectedWeeks: next })
  }

  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-1">Welke weken plannen?</h3>
      <p className="text-sm text-gray-500 mb-5">Selecteer de weken die je wilt invullen. Standaard 6 weken vooruit.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Array.from({ length: 6 }, (_, i) => {
          const selected = state.selectedWeeks.has(i)
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggleWeek(i)}
              className={[
                'relative rounded-xl border-2 p-4 text-left transition-all duration-200 cursor-pointer',
                selected
                  ? 'border-[#4F6BFF] bg-blue-50/60 shadow-[0_0_0_3px_rgba(79,107,255,0.12)]'
                  : 'border-gray-200 bg-white hover:border-gray-300',
              ].join(' ')}
            >
              {selected && (
                <div className="absolute top-2 right-2">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" fill="#4F6BFF" /><path d="M6 10.5l2.5 2.5L14 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              )}
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Week {getWeekNumber(i)}</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{getWeekLabel(i)}</p>
              {i === 0 && <span className="inline-block mt-1.5 text-[10px] font-bold text-blue-600 bg-blue-100 rounded-full px-2 py-0.5">Huidige week</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StepDepartment({ state, onChange, departments }: { state: WizardState; onChange: (s: Partial<WizardState>) => void; departments: DepartmentWithChildren[] }) {
  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-1">Voor welke afdeling?</h3>
      <p className="text-sm text-gray-500 mb-5">Kies de afdeling waarvoor je wilt plannen.</p>
      <div className="grid grid-cols-2 gap-3">
        {departments.map((dept) => {
          const selected = state.departmentId === dept.id
          return (
            <button
              key={dept.id}
              type="button"
              onClick={() => onChange({ departmentId: dept.id })}
              className={[
                'relative rounded-xl border-2 p-4 text-left transition-all duration-200 cursor-pointer',
                selected
                  ? 'border-[#4F6BFF] bg-blue-50/60 shadow-[0_0_0_3px_rgba(79,107,255,0.12)]'
                  : 'border-gray-200 bg-white hover:border-gray-300',
              ].join(' ')}
            >
              {selected && (
                <div className="absolute top-3 right-3">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" fill="#4F6BFF" /><path d="M6 10.5l2.5 2.5L14 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              )}
              <p className="text-sm font-bold text-gray-900">{dept.name}</p>
              {dept.children.length > 0 && (
                <p className="text-[11px] text-gray-400 mt-0.5">{dept.children.length} subdepartment{dept.children.length !== 1 ? 's' : ''}</p>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StepShifts({ state, onChange, templates }: {
  state: WizardState; onChange: (s: Partial<WizardState>) => void
  templates: Props['templates']
}) {
  const filtered = state.departmentId
    ? templates.filter((t) => t.departmentId === state.departmentId || !t.departmentId)
    : templates

  function toggle(id: string) {
    const next = new Set(state.selectedShiftIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    onChange({ selectedShiftIds: next })
  }

  function selectAll() {
    onChange({ selectedShiftIds: new Set(filtered.map((t) => t.id)) })
  }

  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-1">Welke shifts invullen?</h3>
      <p className="text-sm text-gray-500 mb-4">Selecteer de diensten die je wilt plannen.</p>
      <button onClick={selectAll} className="text-xs font-medium text-[#4F6BFF] hover:underline mb-3 inline-block">Alles selecteren</button>
      <div className="space-y-2">
        {filtered.map((t) => {
          const selected = state.selectedShiftIds.has(t.id)
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              className={[
                'w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all duration-200 cursor-pointer',
                selected
                  ? 'border-[#4F6BFF] bg-blue-50/50'
                  : 'border-gray-200 bg-white hover:border-gray-300',
              ].join(' ')}
            >
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${selected ? 'border-[#4F6BFF] bg-[#4F6BFF]' : 'border-gray-300'}`}>
                {selected && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5L9.5 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </div>
              <div className="flex-1">
                <span className="text-sm font-semibold text-gray-900">{t.name}</span>
                <span className="text-xs text-gray-400 ml-2">{t.startTime} – {t.endTime}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StepPriority({ state, onChange }: { state: WizardState; onChange: (s: Partial<WizardState>) => void }) {
  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-1">Planningsprioriteit</h3>
      <p className="text-sm text-gray-500 mb-5">Wie wordt er eerst ingepland?</p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {([
          { value: 'internal-first' as const, label: 'Intern eerst', desc: 'Eigen personeel krijgt voorrang. Temps vullen de rest.', icon: '👥' },
          { value: 'temp-first' as const, label: 'Temps eerst', desc: 'Vaste uitzendkrachten eerst, intern als aanvulling.', icon: '🔄' },
        ]).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange({ priorityOrder: opt.value })}
            className={[
              'relative rounded-xl border-2 p-4 text-left transition-all duration-200 cursor-pointer',
              state.priorityOrder === opt.value
                ? 'border-[#4F6BFF] bg-blue-50/60 shadow-[0_0_0_3px_rgba(79,107,255,0.12)]'
                : 'border-gray-200 bg-white hover:border-gray-300',
            ].join(' ')}
          >
            <p className="text-2xl mb-2">{opt.icon}</p>
            <p className="text-sm font-bold text-gray-900">{opt.label}</p>
            <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
          </button>
        ))}
      </div>

      <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
        <input type="checkbox" checked={state.separateOverhead} onChange={(e) => onChange({ separateOverhead: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-[#4F6BFF] focus:ring-[#4F6BFF]" />
        <div>
          <p className="text-sm font-semibold text-gray-900">Overhead scheiden</p>
          <p className="text-xs text-gray-400">Overhead functies worden apart behandeld van direct labour.</p>
        </div>
      </label>
    </div>
  )
}

function StepStrategy({ state, onChange }: { state: WizardState; onChange: (s: Partial<WizardState>) => void }) {
  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-1">Toewijzingsstrategie</h3>
      <p className="text-sm text-gray-500 mb-5">Hoe moeten medewerkers worden toegewezen?</p>

      {/* Performance vs Training */}
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Modus</p>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          type="button"
          onClick={() => onChange({ mode: 'performance' })}
          className={[
            'relative rounded-xl border-2 p-4 text-left transition-all duration-200 cursor-pointer',
            state.mode === 'performance'
              ? 'border-emerald-400 bg-emerald-50/60 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]'
              : 'border-gray-200 bg-white hover:border-gray-300',
          ].join(' ')}
        >
          <p className="text-2xl mb-2">🚀</p>
          <p className="text-sm font-bold text-gray-900">Performance</p>
          <p className="text-xs text-gray-500 mt-1">Medewerkers met de hoogste process scores worden eerst ingepland.</p>
        </button>
        <button
          type="button"
          onClick={() => onChange({ mode: 'training' })}
          className={[
            'relative rounded-xl border-2 p-4 text-left transition-all duration-200 cursor-pointer',
            state.mode === 'training'
              ? 'border-violet-400 bg-violet-50/60 shadow-[0_0_0_3px_rgba(139,92,246,0.12)]'
              : 'border-gray-200 bg-white hover:border-gray-300',
          ].join(' ')}
        >
          <p className="text-2xl mb-2">📚</p>
          <p className="text-sm font-bold text-gray-900">Training</p>
          <p className="text-xs text-gray-500 mt-1">Mix ongetrainde medewerkers bij om ze te laten leren op nieuwe processen.</p>
        </button>
      </div>

      {/* Fixed vs Rotate */}
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Procesverdeling</p>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChange({ processAssignment: 'fixed' })}
          className={[
            'rounded-xl border-2 p-4 text-left transition-all duration-200 cursor-pointer',
            state.processAssignment === 'fixed'
              ? 'border-[#4F6BFF] bg-blue-50/60'
              : 'border-gray-200 bg-white hover:border-gray-300',
          ].join(' ')}
        >
          <p className="text-sm font-bold text-gray-900">Vast op proces</p>
          <p className="text-xs text-gray-500 mt-1">Medewerkers werken steeds op hetzelfde proces.</p>
        </button>
        <button
          type="button"
          onClick={() => onChange({ processAssignment: 'rotate' })}
          className={[
            'rounded-xl border-2 p-4 text-left transition-all duration-200 cursor-pointer',
            state.processAssignment === 'rotate'
              ? 'border-[#4F6BFF] bg-blue-50/60'
              : 'border-gray-200 bg-white hover:border-gray-300',
          ].join(' ')}
        >
          <p className="text-sm font-bold text-gray-900">Rouleren</p>
          <p className="text-xs text-gray-500 mt-1">Medewerkers wisselen tussen processen voor bredere inzetbaarheid.</p>
        </button>
      </div>
    </div>
  )
}

const LEVEL_LABELS = ['Not trained', 'Learning', 'Operational', 'Strong', 'Elite']
const LEVEL_COLORS = ['bg-gray-300', 'bg-orange-400', 'bg-blue-500', 'bg-violet-500', 'bg-amber-500']

function StepTraining({ state, onChange, employees, processes }: {
  state: WizardState; onChange: (s: Partial<WizardState>) => void
  employees: Props['employees']; processes: Props['processes']
}) {
  // Processes for selected department
  const deptProcesses = useMemo(() =>
    processes.filter((p) => p.active && (!state.departmentId || p.departmentId === state.departmentId || !p.departmentId)),
    [processes, state.departmentId],
  )

  // Employees in department (internal only for training)
  const deptEmployees = useMemo(() =>
    employees.filter((e) => e.employeeType === 'internal' && (!state.departmentId || e.departmentId === state.departmentId)),
    [employees, state.departmentId],
  )

  // Eligible trainees: employees with level 0 or 1 (or no record) for selected process
  const eligibleTrainees = useMemo(() => {
    if (!state.trainingProcessId) return deptEmployees
    return deptEmployees.filter((e) => {
      const score = e.processScores.find((s) => s.processId === state.trainingProcessId)
      return !score || score.level <= 1 // no record = never assessed, level 0 = not trained, level 1 = learning
    })
  }, [deptEmployees, state.trainingProcessId])

  // Trained count for selected process (level >= 2)
  const trainedCount = useMemo(() => {
    if (!state.trainingProcessId) return 0
    return deptEmployees.filter((e) => {
      const score = e.processScores.find((s) => s.processId === state.trainingProcessId)
      return score && score.level >= 2
    }).length
  }, [deptEmployees, state.trainingProcessId])

  function toggleTrainee(id: string) {
    const next = new Set(state.selectedTraineeIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    if (next.size <= state.traineeCount) onChange({ selectedTraineeIds: next })
  }

  function getEmployeeLevel(empId: string): number {
    if (!state.trainingProcessId) return -1
    const emp = employees.find((e) => e.id === empId)
    const score = emp?.processScores.find((s) => s.processId === state.trainingProcessId)
    return score?.level ?? -1 // -1 = no record
  }

  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-1">Training configuratie</h3>
      <p className="text-sm text-gray-500 mb-5">Kies op welk proces je medewerkers wilt trainen.</p>

      {/* Process selection */}
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Trainingsproces</p>
      <div className="grid grid-cols-2 gap-2 mb-5">
        {deptProcesses.map((proc) => {
          const selected = state.trainingProcessId === proc.id
          const untrainedCount = deptEmployees.filter((e) => {
            const s = e.processScores.find((ps) => ps.processId === proc.id)
            return !s || s.level <= 1
          }).length
          return (
            <button
              key={proc.id}
              type="button"
              onClick={() => onChange({ trainingProcessId: proc.id, selectedTraineeIds: new Set() })}
              className={[
                'rounded-xl border-2 px-3 py-2.5 text-left transition-all duration-200 cursor-pointer',
                selected ? 'border-violet-400 bg-violet-50/60 shadow-[0_0_0_3px_rgba(139,92,246,0.12)]' : 'border-gray-200 bg-white hover:border-gray-300',
              ].join(' ')}
            >
              <p className="text-sm font-semibold text-gray-900">{proc.name}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {untrainedCount} ongetraind
              </p>
            </button>
          )
        })}
      </div>

      {/* Stats for selected process */}
      {state.trainingProcessId && (
        <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 mb-5">
          <div className="text-center">
            <p className="text-lg font-bold text-emerald-600 tabular-nums">{trainedCount}</p>
            <p className="text-[10px] text-gray-400">Getraind</p>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div className="text-center">
            <p className="text-lg font-bold text-amber-600 tabular-nums">{eligibleTrainees.length}</p>
            <p className="text-[10px] text-gray-400">Te trainen</p>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900 tabular-nums">{deptEmployees.length}</p>
            <p className="text-[10px] text-gray-400">Totaal</p>
          </div>
        </div>
      )}

      {/* Trainee count */}
      <div className="flex items-center gap-4 mb-5">
        <label className="text-sm font-medium text-gray-700">Aantal trainees</label>
        <input
          type="number"
          min={1}
          max={Math.max(1, eligibleTrainees.length)}
          value={state.traineeCount}
          onChange={(e) => onChange({ traineeCount: Math.max(1, Math.min(eligibleTrainees.length || 10, parseInt(e.target.value) || 1)) })}
          className="w-20 rounded-lg border border-gray-200 px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/30"
        />
        <span className="text-xs text-gray-400">van {eligibleTrainees.length} beschikbaar</span>
      </div>

      {/* Selection method */}
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Selectiemethode</p>
      <div className="grid grid-cols-2 gap-3 mb-5">
        <button type="button" onClick={() => onChange({ traineeSelection: 'auto' })}
          className={['rounded-xl border-2 p-4 text-left transition-all duration-200 cursor-pointer', state.traineeSelection === 'auto' ? 'border-[#4F6BFF] bg-blue-50/60' : 'border-gray-200 bg-white hover:border-gray-300'].join(' ')}>
          <p className="text-sm font-bold text-gray-900">Automatisch</p>
          <p className="text-xs text-gray-500 mt-1">Selecteert medewerkers met de meeste beschikbaarheid en potentie.</p>
        </button>
        <button type="button" onClick={() => onChange({ traineeSelection: 'manual' })}
          className={['rounded-xl border-2 p-4 text-left transition-all duration-200 cursor-pointer', state.traineeSelection === 'manual' ? 'border-[#4F6BFF] bg-blue-50/60' : 'border-gray-200 bg-white hover:border-gray-300'].join(' ')}>
          <p className="text-sm font-bold text-gray-900">Handmatig</p>
          <p className="text-xs text-gray-500 mt-1">Kies zelf wie je wilt trainen op dit proces.</p>
        </button>
      </div>

      {/* Manual trainee selection */}
      {state.traineeSelection === 'manual' && state.trainingProcessId && (
        <div>
          <p className="text-xs text-gray-400 mb-2">
            Selecteer {state.traineeCount} medewerker{state.traineeCount !== 1 ? 's' : ''} ({state.selectedTraineeIds.size}/{state.traineeCount})
          </p>
          <div className="max-h-52 overflow-y-auto space-y-1 rounded-xl border border-gray-200 p-2">
            {eligibleTrainees.map((emp) => {
              const selected = state.selectedTraineeIds.has(emp.id)
              const disabled = !selected && state.selectedTraineeIds.size >= state.traineeCount
              const level = getEmployeeLevel(emp.id)
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => !disabled && toggleTrainee(emp.id)}
                  disabled={disabled}
                  className={[
                    'w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    selected ? 'bg-violet-50 text-violet-700 font-medium' : disabled ? 'text-gray-300' : 'text-gray-700 hover:bg-gray-50',
                  ].join(' ')}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${selected ? 'border-violet-500 bg-violet-500' : 'border-gray-300'}`}>
                    {selected && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5L9.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  <span className="flex-1 truncate">{emp.name}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    <span className={`w-2 h-2 rounded-full ${level >= 0 ? LEVEL_COLORS[level] : 'bg-gray-200'}`} />
                    <span className="text-[10px] text-gray-400">{level >= 0 ? LEVEL_LABELS[level] : 'Geen data'}</span>
                  </span>
                </button>
              )
            })}
            {eligibleTrainees.length === 0 && (
              <p className="text-xs text-gray-400 py-4 text-center">Alle medewerkers zijn al getraind op dit proces.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StepConstraints({ state, onChange }: { state: WizardState; onChange: (s: Partial<WizardState>) => void }) {
  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-1">Constraints & regels</h3>
      <p className="text-sm text-gray-500 mb-5">Stel beperkingen in voor het planningsalgoritme.</p>

      <div className="space-y-3">
        {/* Contract hours */}
        <div className={`rounded-xl border px-4 py-3 transition-colors ${state.respectContractHours ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-white'}`}>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={state.respectContractHours} onChange={(e) => onChange({ respectContractHours: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-[#4F6BFF] focus:ring-[#4F6BFF]" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Contracturen respecteren</p>
              <p className="text-xs text-gray-400">Voorkom dat medewerkers boven hun contracturen worden ingepland.</p>
            </div>
          </label>
          {state.respectContractHours && (
            <div className="flex items-center gap-3 mt-3 ml-7">
              <label className="text-xs text-gray-500">Max. overschrijding toegestaan:</label>
              <input
                type="number"
                min={0}
                max={20}
                value={state.maxOvertimeHours}
                onChange={(e) => onChange({ maxOvertimeHours: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/30"
              />
              <span className="text-xs text-gray-400">uur</span>
            </div>
          )}
        </div>

        {/* Fair spread */}
        <label className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${state.fairSpread ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-white'}`}>
          <input type="checkbox" checked={state.fairSpread} onChange={(e) => onChange({ fairSpread: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-[#4F6BFF] focus:ring-[#4F6BFF]" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Fair spread</p>
            <p className="text-xs text-gray-400">Verdeel uren gelijk over medewerkers. Wie minder uren heeft, krijgt voorrang.</p>
          </div>
        </label>
      </div>
    </div>
  )
}

function StepPreview({ state, employees, templates }: {
  state: WizardState
  employees: Props['employees']
  templates: Props['templates']
}) {
  // Mock dry-run computation
  const deptEmployees = employees.filter((e) => !state.departmentId || e.departmentId === state.departmentId)
  const internalCount = deptEmployees.filter((e) => e.employeeType === 'internal').length
  const tempCount = deptEmployees.filter((e) => e.employeeType === 'temp').length
  const shiftsPerWeek = state.selectedShiftIds.size
  const weeksCount = state.selectedWeeks.size
  const totalSlots = shiftsPerWeek * weeksCount * 5 // 5 workdays
  const estimatedAssignments = Math.min(totalSlots, (internalCount + tempCount) * weeksCount * 4)
  const coverageRate = totalSlots > 0 ? Math.min(1, estimatedAssignments / totalSlots) : 0
  const tempNeeded = Math.max(0, totalSlots - internalCount * weeksCount * 4)

  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-1">Preview & bevestig</h3>
      <p className="text-sm text-gray-500 mb-5">Controleer je instellingen voordat de planning wordt gegenereerd.</p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
          <p className="text-2xl font-bold text-[#4F6BFF] tabular-nums">{estimatedAssignments}</p>
          <p className="text-[10px] text-gray-400 font-medium uppercase">Assignments</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600 tabular-nums">{Math.round(coverageRate * 100)}%</p>
          <p className="text-[10px] text-gray-400 font-medium uppercase">Coverage</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{internalCount + tempCount}</p>
          <p className="text-[10px] text-gray-400 font-medium uppercase">Medewerkers</p>
        </div>
      </div>

      {/* Settings summary */}
      <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-2 mb-5">
        <div className="flex justify-between text-xs"><span className="text-gray-500">Weken</span><span className="font-medium text-gray-900">{weeksCount} weken</span></div>
        <div className="flex justify-between text-xs"><span className="text-gray-500">Shifts</span><span className="font-medium text-gray-900">{shiftsPerWeek} templates</span></div>
        <div className="flex justify-between text-xs"><span className="text-gray-500">Prioriteit</span><span className="font-medium text-gray-900">{state.priorityOrder === 'internal-first' ? 'Intern eerst' : 'Temps eerst'}</span></div>
        <div className="flex justify-between text-xs"><span className="text-gray-500">Modus</span><span className="font-medium text-gray-900">{state.mode === 'performance' ? 'Performance' : 'Training'}</span></div>
        <div className="flex justify-between text-xs"><span className="text-gray-500">Procesverdeling</span><span className="font-medium text-gray-900">{state.processAssignment === 'fixed' ? 'Vast' : 'Rouleren'}</span></div>
        {state.respectContractHours && (
          <div className="flex justify-between text-xs"><span className="text-gray-500">Max overuren</span><span className="font-medium text-gray-900">{state.maxOvertimeHours}h</span></div>
        )}
        <div className="flex justify-between text-xs"><span className="text-gray-500">Fair spread</span><span className="font-medium text-gray-900">{state.fairSpread ? 'Aan' : 'Uit'}</span></div>
      </div>

      {/* Historical comparison (mock) */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4">
        <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"><path d="M1 12l3-4 3 2 3-5 3-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Vergelijking met vorige periode
        </p>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between"><span className="text-gray-600">Coverage vorige periode</span><span className="font-medium">—</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Dit plan (geschat)</span><span className="font-bold text-emerald-600">{Math.round(coverageRate * 100)}%</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Intern/temp verhouding</span><span className="font-medium">{internalCount} / {tempCount}</span></div>
        </div>
      </div>

      {/* Conflict detection (mock) */}
      {tempNeeded > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4 mt-4">
          <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1">⚠ Onvoldoende personeel</p>
          <p className="text-xs text-gray-600">Er zijn naar schatting <strong>{tempNeeded}</strong> extra shifts die niet intern kunnen worden ingevuld.</p>
        </div>
      )}
    </div>
  )
}

function StepTempRequest({ state, onChange }: { state: WizardState; onChange: (s: Partial<WizardState>) => void }) {
  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-1">Uitzendkrachten</h3>
      <p className="text-sm text-gray-500 mb-5">Er is onvoldoende eigen personeel. Hoe wil je dit oplossen?</p>

      <div className="grid grid-cols-1 gap-3">
        <button type="button" onClick={() => onChange({ tempAction: 'use-pool' })}
          className={['rounded-xl border-2 p-5 text-left transition-all duration-200 cursor-pointer', state.tempAction === 'use-pool' ? 'border-[#4F6BFF] bg-blue-50/60 shadow-[0_0_0_3px_rgba(79,107,255,0.12)]' : 'border-gray-200 bg-white hover:border-gray-300'].join(' ')}>
          <p className="text-sm font-bold text-gray-900 mb-1">Bestaande temps inzetten</p>
          <p className="text-xs text-gray-500">Gebruik de uitzendkrachten die al in het systeem staan.</p>
        </button>

        <button type="button" onClick={() => onChange({ tempAction: 'request-new' })}
          className={['rounded-xl border-2 p-5 text-left transition-all duration-200 cursor-pointer', state.tempAction === 'request-new' ? 'border-amber-400 bg-amber-50/60 shadow-[0_0_0_3px_rgba(245,158,11,0.12)]' : 'border-gray-200 bg-white hover:border-gray-300'].join(' ')}>
          <p className="text-sm font-bold text-gray-900 mb-1">Extra temps aanvragen</p>
          <p className="text-xs text-gray-500">Dien een verzoek in bij de OPS manager voor extra uitzendkrachten.</p>

          {state.tempAction === 'request-new' && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-amber-800 font-medium mb-2">Het verzoek wordt ter goedkeuring naar de OPS manager gestuurd. Na goedkeuring gaat er automatisch een mail naar het uitzendbureau.</p>
              <div className="flex items-center gap-2 text-[10px] text-amber-600">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Wacht op goedkeuring</span>
                <span>→</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Goedgekeurd</span>
                <span>→</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Mail verstuurd</span>
              </div>
            </div>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Main Wizard ──────────────────────────────────────────────────────────────

export default function PlanWizard({ open, onClose, departments, templates, employees, processes }: Props) {
  const [state, setState] = useState<WizardState>(DEFAULTS)
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<PlanWizardResult | null>(null)

  function update(partial: Partial<WizardState>) {
    setState((s) => ({ ...s, ...partial }))
  }

  // Determine which steps to show (skip training if performance mode)
  const steps = useMemo(() => {
    const base = ['scope', 'department', 'shifts', 'priority', 'strategy']
    if (state.mode === 'training') base.push('training')
    base.push('constraints', 'preview', 'temp-request')
    return base
  }, [state.mode])

  const currentStepName = steps[state.step] ?? 'scope'
  const isLastStep = state.step === steps.length - 1
  const progress = ((state.step + 1) / steps.length) * 100

  function canAdvance(): boolean {
    switch (currentStepName) {
      case 'scope': return state.selectedWeeks.size > 0
      case 'department': return state.departmentId !== null
      case 'shifts': return state.selectedShiftIds.size > 0
      default: return true
    }
  }

  function goNext() {
    if (state.step < steps.length - 1 && canAdvance()) {
      setState((s) => ({ ...s, step: s.step + 1, direction: 1 }))
    }
  }

  function goBack() {
    if (state.step > 0) {
      setState((s) => ({ ...s, step: s.step - 1, direction: -1 }))
    }
  }

  function handleClose() {
    setState(DEFAULTS)
    setResult(null)
    onClose()
  }

  function handleGenerate() {
    startTransition(async () => {
      const res = await generatePlanAction({
        weekOffsets: Array.from(state.selectedWeeks),
        departmentId: state.departmentId!,
        shiftTemplateIds: Array.from(state.selectedShiftIds),
        priorityOrder: state.priorityOrder,
        separateOverhead: state.separateOverhead,
        mode: state.mode,
        processAssignment: state.processAssignment,
        traineeCount: state.mode === 'training' ? state.traineeCount : 0,
        trainingProcessId: state.mode === 'training' ? state.trainingProcessId : null,
        selectedTraineeIds: state.mode === 'training' && state.traineeSelection === 'manual'
          ? Array.from(state.selectedTraineeIds)
          : [],
        respectContractHours: state.respectContractHours,
        maxOvertimeHours: state.maxOvertimeHours,
        fairSpread: state.fairSpread,
      })
      setResult(res)
    })
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={handleClose}
        className="fixed inset-0 z-[900] bg-black/40 backdrop-blur-sm"
      />

      {/* Dialog */}
      <div className="fixed inset-x-4 bottom-8 top-auto z-[910] mx-auto max-w-xl">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="rounded-2xl border border-gray-200/90 bg-white/98 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.22),0_4px_16px_rgba(0,0,0,0.08)]"
          style={{ maxHeight: 'calc(100vh - 100px)' }}
        >
          {/* Header */}
          <div className="px-6 pt-5 pb-0">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-[15px] font-bold text-gray-900 leading-tight tracking-[-0.01em]">Plan Wizard</h2>
                <p className="text-[12px] text-gray-400">Stap {state.step + 1} van {steps.length}</p>
              </div>
              <button onClick={handleClose} aria-label="Sluiten" className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-[3px] rounded-full bg-gray-100 mb-5">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-[#4F6BFF] to-[#6C83FF]" animate={{ width: `${progress}%` }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} />
            </div>
          </div>

          {/* Step content (scrollable) */}
          <div className="px-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            {/* Fireworks celebration overlay */}
            {result && !result.error && result.totalCreated > 0 && (
              <FireworksCelebration
                visible
                stats={{
                  created: result.totalCreated,
                  coverage: result.totalSlots > 0 ? Math.round((result.totalCreated / result.totalSlots) * 100) : 0,
                  open: result.totalRemaining,
                }}
              />
            )}

            {/* Result view — shown after generation */}
            {result ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              >
                <div className="text-center mb-5">
                  {result.error ? (
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-100 mb-3">
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="12" fill="#EF4444" opacity="0.9" /><path d="M10 10l8 8M18 10l-8 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" /></svg>
                    </div>
                  ) : (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.2, 1] }}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                      className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 mb-3"
                    >
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="12" fill="#22C55E" opacity="0.9" /><path d="M9 14.5l3.5 3.5L19 11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </motion.div>
                  )}
                  <h3 className="text-lg font-bold text-gray-900">
                    {result.error ? 'Er ging iets mis' : 'Planning gegenereerd!'}
                  </h3>
                  {result.error && <p className="text-sm text-red-600 mt-1">{result.error}</p>}
                </div>

                {!result.error && (
                  <div className="space-y-4">
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
                        <p className="text-2xl font-bold text-[#4F6BFF] tabular-nums">{result.totalCreated}</p>
                        <p className="text-[10px] text-gray-400 font-medium uppercase">Aangemaakt</p>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
                        <p className="text-2xl font-bold text-emerald-600 tabular-nums">{result.totalSlots > 0 ? Math.round((result.totalCreated / result.totalSlots) * 100) : 0}%</p>
                        <p className="text-[10px] text-gray-400 font-medium uppercase">Coverage</p>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
                        <p className={`text-2xl font-bold tabular-nums ${result.totalRemaining > 0 ? 'text-red-500' : 'text-gray-400'}`}>{result.totalRemaining}</p>
                        <p className="text-[10px] text-gray-400 font-medium uppercase">Open</p>
                      </div>
                    </div>

                    {/* Per-shift breakdown */}
                    {result.byShift.length > 0 && (
                      <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Per shift</p>
                        <div className="space-y-1.5">
                          {result.byShift.map((s) => (
                            <div key={s.shiftName} className="flex items-center justify-between text-xs">
                              <span className="text-gray-700">{s.shiftName}</span>
                              <span className="tabular-nums">
                                <span className="font-bold text-emerald-600">{s.created}</span>
                                {s.remaining > 0 && <span className="text-red-400 ml-1.5">({s.remaining} open)</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Conflicts */}
                    {result.conflicts.length > 0 && (
                      <details className="rounded-xl border border-amber-200 bg-amber-50/30 p-4">
                        <summary className="text-xs font-bold text-amber-700 cursor-pointer">{result.conflicts.length} conflict{result.conflicts.length !== 1 ? 'en' : ''}</summary>
                        <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                          {result.conflicts.map((c, i) => (
                            <p key={i} className="text-[11px] text-gray-600">{c}</p>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </motion.div>
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={state.step}
                  initial={{ opacity: 0, x: state.direction * 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: state.direction * -30 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                >
                  {currentStepName === 'scope' && <StepScope state={state} onChange={update} />}
                  {currentStepName === 'department' && <StepDepartment state={state} onChange={update} departments={departments} />}
                  {currentStepName === 'shifts' && <StepShifts state={state} onChange={update} templates={templates} />}
                  {currentStepName === 'priority' && <StepPriority state={state} onChange={update} />}
                  {currentStepName === 'strategy' && <StepStrategy state={state} onChange={update} />}
                  {currentStepName === 'training' && <StepTraining state={state} onChange={update} employees={employees} processes={processes} />}
                  {currentStepName === 'constraints' && <StepConstraints state={state} onChange={update} />}
                  {currentStepName === 'preview' && <StepPreview state={state} employees={employees} templates={templates} />}
                  {currentStepName === 'temp-request' && <StepTempRequest state={state} onChange={update} />}
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 flex items-center justify-between border-t border-gray-100 mt-4">
            <button
              onClick={result ? handleClose : state.step > 0 ? goBack : handleClose}
              className="text-[13px] font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              {result ? 'Sluiten' : state.step > 0 ? 'Vorige' : 'Annuleren'}
            </button>
            {!result && (
              <button
                onClick={isLastStep ? handleGenerate : goNext}
                disabled={!canAdvance() || isPending}
                className={[
                  'inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[13px] font-semibold transition-all duration-200 disabled:opacity-50',
                  isLastStep
                    ? 'bg-gradient-to-r from-[#4F6BFF] to-[#6C83FF] text-white shadow-[0_4px_14px_rgba(79,107,255,0.35)] hover:shadow-[0_6px_20px_rgba(79,107,255,0.45)] hover:-translate-y-0.5'
                    : 'bg-gray-900 text-white hover:bg-gray-700',
                ].join(' ')}
              >
                {isPending ? (
                  'Genereren...'
                ) : isLastStep ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Planning genereren
                  </>
                ) : (
                  <>
                    Volgende
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </>
  )
}
