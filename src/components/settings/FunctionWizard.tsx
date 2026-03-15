'use client'

import { useState, useEffect, useRef, useTransition, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Users, Calculator,
  // Dynamic icon rendering — must match ICON_POOL in /api/ai/function-assist
  Wrench, Hammer, HardHat, Truck, Forklift, Package, PackageCheck,
  ClipboardList, ClipboardCheck, ShieldCheck, Shield, Crown, Star,
  UserCog, UserCheck, HeadsetIcon, Headphones, Phone,
  Monitor, Laptop, Printer, ScanLine, Barcode, QrCode,
  Gauge, Activity, TrendingUp, BarChart3, PieChart,
  FileText, FolderOpen, Archive, Database, Server, Wifi,
  Zap, Lightbulb, Settings, Cog, SlidersHorizontal,
  Thermometer, Droplets, Flame, Wind, Snowflake,
  Eye, Search, Microscope, FlaskConical, TestTube2, Beaker,
  Stethoscope, Heart, Pill, Syringe, Ambulance,
  GraduationCap, BookOpen, Presentation, School,
  Paintbrush, Palette, Scissors, Ruler, PenTool,
  Navigation, Map, Compass, Globe, Building2,
  Coffee, UtensilsCrossed, ChefHat, Soup,
  Anchor, Plane, Train, Car, Bike,
  Box, Boxes, Container, Weight, Dumbbell,
  Lock, Key, Fingerprint, BadgeCheck, Award,
  Megaphone, Radio, Mic, Camera, Video,
  Clock, Timer, Calendar, AlarmClock,
  Wand2, Target, Crosshair, Focus,
  Plug, Battery, Power, Cable, CircuitBoard,
  Leaf, TreePine, Recycle, Trash2,
  HandMetal, ThumbsUp, Smile, Bot, BrainCircuit,
  type LucideIcon,
} from 'lucide-react'
import type { EmployeeFunction } from '@/lib/queries/functions'
import { createFunctionMdAction, updateFunctionMdAction } from '@/app/settings/masterdata/actions'

// ── Types ────────────────────────────────────────────────────────────────────

interface WizardState {
  currentStep: number
  direction: 1 | -1
  functionName: string
  overhead: boolean
}

