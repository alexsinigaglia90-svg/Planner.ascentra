'use client'

import { useState, useEffect, useCallback, useRef, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import type { Department } from '@/lib/queries/locations'
import type { Skill } from '@/lib/queries/skills'
import { createProcessAction, updateProcessAction, createSkillFromProcessAction } from '@/app/settings/processes/actions'
import type { ProcessDetailRow } from '@/lib/queries/processes'

// --- Types --------------------------------------------------------------------

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

// --- Static data --------------------------------------------------------------

const NORM_UNITS = ['Orderlines', 'Orders', 'Cartons', 'Pallets', 'Roll containers', 'Units', 'Custom']

function stateFromProcess(p: ProcessDetailRow): WizardState {
  const knownUnits = NORM_UNITS.filter((u) => u !== 'Custom')
  const isKnownUnit = p.normUnit !== null && knownUnits.includes(p.normUnit)
  return {
    currentStep: 0,
    direction: 1,
    processName: p.name,
    department: p.departmentId ?? '',
    normUnit: p.normUnit === null ? '' : (isKnownUnit ? p.normUnit : 'Custom'),
    customNormUnit: isKnownUnit ? '' : (p.normUnit ?? ''),
    outputPerHour: p.normPerHour?.toString() ?? '',
    minimumStaffingEnabled: p.minStaff !== null,
    minimumStaffing: p.minStaff?.toString() ?? '',
    maximumStaffingEnabled: p.maxStaff !== null,
    maximumStaffing: p.maxStaff?.toString() ?? '',
    requiredSkill: p.requiredSkillId ?? '',
    isActive: p.active,
  }
}

// --- Per-step validation ------------------------------------------------------

function canAdvance(s: WizardState, departments: Department[], skills: Skill[]): boolean {
  switch (s.currentStep) {
    case 0: return s.processName.trim().length > 0
    case 1: return departments.length > 0 && s.department.length > 0
    case 2: return s.normUnit.length > 0 && (s.normUnit !== 'Custom' || s.customNormUnit.trim().length > 0)
    case 3: return s.outputPerHour.trim().length > 0
    case 4: return !s.minimumStaffingEnabled || s.minimumStaffing.trim().length > 0
    case 5: return !s.maximumStaffingEnabled || s.maximumStaffing.trim().length > 0
    case 6: return true // skill is optional
    case 7: return true
    case 8: return true
    default: return false
  }
}

// --- Framer Motion variants ---------------------------------------------------

const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 24 : -24 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -24 : 24 }),
}

// --- Live preview helpers -----------------------------------------------------

function previewProductivity(s: WizardState): string | null {
  if (!s.outputPerHour) return null
  const unit = s.normUnit === 'Custom' ? (s.customNormUnit || 'units') : (s.normUnit || 'units')
  return `${s.outputPerHour} ${unit.toLowerCase()}/hr`
}

function previewStaffing(s: WizardState): string {
  const min = s.minimumStaffingEnabled && s.minimumStaffing ? `Min ${s.minimumStaffing}` : null
  const max = s.maximumStaffingEnabled && s.maximumStaffing ? `Max ${s.maximumStaffing}` : null
  if (min && max) return `${min} / ${max}`
  if (min) return min
  if (max) return max
  return 'No limits'
}

// --- Live Preview card --------------------------------------------------------

