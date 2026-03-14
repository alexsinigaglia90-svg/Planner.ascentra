'use client'

import { useState, useEffect, useCallback, useRef, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import type { Department } from '@/lib/queries/locations'
import type { Skill } from '@/lib/queries/skills'
import { createProcessAction } from '@/app/settings/masterdata/actions'
import type { ProcessDetailRow } from '@/lib/queries/processes'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WizardState {
  currentStep: number
  direction: 1 | -1
  processName: string
  department: string
  normUnit: string
  customNormUnit: string
  outputPerHour: string
  minimumStaffingEnabled: boolean
  minimumStaffing: string
  maximumStaffingEnabled: boolean
  maximumStaffing: string
  requiredSkill: string
  isActive: boolean
}

type UpdateFn = <K extends keyof WizardState>(key: K, value: WizardState[K]) => void

const DEFAULTS: WizardState = {
  currentStep: 0,
  direction: 1,
  processName: '',
  department: '',
  normUnit: '',
  customNormUnit: '',
  outputPerHour: '',
  minimumStaffingEnabled: false,
  minimumStaffing: '',
  maximumStaffingEnabled: false,
  maximumStaffing: '',
  requiredSkill: '',
  isActive: true,
}

const TOTAL_STEPS = 9

// ─── Static data (unchanged by phase) ────────────────────────────────────────

const NORM_UNITS = ['Orderlines', 'Orders', 'Cartons', 'Pallets', 'Roll containers', 'Units', 'Custom']

// ─── Per-step validation ──────────────────────────────────────────────────────

function canAdvance(s: WizardState, departments: Department[], skills: Skill[]): boolean {
  switch (s.currentStep) {
    case 0: return s.processName.trim().length > 0
    case 1: return departments.length > 0 && s.department.length > 0
    case 2: return s.normUnit.length > 0 && (s.normUnit !== 'Custom' || s.customNormUnit.trim().length > 0)
    case 3: return s.outputPerHour.trim().length > 0
    case 4: return !s.minimumStaffingEnabled || s.minimumStaffing.trim().length > 0
    case 5: return !s.maximumStaffingEnabled || s.maximumStaffing.trim().length > 0
    case 6: return skills.length > 0 && s.requiredSkill.length > 0
    case 7: return true
    case 8: return true
    default: return false
  }
}

// ─── Framer Motion step variants ─────────────────────────────────────────────

const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 28 : -28 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -28 : 28 }),
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ProcessWizardProps {
  open: boolean
  onClose: () => void
  onCreated: (process: ProcessDetailRow) => void
  departments: Department[]
  skills: Skill[]
}