interface AiSuggestion {
  icon: string
  tagline: string
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

// ── AI hook ──────────────────────────────────────────────────────────────────

function useAiSuggestion(functionName: string) {
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const lastFetched = useRef('')

  const fetchSuggestion = useCallback(async (name: string) => {
    const trimmed = name.trim()
    if (trimmed.length < 2 || trimmed === lastFetched.current) return

    // Abort previous request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    try {
      const res = await fetch('/api/ai/function-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ functionName: trimmed }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      if (!controller.signal.aborted) {
        setSuggestion(data)
        lastFetched.current = trimmed
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      // Silently fail — AI is optional
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  // Debounced trigger
  useEffect(() => {
    const trimmed = functionName.trim()
    if (trimmed.length < 2) {
      setSuggestion(null)
      return
    }
    const timer = setTimeout(() => fetchSuggestion(trimmed), 600)
    return () => clearTimeout(timer)
  }, [functionName, fetchSuggestion])

  return { suggestion, loading }
}

// ── Dynamic icon renderer ────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles, Wrench, Hammer, HardHat, Truck, Forklift, Package, PackageCheck,
  ClipboardList, ClipboardCheck, ShieldCheck, Shield, Crown, Star,
  Users, UserCog, UserCheck, HeadsetIcon, Headphones, Phone,
  Monitor, Laptop, Printer, ScanLine, Barcode, QrCode,
  Gauge, Activity, TrendingUp, BarChart3, PieChart, Calculator,
  FileText, FolderOpen, Archive, Database, Server, Wifi,
  Zap, Lightbulb, Settings, Cog, SlidersHorizontal,
  Thermometer, Droplets, Flame, Wind, Snowflake,
  Eye, Search, Microscope, FlaskConical, TestTube2, Beaker,
  Stethoscope, Heart, Pill, Syringe, Ambulance,
  GraduationCap, BookOpen, Presentation, School,
  Paintbrush, Palette, Scissors, Ruler, PenTool,
  Navigation, Map, Compass, Globe, Building2,
  Coffee, UtensilsCrossed, ChefHat, Soup,
  Anchor, Plane, Train, Car, Bike,
  Box, Boxes, Container, Weight, Dumbbell,
  Lock, Key, Fingerprint, BadgeCheck, Award,
  Megaphone, Radio, Mic, Camera, Video,
  Clock, Timer, Calendar, AlarmClock,
  Wand2, Target, Crosshair, Focus,
  Plug, Battery, Power, Cable, CircuitBoard,
  Leaf, TreePine, Recycle, Trash2,
  HandMetal, ThumbsUp, Smile, Bot, BrainCircuit,
}

function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? Sparkles
  return <Icon className={className} />
}

// ── Step components ──────────────────────────────────────────────────────────

function StepName({
  value,
  onChange,
  suggestion,
  aiLoading,
}: {
  value: string
  onChange: (v: string) => void
  suggestion: AiSuggestion | null
  aiLoading: boolean
}) {
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

      {/* AI suggestion preview */}
      <AnimatePresence mode="wait">
        {aiLoading && value.trim().length >= 2 && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-4 flex items-center gap-3 rounded-xl bg-gradient-to-r from-indigo-50/80 to-violet-50/60 border border-indigo-100/60 px-4 py-3"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center animate-pulse">
              <Sparkles className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex-1">
              <div className="h-3 w-24 bg-indigo-100 rounded animate-pulse" />
              <div className="h-2.5 w-40 bg-indigo-50 rounded animate-pulse mt-1.5" />
            </div>
          </motion.div>
        )}

        {!aiLoading && suggestion && (
          <motion.div
            key="suggestion"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="mt-4 flex items-center gap-3 rounded-xl bg-gradient-to-r from-indigo-50/80 to-violet-50/60 border border-indigo-100/60 px-4 py-3"
          >
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.1 }}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-[0_2px_8px_rgba(99,102,241,0.3)]"
            >
              <DynamicIcon name={suggestion.icon} className="w-4.5 h-4.5 text-white" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">AI Suggestion</span>
              </div>
              {suggestion.tagline && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-[13px] text-gray-600 mt-0.5 leading-snug italic"
                >
                  &ldquo;{suggestion.tagline}&rdquo;
                </motion.p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
            <Users className="w-5 h-5 text-blue-600" />
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
            <Calculator className="w-5 h-5 text-amber-600" />
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

function StepSummary({
  name,
  overhead,
  suggestion,
}: {
  name: string
  overhead: boolean
  suggestion: AiSuggestion | null
}) {
  const iconName = suggestion?.icon ?? (overhead ? 'Calculator' : 'Users')
  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0B0B0C', margin: '0 0 4px' }}>
        Review & confirm
      </h3>
      <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 16px' }}>
        Everything look good? Hit create to add this function.
      </p>
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50/80 p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
      >
        <div className="flex items-center gap-4">
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22, delay: 0.15 }}
            className={[
              'flex items-center justify-center w-12 h-12 rounded-2xl shadow-sm',
              overhead
                ? 'bg-gradient-to-br from-amber-400 to-amber-500'
                : 'bg-gradient-to-br from-blue-500 to-indigo-500',
            ].join(' ')}
          >
            <DynamicIcon name={iconName} className="w-6 h-6 text-white" />
          </motion.div>
          <div>
            <p className="text-[16px] font-bold text-gray-900">{name || 'Untitled'}</p>
            <span className={[
              'inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold mt-0.5',
              overhead ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700',
            ].join(' ')}>
              {overhead ? 'Overhead' : 'Direct Labour'}
            </span>
          </div>
        </div>

        {/* AI tagline */}
        {suggestion?.tagline && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-4 pt-3.5 border-t border-gray-100"
          >
            <div className="flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
              <p className="text-[13px] text-gray-500 italic leading-relaxed">
                &ldquo;{suggestion.tagline}&rdquo;
              </p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}

// ── Main wizard ──────────────────────────────────────────────────────────────

export default function FunctionWizard({ open, onClose, onCreated, onUpdated, editingFn }: Props) {
  const isEditMode = !!editingFn
  const [state, setState] = useState<WizardState>(DEFAULTS)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // AI suggestion (debounced)
  const { suggestion, loading: aiLoading } = useAiSuggestion(
    open ? state.functionName : ''
  )

  // Reset state when dialog opens
  const prevOpenRef = useRef(false)
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      if (editingFn) {
        setState({ ...DEFAULTS, functionName: editingFn.name, overhead: editingFn.overhead })
      } else {
        setState(DEFAULTS)
      }
      setError(null)
    }
    prevOpenRef.current = open
  }, [open, editingFn])

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
          <div className="min-h-[220px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={state.currentStep}
                initial={{ opacity: 0, x: state.direction * 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: state.direction * -30 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                {state.currentStep === 0 && (
                  <StepName
                    value={state.functionName}
                    onChange={(v) => update('functionName', v)}
                    suggestion={suggestion}
                    aiLoading={aiLoading}
                  />
                )}
                {state.currentStep === 1 && (
                  <StepType overhead={state.overhead} onChange={(v) => update('overhead', v)} />
                )}
                {state.currentStep === 2 && (
                  <StepSummary
                    name={state.functionName}
                    overhead={state.overhead}
                    suggestion={suggestion}
                  />
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
