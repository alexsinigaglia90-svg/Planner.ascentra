'use client'

import { useState } from 'react'
import ProcessWizard from '@/components/settings/ProcessWizard'
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

  const flatDepts = departmentTree.flatMap<Department>((d) => [d, ...d.children])

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 space-y-8">

      {/* ── Hero header ── */}
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

      {/* ── Process list ── */}
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
            <span style={{ width: 64, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9CA3AF', textAlign: 'right' }}>
              Status
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {processes.map((p) => (
              <ProcessRow key={p.id} p={p} />
            ))}
          </div>
        </>
      )}

      <ProcessWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={(p) => setProcesses((prev) => [p, ...prev])}
        departments={flatDepts}
        skills={skills}
      />
    </div>
  )
}

// ── Process row ─────────────────────────────────────────────────────────────

function ProcessRow({ p }: { p: ProcessDetailRow }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '13px 16px',
        borderRadius: 12,
        border: '1px solid #E6E8F0',
        background: '#ffffff',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
      }}
      className="process-row"
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
          <span style={{ fontSize: 13, color: '#D1D5DB' }}>—</span>
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
          <span style={{ fontSize: 12, color: '#D1D5DB' }}>—</span>
        )}
      </div>

      {/* Status badge */}
      <div style={{ width: 64, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 8px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.02em',
            background: p.active ? 'rgba(16,185,129,0.08)' : 'rgba(156,163,175,0.12)',
            color: p.active ? '#059669' : '#6B7280',
            border: p.active ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(156,163,175,0.22)',
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: p.active ? '#10B981' : '#9CA3AF',
              flexShrink: 0,
            }}
          />
          {p.active ? 'Active' : 'Inactive'}
        </span>
      </div>
    </div>
  )
}