export default function ProcessWizard({ open, onClose, onCreated, departments, skills }: ProcessWizardProps) {
  const [state, setState] = useState<WizardState>(DEFAULTS)
  const [isPending, startTransition] = useTransition()
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Keep refs so callbacks always read fresh values without stale closures
  const stateRef = useRef(state)
  stateRef.current = state
  const deptsRef = useRef(departments)
  deptsRef.current = departments
  const skillsRef = useRef(skills)
  skillsRef.current = skills
  const onCreatedRef = useRef(onCreated)
  onCreatedRef.current = onCreated
  const isPendingRef = useRef(isPending)
  isPendingRef.current = isPending

  const isLastStep = state.currentStep === TOTAL_STEPS - 1
  const canGo = canAdvance(state, departments, skills)

  // Reset after close animation completes
  const handleClose = useCallback(() => {
    onClose()
    setTimeout(() => {
      setState(DEFAULTS)
      setSubmitError(null)
    }, 300)
  }, [onClose])

  const handleFinish = useCallback(() => {
    const s = stateRef.current
    const normUnit = s.normUnit === 'Custom' ? (s.customNormUnit.trim() || null) : (s.normUnit || null)
    const normPerHour = s.outputPerHour ? parseInt(s.outputPerHour, 10) : null
    const minStaff = s.minimumStaffingEnabled && s.minimumStaffing ? parseInt(s.minimumStaffing, 10) : null
    const maxStaff = s.maximumStaffingEnabled && s.maximumStaffing ? parseInt(s.maximumStaffing, 10) : null

    setSubmitError(null)
    startTransition(async () => {
      const result = await createProcessAction({
        name: s.processName,
        departmentId: s.department || null,
        normUnit,
        normPerHour,
        minStaff,
        maxStaff,
        requiredSkillId: s.requiredSkill || null,
        active: s.isActive,
      })
      if (result.ok) {
        onCreatedRef.current(result.process)
        handleClose()
      } else {
        setSubmitError(result.error)
      }
    })
  }, [handleClose])

  const goNext = useCallback(() => {
    const s = stateRef.current
    if (!canAdvance(s, deptsRef.current, skillsRef.current)) return
    if (s.currentStep === TOTAL_STEPS - 1) {
      handleFinish()
      return
    }
    setState(prev => ({ ...prev, direction: 1, currentStep: prev.currentStep + 1 }))
  }, [handleFinish])

  const goBack = useCallback(() => {
    setSubmitError(null)
    setState(prev => {
      if (prev.currentStep === 0) return prev
      return { ...prev, direction: -1, currentStep: prev.currentStep - 1 }
    })
  }, [])

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState(s => ({ ...s, [key]: value }))
  }

  // Keyboard: ESC closes, Enter advances
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (!isPendingRef.current) handleClose()
        return
      }
      if (e.key === 'Enter') {
        const tag = (e.target as HTMLElement).tagName
        // Let native button/select handling happen; we only capture unhandled Enter
        if (tag === 'BUTTON' || tag === 'SELECT') return
        e.preventDefault()
        goNext()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, handleClose, goNext])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={isPending ? undefined : handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          zIndex: 900,
        }}
      />

      {/* Positioning wrapper */}
      <div
        style={{
          position: 'fixed',
          bottom: 120,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 460,
          maxWidth: '90vw',
          zIndex: 910,
        }}
      >
        {/* Shell — entry + idle float from Phase 1 CSS */}
        <div
          className="wizard-shell"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wizard-title"
          style={{
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.7)',
            borderRadius: 20,
            padding: 24,
            boxShadow: '0 20px 80px rgba(0,0,0,0.25)',
          }}
        >
          {/* ── Header ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <div>
              <h2
                id="wizard-title"
                style={{ fontSize: 16, fontWeight: 700, color: '#0B0B0C', margin: 0, lineHeight: 1.3 }}
              >
                Create Process
              </h2>
              <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3, marginBottom: 0 }}>
                Step {state.currentStep + 1} of {TOTAL_STEPS}
              </p>
            </div>

            <button
              onClick={isPending ? undefined : handleClose}
              disabled={isPending}
              aria-label="Close wizard"
              className="ds-icon-btn"
              style={{ flexShrink: 0, marginTop: -2, color: '#6B7280' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* ── Progress bar ── */}
          <div
            style={{
              height: 3,
              borderRadius: 2,
              background: '#E6E8F0',
              marginBottom: 22,
              overflow: 'hidden',
            }}
          >
            <motion.div
              style={{
                height: '100%',
                borderRadius: 2,
                background: 'linear-gradient(90deg, #4F6BFF, #6C83FF)',
                originX: 0,
              }}
              animate={{ width: `${((state.currentStep + 1) / TOTAL_STEPS) * 100}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>

          {/* ── Animated step content ── */}
          {/* overflow:hidden clips the horizontal slide; container grows naturally for tall steps */}
          <div style={{ overflow: 'hidden', minHeight: 210, position: 'relative' }}>
            <AnimatePresence mode="wait" custom={state.direction}>
              <motion.div
                key={state.currentStep}
                custom={state.direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <StepContent step={state.currentStep} state={state} update={update} departments={departments} skills={skills} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Footer ── */}
          <div style={{ marginTop: 20 }}>
            {submitError && (
              <div
                style={{
                  marginBottom: 10,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(220,38,38,0.06)',
                  border: '1px solid rgba(220,38,38,0.18)',
                  fontSize: 12,
                  color: '#DC2626',
                  lineHeight: 1.45,
                }}
              >
                {submitError}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 18,
                borderTop: '1px solid #E6E8F0',
              }}
            >
              {/* Left: Back on steps 2–9, Cancel on step 1 */}
              <div>
                {state.currentStep > 0 ? (
                  <Button variant="ghost" onClick={goBack} disabled={isPending}>← Back</Button>
                ) : (
                  <Button variant="secondary" onClick={handleClose} disabled={isPending}>Cancel</Button>
                )}
              </div>

              {/* Right: Cancel (steps 2–9) + Next / Finish */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {state.currentStep > 0 && (
                  <Button variant="secondary" size="sm" onClick={handleClose} disabled={isPending}>Cancel</Button>
                )}
                <Button
                  variant="primary"
                  onClick={isLastStep ? handleFinish : goNext}
                  disabled={!canGo || isPending}
                >
                  {isLastStep ? (isPending ? 'Saving…' : 'Finish') : 'Next →'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Step content dispatcher ──────────────────────────────────────────────────

interface StepProps {
  state: WizardState
  update: UpdateFn
}

function StepContent({ step, state, update, departments, skills }: {
  step: number
  state: WizardState
  update: UpdateFn
  departments: Department[]
  skills: Skill[]
}) {
  switch (step) {
    case 0: return <StepProcessName state={state} update={update} />
    case 1: return <StepDepartment state={state} update={update} departments={departments} />
    case 2: return <StepNormUnit state={state} update={update} />
    case 3: return <StepOutputPerHour state={state} update={update} />
    case 4: return <StepMinStaffing state={state} update={update} />
    case 5: return <StepMaxStaffing state={state} update={update} />
    case 6: return <StepRequiredSkill state={state} update={update} skills={skills} />
    case 7: return <StepActiveToggle state={state} update={update} />
    case 8: return <StepSummary state={state} departments={departments} skills={skills} />
    default: return null
  }
}

// ─── Shared: Step title ───────────────────────────────────────────────────────

function StepTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 14px 0', lineHeight: 1.45 }}>
      {children}
    </p>
  )
}

// ─── Shared: Segmented control (boolean options) ──────────────────────────────

interface SegControlProps {
  options: { label: string; value: boolean }[]
  value: boolean
  onChange: (v: boolean) => void
}

function SegControl({ options, value, onChange }: SegControlProps) {
  return (
    <div
      style={{
        display: 'flex',
        borderRadius: 10,
        border: '1px solid #E6E8F0',
        background: 'rgba(246,247,251,0.8)',
        padding: 4,
      }}
    >
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.label}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1,
              height: 34,
              borderRadius: 7,
              border: 'none',
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
              transition: 'background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
              background: active ? '#ffffff' : 'transparent',
              color: active ? '#111827' : '#9CA3AF',
              boxShadow: active ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Step 1: Process name ─────────────────────────────────────────────────────

function StepProcessName({ state, update }: StepProps) {
  return (
    <div>
      <StepTitle>What process are we setting up?</StepTitle>
      <input
        autoFocus
        className="ds-input"
        placeholder="e.g. Order Picking, Packing, Putaway"
        value={state.processName}
        onChange={e => update('processName', e.target.value)}
      />
    </div>
  )
}

// ─── Shared: empty state for missing master data ───────────────────────────────────

function NoDataState({ message, hint }: { message: string; hint: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 8,
        padding: '20px 12px',
        borderRadius: 12,
        border: '1.5px dashed #E6E8F0',
        background: 'rgba(246,247,251,0.7)',
      }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: '#9CA3AF', marginBottom: 2 }}>
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9 12h6M12 9v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: 0 }}>{message}</p>
      <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, lineHeight: 1.5 }}>{hint}</p>
    </div>
  )
}

// ─── Step 2: Department ────────────────────────────────────────────────────────────

function StepDepartment({ state, update, departments }: StepProps & { departments: Department[] }) {
  if (departments.length === 0) {
    return (
      <div>
        <StepTitle>Which department does this process belong to?</StepTitle>
        <NoDataState
          message="No departments yet"
          hint="Create at least one department in the Departments tab before setting up a process."
        />
      </div>
    )
  }
  return (
    <div>
      <StepTitle>Which department does this process belong to?</StepTitle>
      <select
        className="ds-select"
        value={state.department}
        onChange={e => update('department', e.target.value)}
        autoFocus
      >
        <option value="">Select department…</option>
        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
    </div>
  )
}

// ─── Step 3: Norm unit ────────────────────────────────────────────────────────

function StepNormUnit({ state, update }: StepProps) {
  return (
    <div>
      <StepTitle>How do we measure productivity?</StepTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {NORM_UNITS.map(unit => {
          const selected = state.normUnit === unit
          return (
            <button
              key={unit}
              type="button"
              onClick={() => {
                update('normUnit', unit)
                if (unit !== 'Custom') update('customNormUnit', '')
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 9,
                border: `1.5px solid ${selected ? '#4F6BFF' : '#E6E8F0'}`,
                background: selected ? 'rgba(79,107,255,0.05)' : 'rgba(255,255,255,0.75)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                color: selected ? '#4F6BFF' : '#374151',
                textAlign: 'left',
                transition: 'border-color 0.14s ease, background 0.14s ease, color 0.14s ease',
              }}
            >
              {/* Custom radio dot */}
              <span
                style={{
                  width: 15,
                  height: 15,
                  borderRadius: '50%',
                  border: `2px solid ${selected ? '#4F6BFF' : '#D1D5DB'}`,
                  background: selected ? '#4F6BFF' : 'transparent',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.14s ease',
                }}
              >
                {selected && (
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', display: 'block' }} />
                )}
              </span>
              {unit}
            </button>
          )
        })}
      </div>
      {state.normUnit === 'Custom' && (
        <div style={{ marginTop: 10 }}>
          <input
            autoFocus
            className="ds-input"
            placeholder="Define unit name…"
            value={state.customNormUnit}
            onChange={e => update('customNormUnit', e.target.value)}
          />
        </div>
      )}
    </div>
  )
}

// ─── Step 4: Output per hour ──────────────────────────────────────────────────

function StepOutputPerHour({ state, update }: StepProps) {
  const unitLabel = state.normUnit === 'Custom'
    ? (state.customNormUnit || 'units')
    : (state.normUnit || 'units')

  return (
    <div>
      <StepTitle>What is the target output per hour?</StepTitle>
      <input
        autoFocus
        className="ds-input"
        placeholder="e.g. 120"
        inputMode="numeric"
        value={state.outputPerHour}
        onChange={e => {
          if (/^\d*$/.test(e.target.value)) update('outputPerHour', e.target.value)
        }}
      />
      {state.outputPerHour && (
        <div
          style={{
            marginTop: 10,
            padding: '8px 12px',
            borderRadius: 8,
            background: 'rgba(79,107,255,0.06)',
            border: '1px solid rgba(79,107,255,0.14)',
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: '#4F6BFF', fontWeight: 500 }}>
            {state.outputPerHour} {unitLabel.toLowerCase()} per hour
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Step 5: Minimum staffing ─────────────────────────────────────────────────

function StepMinStaffing({ state, update }: StepProps) {
  return (
    <div>
      <StepTitle>Does this process require a minimum staffing level?</StepTitle>
      <SegControl
        options={[
          { label: 'No minimum', value: false },
          { label: 'Set minimum', value: true },
        ]}
        value={state.minimumStaffingEnabled}
        onChange={v => update('minimumStaffingEnabled', v)}
      />
      {state.minimumStaffingEnabled && (
        <div style={{ marginTop: 14 }}>
          <input
            autoFocus
            className="ds-input"
            placeholder="Minimum headcount"
            inputMode="numeric"
            value={state.minimumStaffing}
            onChange={e => {
              if (/^\d*$/.test(e.target.value)) update('minimumStaffing', e.target.value)
            }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Step 6: Maximum staffing ─────────────────────────────────────────────────

function StepMaxStaffing({ state, update }: StepProps) {
  return (
    <div>
      <StepTitle>Is there a maximum number of workstations or positions?</StepTitle>
      <SegControl
        options={[
          { label: 'Unlimited', value: false },
          { label: 'Set maximum', value: true },
        ]}
        value={state.maximumStaffingEnabled}
        onChange={v => update('maximumStaffingEnabled', v)}
      />
      {state.maximumStaffingEnabled && (
        <div style={{ marginTop: 14 }}>
          <input
            autoFocus
            className="ds-input"
            placeholder="Maximum headcount"
            inputMode="numeric"
            value={state.maximumStaffing}
            onChange={e => {
              if (/^\d*$/.test(e.target.value)) update('maximumStaffing', e.target.value)
            }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Step 7: Required skill ───────────────────────────────────────────────────

function StepRequiredSkill({ state, update, skills }: StepProps & { skills: Skill[] }) {
  if (skills.length === 0) {
    return (
      <div>
        <StepTitle>Which skill is required for this process?</StepTitle>
        <NoDataState
          message="No skills yet"
          hint="Create at least one skill in the workforce Skills area before assigning it to a process."
        />
      </div>
    )
  }
  return (
    <div>
      <StepTitle>Which skill is required for this process?</StepTitle>
      <select
        className="ds-select"
        value={state.requiredSkill}
        onChange={e => update('requiredSkill', e.target.value)}
        autoFocus
      >
        <option value="">Select skill…</option>
        {skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </div>
  )
}

// ─── Step 8: Active toggle ────────────────────────────────────────────────────

function StepActiveToggle({ state, update }: StepProps) {
  return (
    <div>
      <StepTitle>Should this process be active immediately?</StepTitle>
      <SegControl
        options={[
          { label: 'Active', value: true },
          { label: 'Inactive', value: false },
        ]}
        value={state.isActive}
        onChange={v => update('isActive', v)}
      />
      <p
        style={{
          marginTop: 12,
          marginBottom: 0,
          fontSize: 13,
          color: '#9CA3AF',
          lineHeight: 1.45,
        }}
      >
        {state.isActive
          ? 'This process will be visible and available for planning immediately.'
          : 'This process will be saved as a draft and not shown in planning until activated.'}
      </p>
    </div>
  )
}

// ─── Step 9: Summary ──────────────────────────────────────────────────────────

function StepSummary({ state, departments, skills }: { state: WizardState; departments: Department[]; skills: Skill[] }) {
  const unitLabel = state.normUnit === 'Custom'
    ? (state.customNormUnit || 'units')
    : (state.normUnit || 'units')

  const deptName = (departments.find(d => d.id === state.department)?.name ?? state.department) || '—'
  const skillName = (skills.find(s => s.id === state.requiredSkill)?.name ?? state.requiredSkill) || '—'

  const rows: { label: string; value: string }[] = [
    { label: 'Process name', value: state.processName || '—' },
    { label: 'Department', value: deptName },
    {
      label: 'Productivity',
      value: state.outputPerHour ? `${state.outputPerHour} ${unitLabel.toLowerCase()}/hour` : '—',
    },
    {
      label: 'Minimum staffing',
      value: state.minimumStaffingEnabled ? `Min. ${state.minimumStaffing}` : 'No minimum',
    },
    {
      label: 'Maximum staffing',
      value: state.maximumStaffingEnabled ? `Max. ${state.maximumStaffing}` : 'Unlimited',
    },
    { label: 'Required skill', value: skillName },
    { label: 'Status', value: state.isActive ? 'Active' : 'Inactive' },
  ]

  return (
    <div>
      <StepTitle>Review your process</StepTitle>
      <div style={{ border: '1px solid #E6E8F0', borderRadius: 12, overflow: 'hidden' }}>
        {rows.map((row, i) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 14px',
              borderBottom: i < rows.length - 1 ? '1px solid #F0F1F6' : 'none',
              background: i % 2 === 0 ? 'rgba(246,247,251,0.7)' : '#ffffff',
            }}
          >
            <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>{row.label}</span>
            <span style={{ fontSize: 13, color: '#111827', fontWeight: 600 }}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
