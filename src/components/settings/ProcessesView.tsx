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
    <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Processes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Define the operational processes used in your workforce planning.
          </p>
        </div>
        <button
          onClick={() => setWizardOpen(true)}
          className="ds-btn ds-btn-primary ds-btn-sm shrink-0 mt-0.5"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
          Add Process
        </button>
      </div>

      {processes.length === 0 ? (
        <p className="text-sm text-gray-400 italic">
          No processes yet. Click &ldquo;Add Process&rdquo; to get started.
        </p>
      ) : (
        <div className="space-y-2">
          {processes.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-gray-200 bg-white px-4 py-3 flex items-center gap-3"
            >
              {/* Name + department */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                {p.departmentName && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{p.departmentName}</p>
                )}
              </div>

              {/* Norm */}
              <div className="hidden sm:block text-xs text-gray-500 text-right shrink-0 w-28">
                {p.normPerHour && p.normUnit ? (
                  <span>
                    {p.normPerHour} {p.normUnit.toLowerCase()}/hr
                  </span>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </div>

              {/* Staffing */}
              <div className="hidden md:block text-xs text-gray-500 text-right shrink-0 w-24">
                {p.minStaff !== null || p.maxStaff !== null ? (
                  <span>
                    {p.minStaff !== null ? `Min ${p.minStaff}` : ''}
                    {p.minStaff !== null && p.maxStaff !== null ? ' / ' : ''}
                    {p.maxStaff !== null ? `Max ${p.maxStaff}` : ''}
                  </span>
                ) : (
                  <span className="text-gray-300">No limits</span>
                )}
              </div>

              {/* Required skill */}
              <div className="hidden lg:block text-xs text-gray-500 text-right shrink-0 w-28 truncate">
                {p.requiredSkillName ?? <span className="text-gray-300">—</span>}
              </div>

              {/* Status badge */}
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  p.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'
                }`}
              >
                {p.active ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
        </div>
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
