'use client'

import { useState, useTransition } from 'react'
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

export default function ProcessesView({ initialProcesses, departmentTree, skills }: Props) {
  const [processes, setProcesses] = useState<ProcessDetailRow[]>(initialProcesses)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editingProcess, setEditingProcess] = useState<ProcessDetailRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProcessDetailRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  const flatDepts = departmentTree.flatMap<Department>((d) => [d, ...d.children])

  function handleWizardClose() {
    setWizardOpen(false)
    setEditingProcess(null)
  }

  function handleCreated(p: ProcessDetailRow) {
    setProcesses((prev) => [p, ...prev])
  }

  function handleSaved(p: ProcessDetailRow) {
    setProcesses((prev) => prev.map((x) => (x.id === p.id ? p : x)))
  }

  function handleEdit(p: ProcessDetailRow) {
    setEditingProcess(p)
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

      {/* â”€â”€ Hero header â”€â”€ */}
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
            Define the operational processes used in workforce planning â€” each with its own productivity norm, staffing limits, and skill requirement.
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

      {/* â”€â”€ Process list â”€â”€ */}
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
          {/* Column headers â€” visible on md+ */}
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
        skills={skills}
      />

      {deleteTarget && (
        <DeleteConfirmDialog
          processName={deleteTarget.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  )
}

// â”€â”€ Process row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

        {/* Edit button â€” visible on row hover */}
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

        {/* Delete button â€” visible on row hover, muted colour */}
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

// â”€â”€ Delete confirmation dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
