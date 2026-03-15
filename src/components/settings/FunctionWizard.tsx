'use client'

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { EmployeeFunction } from '@/lib/queries/functions'
import { createFunctionMdAction, updateFunctionMdAction } from '@/app/settings/masterdata/actions'

// ── Types ────────────────────────────────────────────────────────────────────

interface WizardState {
  currentStep: number
  direction: 1 | -1
  functionName: string
  overhead: boolean
}

const DEFAULTS: WizardState = {
  currentStep: 0,
  direction: 1,
  functionName: '',
  overhead: false,
}

const TOTAL_STEPS = 3

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (fn: EmployeeFunction) => void
  onUpdated?: (fn: EmployeeFunction) => void
  editingFn?: EmployeeFunction | null
}

// ── Step components ──────────────────────────────────────────────────────────

function StepName({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0B0B0C', margin: '0 0 4px' }}>
        What is the function called?
      </h3>
      <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 16px' }}>
        This is the job title or role employees will be assigned to.
      </p>
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Operator, Teamleader, Forklift driver"
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/30 focus:border-[#4F6BFF]/50 transition-[border-color,box-shadow]"
      />
    </div>
  )
}

function StepType({ overhead, onChange }: { overhead: boolean; onChange: (v: boolean) => void }) {
  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0B0B0C', margin: '0 0 4px' }}>
        What type of function is this?
      </h3>
      <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 16px' }}>
        This determines how the function is counted in workforce reports.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {/* Direct labour card */}
        <button
          type="button"
          onClick={() => onChange(false)}
          className={[
            'relative rounded-2xl border-2 p-5 text-left transition-all duration-200 cursor-pointer group',
            !overhead
              ? 'border-blue-400 bg-blue-50/60 shadow-[0_0_0_3px_rgba(79,107,255,0.12)]'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50',
          ].join(' ')}
        >
          {!overhead && (
            <div className="absolute top-3 right-3">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="9" fill="#4F6BFF" />
                <path d="M6 10.5l2.5 2.5L14 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 mb-3">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-gray-900 mb-1">Direct Labour</p>
          <p className="text-[12px] text-gray-500 leading-relaxed">
            Counted in staffing calculations and direct workforce capacity.
          </p>
        </button>

        {/* Overhead card */}
        <button
          type="button"
          onClick={() => onChange(true)}
          className={[
            'relative rounded-2xl border-2 p-5 text-left transition-all duration-200 cursor-pointer group',
            overhead
              ? 'border-amber-400 bg-amber-50/60 shadow-[0_0_0_3px_rgba(245,158,11,0.12)]'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50',
          ].join(' ')}
        >
          {overhead && (
            <div className="absolute top-3 right-3">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="9" fill="#F59E0B" />
                <path d="M6 10.5l2.5 2.5L14 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 mb-3">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-gray-900 mb-1">Overhead</p>
          <p className="text-[12px] text-gray-500 leading-relaxed">
            Excluded from direct labour counts. Used for support roles.
          </p>
        </button>
      </div>
    </div>
  )
}

function StepSummary({ name, overhead }: { name: string; overhead: boolean }) {
  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0B0B0C', margin: '0 0 4px' }}>
        Review & confirm
      </h3>
      <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 16px' }}>
        Everything look good? Hit create to add this function.
      </p>
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50/80 p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3">
          <div className={[
            'flex items-center justify-center w-10 h-10 rounded-xl',
            overhead ? 'bg-amber-100' : 'bg-blue-100',
          ].join(' ')}>
            {overhead ? (
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </div>
          <div>
            <p className="text-[15px] font-bold text-gray-900">{name || 'Untitled'}</p>
            <span className={[
              'inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold mt-0.5',
              overhead ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700',
            ].join(' ')}>
              {overhead ? 'Overhead' : 'Direct Labour'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main wizard ──────────────────────────────────────────────────────────────

export default function FunctionWizard({ open, onClose, onCreated, onUpdated, editingFn }: Props) {
  const isEditMode = !!editingFn
  const [state, setState] = useState<WizardState>(() =>
    editingFn
      ? { ...DEFAULTS, functionName: editingFn.name, overhead: editingFn.overhead }
      : DEFAULTS
  )
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Reset when opening
  const prevOpen = useState(open)[0]
  if (open && !prevOpen) {
    // handled by useEffect below
  }

  // Reset state when dialog opens/closes or editingFn changes
  useState(() => {
    if (!open) return
    if (editingFn) {
      setState({ ...DEFAULTS, functionName: editingFn.name, overhead: editingFn.overhead })
    } else {
      setState(DEFAULTS)
    }
  })

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((s) => ({ ...s, [key]: value }))
  }

  function canAdvance(): boolean {
    if (state.currentStep === 0) return state.functionName.trim().length > 0
    return true
  }

  function goNext() {
    if (state.currentStep < TOTAL_STEPS - 1 && canAdvance()) {
      setState((s) => ({ ...s, currentStep: s.currentStep + 1, direction: 1 }))
    }
  }

  function goBack() {
    if (state.currentStep > 0) {
      setState((s) => ({ ...s, currentStep: s.currentStep - 1, direction: -1 }))
    }
  }

  function handleClose() {
    if (!isPending) {
      setState(DEFAULTS)
      setError(null)
      onClose()
    }
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      if (isEditMode && editingFn) {
        const res = await updateFunctionMdAction(editingFn.id, {
          name: state.functionName.trim(),
          overhead: state.overhead,
        })
        if (!res.ok) { setError(res.error); return }
        onUpdated?.({ ...editingFn, name: state.functionName.trim(), overhead: state.overhead })
      } else {
        const res = await createFunctionMdAction(state.functionName.trim(), state.overhead)
        if (!res.ok) { setError(res.error); return }
        onCreated({
          id: res.id,
          name: res.name,
          overhead: res.overhead,
          organizationId: '',
          archived: false,
        } as EmployeeFunction)
      }
      handleClose()
    })
  }

  const isLastStep = state.currentStep === TOTAL_STEPS - 1
  const progress = ((state.currentStep + 1) / TOTAL_STEPS) * 100

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

      {/* Dialog */}
      <div
        style={{
          position: 'fixed',
          bottom: 140,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 460,
          maxWidth: '92vw',
          zIndex: 910,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="fn-wizard-title"
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
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2
                id="fn-wizard-title"
                className="text-[15px] font-bold text-[#0B0B0C] leading-tight tracking-[-0.01em] mb-0.5"
              >
                {isEditMode ? 'Edit Function' : 'New Function'}
              </h2>
              <p className="text-[12px] text-[#9CA3AF]">
                Step {state.currentStep + 1} of {TOTAL_STEPS}
              </p>
            </div>
            <button
              onClick={isPending ? undefined : handleClose}
              disabled={isPending}
              aria-label="Close wizard"
              className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-[3px] rounded-sm bg-[#EDF0F7] mb-5">
            <motion.div
              className="h-full rounded-sm"
              style={{ background: 'linear-gradient(90deg, #4F6BFF, #6C83FF)' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>

          {/* Step content */}
          <div className="min-h-[200px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={state.currentStep}
                initial={{ opacity: 0, x: state.direction * 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: state.direction * -30 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                {state.currentStep === 0 && (
                  <StepName value={state.functionName} onChange={(v) => update('functionName', v)} />
                )}
                {state.currentStep === 1 && (
                  <StepType overhead={state.overhead} onChange={(v) => update('overhead', v)} />
                )}
                {state.currentStep === 2 && (
                  <StepSummary name={state.functionName} overhead={state.overhead} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-600 mt-2">{error}</p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
            <div>
              {state.currentStep > 0 ? (
                <button
                  onClick={goBack}
                  disabled={isPending}
                  className="text-[13px] font-medium text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-40"
                >
                  Back
                </button>
              ) : (
                <button
                  onClick={handleClose}
                  disabled={isPending}
                  className="text-[13px] font-medium text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
              )}
            </div>
            <button
              onClick={isLastStep ? handleSubmit : goNext}
              disabled={!canAdvance() || isPending}
              className={[
                'inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[13px] font-semibold transition-all duration-200 disabled:opacity-50',
                isLastStep
                  ? 'bg-gradient-to-r from-[#4F6BFF] to-[#6C83FF] text-white shadow-[0_4px_14px_rgba(79,107,255,0.35)] hover:shadow-[0_6px_20px_rgba(79,107,255,0.45)] hover:-translate-y-0.5'
                  : 'bg-gray-900 text-white hover:bg-gray-700',
              ].join(' ')}
            >
              {isPending ? (
                'Saving...'
              ) : isLastStep ? (
                <>{isEditMode ? 'Save Changes' : 'Create Function'}</>
              ) : (
                <>
                  Next
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M4.5 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </>
  )
}
