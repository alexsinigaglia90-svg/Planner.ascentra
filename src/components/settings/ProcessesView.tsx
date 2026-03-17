'use client'

import { useState, useRef, useEffect, useTransition, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ProcessWizard from '@/components/settings/ProcessWizard'
import { deleteProcessAction, updateProcessAction } from '@/app/settings/processes/actions'
import type { DepartmentWithChildren, Department } from '@/lib/queries/locations'
import type { Skill } from '@/lib/queries/skills'
import type { ProcessDetailRow } from '@/lib/queries/processes'
import WarehouseFlowDiagram, { matchZone, ZONES, type Zone } from './WarehouseFlowDiagram'

interface Props {
  initialProcesses: ProcessDetailRow[]
  departmentTree: DepartmentWithChildren[]
  skills: Skill[]
}

export default function ProcessesView({ initialProcesses, departmentTree, skills: initialSkills }: Props) {
  const [processes, setProcesses] = useState<ProcessDetailRow[]>(initialProcesses)
  const [localSkills, setLocalSkills] = useState<Skill[]>(initialSkills)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editingProcess, setEditingProcess] = useState<ProcessDetailRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProcessDetailRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
  const [showConfetti, setShowConfetti] = useState(false)
  const [hoveredProcessId, setHoveredProcessId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const flatDepts = departmentTree.flatMap<Department>((d) => [d, ...d.children])

  // Group processes by warehouse zone
  const processGroups = useMemo(() => {
    const map = new Map<string, { zone: Zone; processes: ProcessDetailRow[] }>()
    for (const p of processes) {
      const zone = matchZone(p.name, p.departmentName)
      const existing = map.get(zone.id)
      if (existing) existing.processes.push(p)
      else map.set(zone.id, { zone, processes: [p] })
    }
    return Array.from(map.values()).sort((a, b) => a.zone.order - b.zone.order)
  }, [processes])

  function handleWizardClose() {
    setWizardOpen(false)
    setEditingProcess(null)
  }

  function handleCreated(p: ProcessDetailRow) {
    setProcesses((prev) => [p, ...prev])
    setShowConfetti(true)
  }

  function handleSaved(p: ProcessDetailRow) {
    setProcesses((prev) => prev.map((x) => (x.id === p.id ? p : x)))
  }

  function handleEdit(p: ProcessDetailRow) {
    setEditingProcess(p)
  }

  function handleSkillCreated(skill: Skill) {
    setLocalSkills((prev) => {
      if (prev.some((s) => s.id === skill.id)) return prev
      return [...prev, skill]
    })
  }

  function handleDeleteRequest(p: ProcessDetailRow) {
    setDeleteTarget(p)
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    setDeletingId(target.id)
    startTransition(async () => {
      const result = await deleteProcessAction(target.id)
      if (result.ok) {
        setProcesses((prev) => prev.filter((x) => x.id !== target.id))
      }
      setDeletingId(null)
    })
  }

  function handleToggle(p: ProcessDetailRow, active: boolean) {
    setProcesses((prev) => prev.map((x) => (x.id === p.id ? { ...x, active } : x)))
    setTogglingIds((prev) => new Set(prev).add(p.id))
    startTransition(async () => {
      const result = await updateProcessAction(p.id, {
        name: p.name,
        departmentId: p.departmentId,
        normUnit: p.normUnit,
        normPerHour: p.normPerHour,
        minStaff: p.minStaff,
        maxStaff: p.maxStaff,
        requiredSkillId: p.requiredSkillId,
        active,
      })
      if (!result.ok) {
        setProcesses((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: !active } : x)))
      }
      setTogglingIds((prev) => {
        const next = new Set(prev)
        next.delete(p.id)
        return next
      })
    })
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1">Workforce setup</p>
          <h1 className="text-[22px] font-bold text-gray-900 leading-tight tracking-tight">Processen</h1>
          <p className="mt-1 text-sm text-gray-500">Operationele processen met productiviteitsnormen, bemanning en vereiste skills.</p>
        </div>
        <button
          onClick={() => setWizardOpen(true)}
          className="ds-btn ds-btn-primary ds-btn-sm shrink-0"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Proces toevoegen
        </button>
      </div>

      {/* ── Content: Flow Diagram + Grouped Process List ── */}
      {processes.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-gray-200 bg-gray-50/30 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4F6BFF]/10 to-[#6C83FF]/5 flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: '#4F6BFF' }}>
              <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Nog geen processen</p>
          <p className="text-xs text-gray-400 max-w-[280px]">Definieer operationele processen om de warehouse flow te visualiseren.</p>
          <button onClick={() => setWizardOpen(true)} className="ds-btn ds-btn-primary ds-btn-sm mt-4">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            Proces toevoegen
          </button>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {/* Warehouse Flow Diagram — full width */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
            <WarehouseFlowDiagram
              processes={processes}
              hoveredProcessId={hoveredProcessId}
              onHoverProcess={setHoveredProcessId}
              onClickProcess={(id) => { const p = processes.find((x) => x.id === id); if (p) handleEdit(p) }}
            />
          </motion.div>

          {/* Grouped process cards per zone */}
          <div className="space-y-4">
            {processGroups.map((group, gi) => (
              <motion.div key={group.zone.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 + gi * 0.05 }}
              >
                {/* Zone header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg leading-none">{group.zone.emoji}</span>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: group.zone.color }}>
                    {group.zone.labelNL}
                  </span>
                  <span className="text-[10px] text-gray-300 tabular-nums">{group.processes.length}</span>
                  <div className="flex-1 h-px ml-2" style={{ backgroundColor: `${group.zone.color}20` }} />
                </div>

                {/* Process cards in grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {group.processes.map((p, pi) => (
                    <motion.div key={p.id}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2, delay: gi * 0.05 + pi * 0.02 }}
                      onMouseEnter={() => setHoveredProcessId(p.id)}
                      onMouseLeave={() => setHoveredProcessId(null)}
                      className={`group relative rounded-xl border bg-white p-3 transition-all duration-200 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 ${
                        hoveredProcessId === p.id ? 'border-l-[3px]' : 'border-l-[3px]'
                      }`}
                      style={{
                        borderLeftColor: hoveredProcessId === p.id ? group.zone.color : `${group.zone.color}40`,
                        borderColor: hoveredProcessId === p.id ? `${group.zone.color}60` : '#E5E7EB',
                        borderLeftWidth: 3,
                        opacity: deletingId === p.id ? 0.5 : p.active ? 1 : 0.5,
                      }}
                    >
                      {/* Row 1: Name + toggle */}
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Toggle */}
                          <button type="button" role="switch" aria-checked={p.active}
                            onClick={() => handleToggle(p, !p.active)}
                            disabled={togglingIds.has(p.id)}
                            className="relative w-7 h-4 rounded-full transition-colors"
                            style={{ backgroundColor: p.active ? '#10B981' : '#D1D5DB', opacity: togglingIds.has(p.id) ? 0.5 : 1 }}>
                            <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-[left]" style={{ left: p.active ? 14 : 2 }} />
                          </button>
                          {/* Edit */}
                          <button type="button" onClick={() => handleEdit(p)}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:text-[#4F6BFF] hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer">
                            <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M10 2l2 2-7 7H3v-2l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
                          </button>
                          {/* Delete */}
                          <button type="button" onClick={() => handleDeleteRequest(p)}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer">
                            <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M3 5h8M5.5 5V3h3v2M4.5 5l.5 7h4l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                          </button>
                        </div>
                      </div>

                      {/* Row 2: Meta chips */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {p.departmentName && (
                          <span className="text-[10px] font-medium text-gray-500 bg-gray-50 rounded-md px-1.5 py-0.5">{p.departmentName}</span>
                        )}
                        {p.normPerHour && p.normUnit && (
                          <span className="text-[10px] font-medium tabular-nums rounded-md px-1.5 py-0.5" style={{ backgroundColor: `${group.zone.color}10`, color: group.zone.color }}>
                            {p.normPerHour} {p.normUnit.toLowerCase()}/hr
                          </span>
                        )}
                        {(p.minStaff !== null || p.maxStaff !== null) && (
                          <span className="text-[10px] text-gray-400 tabular-nums">
                            {p.minStaff !== null && `min ${p.minStaff}`}{p.minStaff !== null && p.maxStaff !== null && ' · '}{p.maxStaff !== null && `max ${p.maxStaff}`}
                          </span>
                        )}
                        {p.requiredSkillName && (
                          <span className="text-[10px] font-medium text-violet-600 bg-violet-50 rounded-md px-1.5 py-0.5">{p.requiredSkillName}</span>
                        )}
                        {!p.active && (
                          <span className="text-[10px] font-bold text-red-500 bg-red-50 rounded-md px-1.5 py-0.5">Inactief</span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <ProcessWizard
        open={wizardOpen || editingProcess !== null}
        onClose={handleWizardClose}
        onCreated={handleCreated}
        onSaved={handleSaved}
        process={editingProcess ?? undefined}
        departments={flatDepts}
        skills={localSkills}
        onSkillCreated={handleSkillCreated}
      />

      {deleteTarget && (
        <DeleteConfirmDialog
          processName={deleteTarget.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {showConfetti && <ProcessConfetti onDone={() => setShowConfetti(false)} />}
    </div>
  )
}

// -- Process row -------------------------------------------------------------

function ProcessRow({
  p,
  isToggling,
  isDeleting,
  onEdit,
  onDelete,
  onToggle,
}: {
  p: ProcessDetailRow
  isToggling: boolean
  isDeleting: boolean
  onEdit: () => void
  onDelete: () => void
  onToggle: (active: boolean) => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '13px 16px',
        borderRadius: 12,
        border: '1px solid #E6E8F0',
        background: isDeleting ? 'rgba(220,38,38,0.025)' : '#ffffff',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
        opacity: isDeleting ? 0.65 : 1,
      }}
      className="process-row"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Left: name + dept */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: '#0B0B0C',
            letterSpacing: '-0.01em',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {p.name}
        </p>
        {p.departmentName ? (
          <p
            style={{
              margin: '3px 0 0',
              fontSize: 12,
              color: '#9CA3AF',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {p.departmentName}
          </p>
        ) : (
          <p style={{ margin: '3px 0 0', fontSize: 12, color: '#D1D5DB' }}>No department</p>
        )}
      </div>

      {/* Productivity */}
      <div
        className="hidden sm:flex"
        style={{ width: 112, flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}
      >
        {p.normPerHour && p.normUnit ? (
          <>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', lineHeight: 1.3 }}>
              {p.normPerHour}
            </span>
            <span style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.3, marginTop: 1 }}>
              {p.normUnit.toLowerCase()}/hr
            </span>
          </>
        ) : (
          <span style={{ fontSize: 13, color: '#D1D5DB' }}>{'\u2014'}</span>
        )}
      </div>

      {/* Staffing */}
      <div
        className="hidden md:flex"
        style={{ width: 100, flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}
      >
        {p.minStaff !== null || p.maxStaff !== null ? (
          <>
            {p.minStaff !== null && (
              <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.3 }}>
                Min&nbsp;{p.minStaff}
              </span>
            )}
            {p.maxStaff !== null && (
              <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.3 }}>
                Max&nbsp;{p.maxStaff}
              </span>
            )}
          </>
        ) : (
          <span style={{ fontSize: 12, color: '#D1D5DB' }}>No limits</span>
        )}
      </div>

      {/* Skill */}
      <div
        className="hidden lg:block"
        style={{ width: 110, textAlign: 'right', flexShrink: 0 }}
      >
        {p.requiredSkillName ? (
          <span
            style={{
              display: 'inline-block',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 12,
              fontWeight: 500,
              color: '#374151',
              background: '#F3F4F6',
              borderRadius: 6,
              padding: '2px 7px',
            }}
          >
            {p.requiredSkillName}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: '#D1D5DB' }}>{'\u2014'}</span>
        )}
      </div>

      {/* Status toggle + row actions */}
      <div
        style={{
          width: 96,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 4,
          flexShrink: 0,
        }}
      >
        {/* Active/inactive toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={p.active}
          onClick={() => onToggle(!p.active)}
          disabled={isToggling}
          title={p.active ? 'Deactivate' : 'Activate'}
          style={{
            position: 'relative',
            width: 30,
            height: 17,
            borderRadius: 9,
            background: p.active ? '#10B981' : '#D1D5DB',
            border: 'none',
            cursor: isToggling ? 'wait' : 'pointer',
            transition: 'background 0.2s ease',
            flexShrink: 0,
            padding: 0,
            opacity: isToggling ? 0.65 : 1,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: p.active ? 15 : 2,
              width: 13,
              height: 13,
              borderRadius: '50%',
              background: '#ffffff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
              transition: 'left 0.2s ease',
            }}
          />
        </button>

        {/* Edit button — visible on row hover */}
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit process"
          className="ds-icon-btn"
          style={{
            color: '#4F6BFF',
            width: 26,
            height: 26,
            borderRadius: 7,
            opacity: hovered ? 1 : 0,
            pointerEvents: hovered ? 'auto' : 'none',
            transition: 'opacity 0.15s ease',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M11 2.5l2.5 2.5L5.5 13H3v-2.5L11 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Delete button — visible on row hover, muted colour */}
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete process"
          className="ds-icon-btn"
          style={{
            color: '#9CA3AF',
            width: 26,
            height: 26,
            borderRadius: 7,
            opacity: hovered ? 1 : 0,
            pointerEvents: hovered ? 'auto' : 'none',
            transition: 'opacity 0.15s ease',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 5h10M6 5V3h4v2M5 5l.5 8h5L11 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// -- Delete confirmation dialog -----------------------------------------------

function DeleteConfirmDialog({
  processName,
  onCancel,
  onConfirm,
}: {
  processName: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 900,
        }}
      />

      {/* Dialog */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 360,
          maxWidth: '90vw',
          zIndex: 910,
          background: '#ffffff',
          borderRadius: 16,
          border: '1px solid rgba(226,229,237,0.9)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.06)',
          padding: '24px 24px 20px',
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'rgba(220,38,38,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ color: '#DC2626' }}>
            <path d="M3 5h10M6 5V3h4v2M5 5l.5 8h5L11 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h2
          id="delete-dialog-title"
          style={{ fontSize: 15, fontWeight: 700, color: '#0B0B0C', margin: '0 0 6px', letterSpacing: '-0.01em' }}
        >
          Delete process?
        </h2>

        <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px', lineHeight: 1.55 }}>
          <strong style={{ color: '#111827' }}>{processName}</strong> will be permanently removed. This cannot be undone.
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            className="ds-btn ds-btn-secondary ds-btn-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="ds-btn ds-btn-sm"
            style={{
              background: '#DC2626',
              color: '#ffffff',
              border: '1px solid #DC2626',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Delete Process
          </button>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// ProcessConfetti — full-page canvas particle system
// ---------------------------------------------------------------------------
function ProcessConfetti({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const doneFiredRef = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = window.innerWidth
    const H = window.innerHeight
    canvas.width = W
    canvas.height = H

    const COLORS = ['#4F6BFF','#818CF8','#22C55E','#F59E0B','#EC4899','#8B5CF6','#EF4444','#06B6D4','#FBBF24','#F472B6','#ffffff']
    type Shape = 'circle' | 'rect' | 'triangle' | 'star' | 'ribbon'
    const SHAPES: Shape[] = ['circle', 'rect', 'triangle', 'star', 'ribbon']

    interface P {
      x: number; y: number; vx: number; vy: number
      ay: number; color: string; size: number
      rot: number; rotV: number; shape: Shape
      opacity: number; life: number; maxLife: number
      delay: number; wobble: number; wobbleSpeed: number
    }

    const particles: P[] = []

    // Three cannon blasts from bottom
    const cannons = [
      { x: W * 0.18, angle: -75 },
      { x: W * 0.5,  angle: -88 },
      { x: W * 0.82, angle: -105 },
    ]
    for (const c of cannons) {
      for (let i = 0; i < 65; i++) {
        const spread = c.angle + (Math.random() - 0.5) * 42
        const rad = (spread * Math.PI) / 180
        const speed = 9 + Math.random() * 14
        particles.push({
          x: c.x + (Math.random() - 0.5) * 28,
          y: H + 10,
          vx: Math.cos(rad) * speed,
          vy: Math.sin(rad) * speed,
          ay: 0.28 + Math.random() * 0.12,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          size: 6 + Math.random() * 11,
          rot: Math.random() * Math.PI * 2,
          rotV: (Math.random() - 0.5) * 0.26,
          shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
          opacity: 1, life: 0,
          maxLife: 170 + Math.floor(Math.random() * 90),
          delay: Math.floor(Math.random() * 18),
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.05 + Math.random() * 0.1,
        })
      }
    }

    // Ticker-tape rain from top (delayed)
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: Math.random() * W,
        y: -15,
        vx: (Math.random() - 0.5) * 2.5,
        vy: 1.5 + Math.random() * 3,
        ay: 0.06,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 5 + Math.random() * 8,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.22,
        shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
        opacity: 1, life: 0,
        maxLife: 230 + Math.floor(Math.random() * 70),
        delay: 50 + Math.floor(Math.random() * 90),
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.03 + Math.random() * 0.07,
      })
    }

    function drawStar(cx: number, cy: number, r: number) {
      const ir = r * 0.42
      const spikes = 5
      let rot = -(Math.PI / 2)
      const step = Math.PI / spikes
      ctx!.beginPath()
      for (let i = 0; i < spikes * 2; i++) {
        const radius = i % 2 === 0 ? r : ir
        ctx!.lineTo(cx + Math.cos(rot) * radius, cy + Math.sin(rot) * radius)
        rot += step
      }
      ctx!.closePath()
    }

    let frame = 0
    let rafId: number

    function tick() {
      ctx!.clearRect(0, 0, W, H)
      let alive = 0
      for (const p of particles) {
        if (frame < p.delay) { alive++; continue }
        if (p.life >= p.maxLife) continue
        p.life++
        alive++
        p.wobble += p.wobbleSpeed
        p.vx += Math.sin(p.wobble) * 0.04
        p.vy += p.ay
        p.vx *= 0.994
        p.x += p.vx
        p.y += p.vy
        p.rot += p.rotV
        const fadeStart = p.maxLife - 45
        if (p.life > fadeStart) p.opacity = 1 - (p.life - fadeStart) / 45
        ctx!.save()
        ctx!.globalAlpha = Math.max(0, p.opacity)
        ctx!.fillStyle = p.color
        ctx!.translate(p.x, p.y)
        ctx!.rotate(p.rot)
        const s = p.size
        if (p.shape === 'circle') {
          ctx!.beginPath(); ctx!.ellipse(0, 0, s / 2, s / 3, 0, 0, Math.PI * 2); ctx!.fill()
        } else if (p.shape === 'rect') {
          ctx!.fillRect(-s / 2, -s / 4, s, s / 2)
        } else if (p.shape === 'triangle') {
          ctx!.beginPath(); ctx!.moveTo(0, -s / 2); ctx!.lineTo(s / 2, s / 2); ctx!.lineTo(-s / 2, s / 2); ctx!.closePath(); ctx!.fill()
        } else if (p.shape === 'star') {
          drawStar(0, 0, s / 2); ctx!.fill()
        } else {
          // ribbon
          ctx!.beginPath(); ctx!.ellipse(0, 0, s / 1.6, s / 6, 0, 0, Math.PI * 2); ctx!.fill()
        }
        ctx!.restore()
      }
      frame++
      if (alive > 0 && frame < 440) {
        rafId = requestAnimationFrame(tick)
      } else {
        if (!doneFiredRef.current) {
          doneFiredRef.current = true
          onDoneRef.current()
        }
      }
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}
    />
  )
}