function LivePreview({
  state,
  departments,
  skills,
}: {
  state: WizardState
  departments: Department[]
  skills: Skill[]
}) {
  const deptName = departments.find((d) => d.id === state.department)?.name ?? null
  const skillName = skills.find((s) => s.id === state.requiredSkill)?.name ?? null
  const productivity = previewProductivity(state)
  const staffing = previewStaffing(state)

  const rows: { label: string; value: string | null; placeholder: string }[] = [
    { label: 'Name',         value: state.processName || null, placeholder: 'Not set' },
    { label: 'Department',   value: deptName,                  placeholder: 'Not set' },
    { label: 'Productivity', value: productivity,              placeholder: 'Not set' },
    { label: 'Staffing',     value: staffing === 'No limits' ? null : staffing, placeholder: 'No limits' },
    { label: 'Skill',        value: skillName,                 placeholder: 'Not set' },
  ]

  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid rgba(79,107,255,0.18)',
        background: 'rgba(79,107,255,0.03)',
        padding: '12px 14px',
        marginTop: 16,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#4F6BFF',
          }}
        >
          Preview
        </p>
        {/* Status pill */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 7px',
            borderRadius: 20,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.02em',
            background: state.isActive ? 'rgba(16,185,129,0.1)' : 'rgba(156,163,175,0.12)',
            color: state.isActive ? '#059669' : '#9CA3AF',
            border: state.isActive ? '1px solid rgba(16,185,129,0.22)' : '1px solid rgba(156,163,175,0.2)',
          }}
        >
          <span
            style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: state.isActive ? '#10B981' : '#9CA3AF',
            }}
          />
          {state.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Attribute rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {rows.map((row) => (
          <div key={row.label} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                color: '#9CA3AF',
                fontWeight: 500,
                width: 76,
                flexShrink: 0,
              }}
            >
              {row.label}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: row.value ? 600 : 400,
                color: row.value ? '#111827' : '#D1D5DB',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.value ?? row.placeholder}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Main component -----------------------------------------------------------

interface ProcessWizardProps {
  open: boolean
  onClose: () => void
  onCreated: (process: ProcessDetailRow) => void
  onSaved?: (process: ProcessDetailRow) => void
  process?: ProcessDetailRow
  departments: Department[]
  skills: Skill[]
  onSkillCreated?: (skill: Skill) => void
}

export default function ProcessWizard({ open, onClose, onCreated, onSaved, process, departments, skills, onSkillCreated }: ProcessWizardProps) {
  const isEditMode = process !== undefined
  const [state, setState] = useState<WizardState>(DEFAULTS)
  const [localSkills, setLocalSkills] = useState<Skill[]>(skills)
  const [isPending, startTransition] = useTransition()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const stateRef = useRef(state)
  stateRef.current = state
  const deptsRef = useRef(departments)
  deptsRef.current = departments
  const localSkillsRef = useRef(localSkills)
  localSkillsRef.current = localSkills
  const onCreatedRef = useRef(onCreated)
  onCreatedRef.current = onCreated
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved
  const onSkillCreatedRef = useRef(onSkillCreated)
  onSkillCreatedRef.current = onSkillCreated
  const processRef = useRef(process)
  processRef.current = process
  const isPendingRef = useRef(isPending)
  isPendingRef.current = isPending

  // Re-initialise state each time the wizard opens (or the target process changes)
  useEffect(() => {
    if (open) {
      setState(processRef.current ? stateFromProcess(processRef.current) : DEFAULTS)
      setSubmitError(null)
      setLocalSkills(skills)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const isLastStep = state.currentStep === TOTAL_STEPS - 1
  const canGo = canAdvance(state, departments, localSkills)
  // Show preview from step 1 onwards (once name is entered) — not on summary
  const showPreview = state.currentStep >= 1 && state.currentStep < TOTAL_STEPS - 1

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

    const payload = {
      name: s.processName,
      departmentId: s.department || null,
      normUnit,
      normPerHour,
      minStaff,
      maxStaff,
      requiredSkillId: s.requiredSkill || null,
      active: s.isActive,
    }

    setSubmitError(null)
    startTransition(async () => {
      if (processRef.current) {
        // Edit mode
        const result = await updateProcessAction(processRef.current.id, payload)
        if (result.ok) {
          onSavedRef.current?.(result.process)
          handleClose()
        } else {
          setSubmitError(result.error)
        }
      } else {
        // Create mode
        const result = await createProcessAction(payload)
        if (result.ok) {
          onCreatedRef.current(result.process)
          handleClose()
        } else {
          setSubmitError(result.error)
        }
      }
    })
  }, [handleClose])

  const goNext = useCallback(() => {
    const s = stateRef.current
    if (!canAdvance(s, deptsRef.current, localSkillsRef.current)) return
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

  function handleSkillCreated(skill: Skill) {
    setLocalSkills(prev => [...prev, skill])
    setState(s => ({ ...s, requiredSkill: skill.id }))
    onSkillCreatedRef.current?.(skill)
  }

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (!isPendingRef.current) handleClose()
        return
      }
      if (e.key === 'Enter') {
        const tag = (e.target as HTMLElement).tagName
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

      {/* Positioning wrapper — wider when preview is visible */}
      <div
        style={{
          position: 'fixed',
          bottom: 120,
          left: '50%',
          transform: 'translateX(-50%)',
          width: showPreview ? 520 : 460,
          maxWidth: '92vw',
          zIndex: 910,
          transition: 'width 0.25s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <div
          className="wizard-shell"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wizard-title"
          style={{
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(226,229,237,0.9)',
            borderRadius: 20,
            padding: '22px 24px 24px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.08)',
          }}
        >
          {/* -- Header -- */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <div>
              <h2
                id="wizard-title"
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#0B0B0C',
                  margin: '0 0 2px',
                  lineHeight: 1.3,
                  letterSpacing: '-0.01em',
                }}
              >
                {isEditMode ? 'Edit Process' : 'New Process'}
              </h2>
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
                Step {state.currentStep + 1} of {TOTAL_STEPS}
              </p>
            </div>

            <button
              onClick={isPending ? undefined : handleClose}
              disabled={isPending}
              aria-label="Close wizard"
              className="ds-icon-btn"
              style={{ flexShrink: 0, marginTop: -2, color: '#9CA3AF' }}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* -- Progress bar -- */}
          <div
            style={{
              height: 3,
              borderRadius: 2,
              background: '#EDF0F7',
              marginBottom: 22,
              overflow: 'hidden',
            }}
          >
            <motion.div
              style={{
                height: '100%',
                borderRadius: 2,
                background: 'linear-gradient(90deg, #4F6BFF 0%, #8B9AFF 100%)',
                originX: 0,
              }}
              animate={{ width: `${((state.currentStep + 1) / TOTAL_STEPS) * 100}%` }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />
          </div>

          {/* -- Animated step content -- */}
          <div style={{ overflow: 'hidden', minHeight: 220, position: 'relative' }}>
            <AnimatePresence mode="wait" custom={state.direction}>
              <motion.div
                key={state.currentStep}
                custom={state.direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <StepContent
                  step={state.currentStep}
                  state={state}
                  update={update}
                  departments={departments}
                  skills={localSkills}
                  isEdit={isEditMode}
                  onSkillCreated={handleSkillCreated}
                />
                {/* Live preview — shown for steps 1–7 */}
                {showPreview && (
                  <LivePreview state={state} departments={departments} skills={localSkills} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* -- Footer -- */}
          <div style={{ marginTop: 20 }}>
            {submitError && (
              <div
                style={{
                  marginBottom: 12,
                  padding: '9px 13px',
                  borderRadius: 8,
                  background: 'rgba(220,38,38,0.05)',
                  border: '1px solid rgba(220,38,38,0.15)',
                  fontSize: 12,
                  color: '#DC2626',
                  lineHeight: 1.5,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="8" cy="8" r="7" stroke="#DC2626" strokeWidth="1.4" />
                  <path d="M8 5v3.5M8 10.5v.5" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                {submitError}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 16,
                borderTop: '1px solid #EDF0F7',
              }}
            >
              <div>
                {state.currentStep > 0 ? (
                  <Button variant="ghost" onClick={goBack} disabled={isPending}>
                    ← Back
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={handleClose} disabled={isPending}>
                    Cancel
                  </Button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {state.currentStep > 0 && (
                  <Button variant="secondary" size="sm" onClick={handleClose} disabled={isPending}>
                    Cancel
                  </Button>
                )}
                <Button
                  variant="primary"
                  onClick={isLastStep ? handleFinish : goNext}
                  disabled={!canGo || isPending}
                >
                  {isLastStep
                    ? (isPending ? 'Saving…' : (isEditMode ? 'Save Changes' : 'Create Process'))
                    : "Next →"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// --- Step content dispatcher --------------------------------------------------

function StepContent({
  step,
  state,
  update,
  departments,
  skills,
  isEdit,
  onSkillCreated,
}: {
  step: number
  state: WizardState
  update: UpdateFn
  departments: Department[]
  skills: Skill[]
  isEdit: boolean
  onSkillCreated: (skill: Skill) => void
}) {
  switch (step) {
    case 0: return <StepProcessName state={state} update={update} />
    case 1: return <StepDepartment state={state} update={update} departments={departments} />
    case 2: return <StepNormUnit state={state} update={update} />
    case 3: return <StepOutputPerHour state={state} update={update} />
    case 4: return <StepMinStaffing state={state} update={update} />
    case 5: return <StepMaxStaffing state={state} update={update} />
    case 6: return <StepRequiredSkill state={state} update={update} skills={skills} onSkillCreated={onSkillCreated} />
    case 7: return <StepActiveToggle state={state} update={update} />
    case 8: return <StepSummary state={state} departments={departments} skills={skills} isEdit={isEdit} />
    default: return null
  }
}

// --- Shared: Step title + subtitle -------------------------------------------

function StepTitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 14,
        fontWeight: 600,
        color: '#111827',
        margin: '0 0 4px',
        lineHeight: 1.4,
        letterSpacing: '-0.01em',
      }}
    >
      {children}
    </p>
  )
}

function StepHint({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 14px', lineHeight: 1.5 }}>
      {children}
    </p>
  )
}

// --- Shared: Segmented control ------------------------------------------------

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
        background: '#F7F8FB',
        padding: 3,
        gap: 2,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.label}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1,
              height: 34,
              borderRadius: 8,
              border: 'none',
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
              transition: 'background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
              background: active ? '#ffffff' : 'transparent',
              color: active ? '#111827' : '#9CA3AF',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)' : 'none',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// --- Shared: empty state for missing master data ------------------------------

function NoDataState({ message, hint }: { message: string; hint: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 8,
        padding: '24px 16px',
        borderRadius: 12,
        border: '1.5px dashed #E2E5ED',
        background: 'rgba(246,247,251,0.7)',
      }}
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style={{ color: '#C9CDDA', marginBottom: 2 }}
      >
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9 12h6M12 9v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: 0 }}>{message}</p>
      <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, lineHeight: 1.55 }}>{hint}</p>
    </div>
  )
}

// --- Step 1: Process name -----------------------------------------------------

function StepProcessName({ state, update }: { state: WizardState; update: UpdateFn }) {
  return (
    <div>
      <StepTitle>What is the name of this process?</StepTitle>
      <StepHint>Use a clear, recognisable name used by your team &mdash; e.g. &ldquo;Order Picking&rdquo; or &ldquo;Putaway&rdquo;.</StepHint>
      <input
        autoFocus
        className="ds-input"
        placeholder="e.g. Order Picking, Packing, Putaway"
        value={state.processName}
        onChange={(e) => update('processName', e.target.value)}
      />
    </div>
  )
}

// --- Step 2: Department -------------------------------------------------------

function StepDepartment({ state, update, departments }: { state: WizardState; update: UpdateFn; departments: Department[] }) {
  if (departments.length === 0) {
    return (
      <div>
        <StepTitle>Which department runs this process?</StepTitle>
        <StepHint>This links the process to a department for planning and reporting.</StepHint>
        <NoDataState
          message="No departments yet"
          hint="Create at least one department first under Departments in the sidebar."
        />
      </div>
    )
  }
  return (
    <div>
      <StepTitle>Which department runs this process?</StepTitle>
      <StepHint>Tap to select — this links the process to a department.</StepHint>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, maxHeight: 240, overflowY: 'auto', paddingRight: 2 }}>
        {departments.map((d) => {
          const selected = state.department === d.id
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => update('department', d.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                border: `2px solid ${selected ? '#4F6BFF' : '#E6E8F0'}`,
                background: selected ? 'rgba(79,107,255,0.07)' : 'rgba(255,255,255,0.9)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.14s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <span style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: selected ? 'rgba(79,107,255,0.15)' : '#F3F4F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
                flexShrink: 0,
                transition: 'background 0.14s ease',
              }}>🏢</span>
              <span style={{
                fontSize: 13,
                fontWeight: selected ? 600 : 500,
                color: selected ? '#3451E8' : '#374151',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}>{d.name}</span>
              {selected && (
                <span style={{
                  position: 'absolute',
                  top: 6,
                  right: 7,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: '#4F6BFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// --- Step 3: Norm unit --------------------------------------------------------

function StepNormUnit({ state, update }: { state: WizardState; update: UpdateFn }) {
  return (
    <div>
      <StepTitle>What unit measures output for this process?</StepTitle>
      <StepHint>This determines how productivity norms are tracked and reported.</StepHint>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 220, overflowY: 'auto' }}>
        {NORM_UNITS.map((unit) => {
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
                padding: '9px 12px',
                borderRadius: 9,
                border: `1.5px solid ${selected ? '#4F6BFF' : '#E6E8F0'}`,
                background: selected ? 'rgba(79,107,255,0.06)' : 'rgba(255,255,255,0.8)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: selected ? 600 : 500,
                color: selected ? '#3451E8' : '#374151',
                textAlign: 'left',
                transition: 'border-color 0.12s ease, background 0.12s ease, color 0.12s ease',
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: `2px solid ${selected ? '#4F6BFF' : '#D1D5DB'}`,
                  background: selected ? '#4F6BFF' : 'transparent',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.12s ease',
                }}
              >
                {selected && (
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: '#fff',
                    }}
                  />
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
            placeholder="Define your unit name..."
            value={state.customNormUnit}
            onChange={(e) => update('customNormUnit', e.target.value)}
          />
        </div>
      )}
    </div>
  )
}

// --- Step 4: Output per hour --------------------------------------------------

function StepOutputPerHour({ state, update }: { state: WizardState; update: UpdateFn }) {
  const unitLabel =
    state.normUnit === 'Custom' ? (state.customNormUnit || 'units') : (state.normUnit || 'units')

  return (
    <div>
      <StepTitle>What is the target output per hour?</StepTitle>
      <StepHint>
        Enter the expected number of <strong style={{ color: '#374151' }}>{unitLabel.toLowerCase()}</strong> a trained employee can process in one hour.
      </StepHint>
      <div style={{ position: 'relative' }}>
        <input
          autoFocus
          className="ds-input"
          placeholder="e.g. 120"
          inputMode="numeric"
          value={state.outputPerHour}
          style={{ paddingRight: 84 }}
          onChange={(e) => {
            if (/^\d*$/.test(e.target.value)) update('outputPerHour', e.target.value)
          }}
        />
        <span
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 12,
            color: '#9CA3AF',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {unitLabel.toLowerCase()}/hr
        </span>
      </div>
      {state.outputPerHour && (
        <div
          style={{
            marginTop: 10,
            padding: '8px 12px',
            borderRadius: 8,
            background: 'rgba(79,107,255,0.05)',
            border: '1px solid rgba(79,107,255,0.12)',
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

// --- Step 5: Minimum staffing -------------------------------------------------

function StepMinStaffing({ state, update }: { state: WizardState; update: UpdateFn }) {
  return (
    <div>
      <StepTitle>Is there a minimum number of people required?</StepTitle>
      <StepHint>A minimum ensures the planner always assigns at least this many people to the process.</StepHint>
      <SegControl
        options={[
          { label: 'No minimum', value: false },
          { label: 'Set minimum', value: true },
        ]}
        value={state.minimumStaffingEnabled}
        onChange={(v) => update('minimumStaffingEnabled', v)}
      />
      {state.minimumStaffingEnabled && (
        <div style={{ marginTop: 14 }}>
          <input
            autoFocus
            className="ds-input"
            placeholder="Minimum headcount (e.g. 2)"
            inputMode="numeric"
            value={state.minimumStaffing}
            onChange={(e) => {
              if (/^\d*$/.test(e.target.value)) update('minimumStaffing', e.target.value)
            }}
          />
        </div>
      )}
    </div>
  )
}

// --- Step 6: Maximum staffing -------------------------------------------------

function StepMaxStaffing({ state, update }: { state: WizardState; update: UpdateFn }) {
  return (
    <div>
      <StepTitle>Is there a maximum capacity for this process?</StepTitle>
      <StepHint>Set this if the process has a fixed number of workstations or positions available.</StepHint>
      <SegControl
        options={[
          { label: 'Unlimited', value: false },
          { label: 'Set maximum', value: true },
        ]}
        value={state.maximumStaffingEnabled}
        onChange={(v) => update('maximumStaffingEnabled', v)}
      />
      {state.maximumStaffingEnabled && (
        <div style={{ marginTop: 14 }}>
          <input
            autoFocus
            className="ds-input"
            placeholder="Maximum headcount (e.g. 8)"
            inputMode="numeric"
            value={state.maximumStaffing}
            onChange={(e) => {
              if (/^\d*$/.test(e.target.value)) update('maximumStaffing', e.target.value)
            }}
          />
        </div>
      )}
    </div>
  )
}

// --- Step 7: Required skill ---------------------------------------------------

function StepRequiredSkill({ state, update, skills, onSkillCreated }: {
  state: WizardState
  update: UpdateFn
  skills: Skill[]
  onSkillCreated: (skill: Skill) => void
}) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [createPending, startCreate] = useTransition()
  const [createError, setCreateError] = useState<string | null>(null)

  function handleCreate() {
    const name = newName.trim()
    if (!name) return
    setCreateError(null)
    startCreate(async () => {
      const res = await createSkillFromProcessAction(name)
      if (res.ok) {
        onSkillCreated(res.skill as Skill)
        setCreating(false)
        setNewName('')
      } else {
        setCreateError(res.error)
      }
    })
  }

  const SKILL_ICONS = ['🎯', '⚡', '🔧', '📦', '🚀', '💡', '🛠️', '🔑', '🏆', '⚙️']

  return (
    <div>
      <StepTitle>Which skill is required to work this process?</StepTitle>
      <StepHint>Optional — the planner uses this to verify employees are qualified.</StepHint>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 230, overflowY: 'auto', paddingRight: 2 }}>

        {/* None option */}
        <button
          type="button"
          onClick={() => update('requiredSkill', '')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 13px',
            borderRadius: 9,
            border: `1.5px solid ${state.requiredSkill === '' ? '#4F6BFF' : '#E6E8F0'}`,
            background: state.requiredSkill === '' ? 'rgba(79,107,255,0.06)' : 'rgba(250,250,252,0.9)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.12s ease',
          }}
        >
          <span style={{
            width: 28, height: 28, borderRadius: 7,
            background: state.requiredSkill === '' ? 'rgba(79,107,255,0.14)' : '#F3F4F6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, flexShrink: 0,
          }}>✦</span>
          <span style={{ fontSize: 13, fontWeight: state.requiredSkill === '' ? 600 : 400, color: state.requiredSkill === '' ? '#3451E8' : '#6B7280' }}>
            No skill required
          </span>
        </button>

        {/* Existing skills */}
        {skills.map((s, i) => {
          const selected = state.requiredSkill === s.id
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => update('requiredSkill', s.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 13px',
                borderRadius: 9,
                border: `1.5px solid ${selected ? '#4F6BFF' : '#E6E8F0'}`,
                background: selected ? 'rgba(79,107,255,0.06)' : 'rgba(255,255,255,0.9)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.12s ease',
              }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: 7,
                background: selected ? 'rgba(79,107,255,0.14)' : '#F3F4F6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, flexShrink: 0,
              }}>{SKILL_ICONS[i % SKILL_ICONS.length]}</span>
              <span style={{ fontSize: 13, fontWeight: selected ? 600 : 500, color: selected ? '#3451E8' : '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.name}
              </span>
              {selected && (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <circle cx="8" cy="8" r="7" fill="#4F6BFF" />
                  <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          )
        })}

        {/* Inline create form */}
        {!creating ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 13px', borderRadius: 9,
              border: '1.5px dashed #D1D5DB', background: 'transparent',
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s ease',
            }}
          >
            <span style={{
              width: 28, height: 28, borderRadius: 7, background: '#F3F4F6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0, color: '#6B7280',
            }}>+</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#6B7280' }}>Create new skill</span>
          </button>
        ) : (
          <div style={{
            padding: '10px 12px', borderRadius: 9,
            border: '1.5px solid #4F6BFF',
            background: 'rgba(79,107,255,0.04)',
          }}>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleCreate() }
                if (e.key === 'Escape') { setCreating(false); setNewName('') }
              }}
              placeholder="Skill name, e.g. Forklift certified..."
              style={{
                width: '100%', border: 'none', outline: 'none',
                background: 'transparent', fontSize: 13, color: '#111827',
                fontWeight: 500, marginBottom: 8,
              }}
            />
            {createError && <p style={{ margin: '0 0 6px', fontSize: 11, color: '#DC2626' }}>{createError}</p>}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newName.trim() || createPending}
                style={{
                  flex: 1, padding: '6px 10px', borderRadius: 7, border: 'none',
                  background: !newName.trim() || createPending ? '#E6E8F0' : '#4F6BFF',
                  color: !newName.trim() || createPending ? '#9CA3AF' : '#fff',
                  fontSize: 12, fontWeight: 600,
                  cursor: !newName.trim() || createPending ? 'not-allowed' : 'pointer',
                  transition: 'all 0.14s ease',
                }}
              >
                {createPending ? 'Creating...' : '✓ Create skill'}
              </button>
              <button
                type="button"
                onClick={() => { setCreating(false); setNewName('') }}
                style={{
                  padding: '6px 10px', borderRadius: 7,
                  border: '1px solid #E6E8F0', background: '#fff',
                  color: '#6B7280', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                }}
              >Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Step 8: Active toggle ----------------------------------------------------

function StepActiveToggle({ state, update }: { state: WizardState; update: UpdateFn }) {
  return (
    <div>
      <StepTitle>Should this process be available immediately?</StepTitle>
      <StepHint>Inactive processes are saved as drafts and hidden from the planner until activated.</StepHint>
      <SegControl
        options={[
          { label: 'Active', value: true },
          { label: 'Inactive (draft)', value: false },
        ]}
        value={state.isActive}
        onChange={(v) => update('isActive', v)}
      />
      <div
        style={{
          marginTop: 12,
          padding: '10px 13px',
          borderRadius: 8,
          background: state.isActive ? 'rgba(16,185,129,0.05)' : 'rgba(156,163,175,0.08)',
          border: state.isActive ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(156,163,175,0.18)',
          transition: 'background 0.2s ease, border-color 0.2s ease',
        }}
      >
        <p style={{ margin: 0, fontSize: 12, color: state.isActive ? '#065F46' : '#6B7280', lineHeight: 1.5 }}>
          {state.isActive
            ? 'This process will be visible in the planner and available for shift assignments immediately.'
            : 'This process will be saved as a draft. You can activate it later from the Processes page.'}
        </p>
      </div>
    </div>
  )
}

// --- Step 9: Summary ----------------------------------------------------------

function StepSummary({
  state,
  departments,
  skills,
  isEdit,
}: {
  state: WizardState
  departments: Department[]
  skills: Skill[]
  isEdit: boolean
}) {
  const unitLabel =
    state.normUnit === 'Custom' ? (state.customNormUnit || 'units') : (state.normUnit || 'units')

  const deptName = (departments.find((d) => d.id === state.department)?.name) || null
  const skillName = (skills.find((s) => s.id === state.requiredSkill)?.name) || null

  const productivity = state.outputPerHour
    ? `${state.outputPerHour} ${unitLabel.toLowerCase()}/hr`
    : null

  const staffingMin = state.minimumStaffingEnabled && state.minimumStaffing
    ? state.minimumStaffing
    : null
  const staffingMax = state.maximumStaffingEnabled && state.maximumStaffing
    ? state.maximumStaffing
    : null

  return (
    <div>
      <StepTitle>{isEdit ? 'Review before saving' : 'Review before creating'}</StepTitle>
      <StepHint>Double-check the details below. You can go back to change anything.</StepHint>

      {/* Main summary card */}
      <div
        style={{
          borderRadius: 12,
          border: '1px solid #E6E8F0',
          overflow: 'hidden',
          background: '#ffffff',
        }}
      >
        {/* Process name header */}
        <div
          style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg,rgba(79,107,255,0.06) 0%,rgba(108,131,255,0.03) 100%)',
            borderBottom: '1px solid #EDF0F7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <p
              style={{
                margin: '0 0 1px',
                fontSize: 15,
                fontWeight: 700,
                color: '#0B0B0C',
                letterSpacing: '-0.015em',
              }}
            >
              {state.processName || 'Unnamed Process'}
            </p>
            {deptName && (
              <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>{deptName}</p>
            )}
          </div>
          {/* Status badge */}
          <span
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 9px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.02em',
              background: state.isActive ? 'rgba(16,185,129,0.1)' : 'rgba(156,163,175,0.12)',
              color: state.isActive ? '#059669' : '#6B7280',
              border: state.isActive ? '1px solid rgba(16,185,129,0.22)' : '1px solid rgba(156,163,175,0.22)',
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: state.isActive ? '#10B981' : '#9CA3AF',
              }}
            />
            {state.isActive ? 'Active' : 'Draft'}
          </span>
        </div>

        {/* Detail rows */}
        <div>
          {[
            {
              label: 'Productivity',
              value: productivity,
              empty: 'Not set',
            },
            {
              label: 'Min. staff',
              value: staffingMin ? `${staffingMin} people minimum` : null,
              empty: 'No minimum',
            },
            {
              label: 'Max. staff',
              value: staffingMax ? `${staffingMax} positions maximum` : null,
              empty: 'Unlimited',
            },
            {
              label: 'Required skill',
              value: skillName,
              empty: 'None required',
            },
          ].map((row, i, arr) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderBottom: i < arr.length - 1 ? '1px solid #F3F4F8' : 'none',
                background: i % 2 === 0 ? 'rgba(246,247,251,0.5)' : '#ffffff',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, flexShrink: 0 }}>
                {row.label}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: row.value ? 600 : 400,
                  color: row.value ? '#111827' : '#C4C8D4',
                  textAlign: 'right',
                }}
              >
                {row.value ?? row.empty}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
