'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import ProcessWizard from '@/components/settings/ProcessWizard'
import { deleteProcessAction, updateProcessAction } from '@/app/settings/processes/actions'
import type { DepartmentWithChildren, Department } from '@/lib/queries/locations'
import type { Skill } from '@/lib/queries/skills'
import type { ProcessDetailRow } from '@/lib/queries/processes'

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
  const [, startTransition] = useTransition()

  const flatDepts = departmentTree.flatMap<Department>((d) => [d, ...d.children])

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
    <div className="mx-auto max-w-3xl px-6 py-10 space-y-8">

      {/* -- Hero header -- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 24,
          paddingBottom: 24,
          borderBottom: '1px solid #E6E8F0',
        }}
      >
        <div style={{ minWidth: 0 }}>
          {/* Eyebrow */}
          <p
            style={{
              margin: '0 0 6px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#9CA3AF',
            }}
          >
            Workforce setup
          </p>
          <h1
            style={{
              margin: '0 0 6px',
              fontSize: 22,
              fontWeight: 700,
              color: '#0B0B0C',
              letterSpacing: '-0.02em',
              lineHeight: 1.25,
            }}
          >
            Processes
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: '#6B7280', lineHeight: 1.55 }}>
            Define the operational processes used in workforce planning — each with its own productivity norm, staffing limits, and skill requirement.
          </p>
        </div>
        <button
          onClick={() => setWizardOpen(true)}
          className="ds-btn ds-btn-primary ds-btn-sm"
          style={{ flexShrink: 0, marginTop: 4 }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Add Process
        </button>
      </div>

      {/* -- Process list -- */}
      {processes.length === 0 ? (
        // Empty state
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 12,
            padding: '52px 32px',
            borderRadius: 16,
            border: '1.5px dashed #E2E5ED',
            background: 'rgba(246,247,251,0.7)',
          }}
        >
          {/* icon */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg,rgba(79,107,255,0.1) 0%,rgba(108,131,255,0.06) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 4,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: '#4F6BFF' }}>
              <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: '#111827' }}>
              No processes yet
            </p>
            <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF', lineHeight: 1.55 }}>
              Click <strong style={{ color: '#4F6BFF', fontWeight: 600 }}>Add Process</strong> to define your first operational process.
            </p>
          </div>
          <button
            onClick={() => setWizardOpen(true)}
            className="ds-btn ds-btn-primary ds-btn-sm"
            style={{ marginTop: 4 }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Add Process
          </button>
        </div>
      ) : (
        <>
          {/* Column headers — visible on md+ */}
          <div
            className="hidden md:flex"
            style={{
              paddingInline: '16px 12px',
              marginBottom: -4,
              gap: 12,
              alignItems: 'center',
            }}
          >
            <span style={{ flex: 1, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9CA3AF' }}>
              Process
            </span>
            <span className="hidden sm:block" style={{ width: 112, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9CA3AF', textAlign: 'right' }}>
              Productivity
            </span>
            <span className="hidden md:block" style={{ width: 100, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9CA3AF', textAlign: 'right' }}>
              Staffing
            </span>
            <span className="hidden lg:block" style={{ width: 110, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9CA3AF', textAlign: 'right' }}>
              Skill
            </span>
            <span style={{ width: 96, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9CA3AF', textAlign: 'right' }}>
              Status
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {processes.map((p) => (
              <ProcessRow
                key={p.id}
                p={p}
                isToggling={togglingIds.has(p.id)}
                isDeleting={deletingId === p.id}
                onEdit={() => handleEdit(p)}
                onDelete={() => handleDeleteRequest(p)}
                onToggle={(active) => handleToggle(p, active)}
              />
            ))}
          </div>
        </>
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
