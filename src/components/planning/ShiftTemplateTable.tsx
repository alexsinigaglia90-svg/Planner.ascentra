'use client'

import { useState, useTransition } from 'react'
import type { ShiftTemplateWithContext } from '@/lib/queries/shiftTemplates'
import type { ShiftRequirement } from '@/lib/queries/shiftRequirements'
import type { Skill } from '@/lib/queries/skills'
import { EmptyState } from '@/components/ui'
import {
  setShiftRequirementAction,
  setShiftRequiredSkillAction,
  setShiftTemplateLocationAction,
  setShiftTemplateDepartmentAction,
} from '@/app/shifts/actions'

type NamedItem = { id: string; name: string }

interface Props {
  templates: ShiftTemplateWithContext[]
  requirements: ShiftRequirement[]
  orgSkills: Skill[]
  locations: NamedItem[]
  departments: NamedItem[]
  canEdit: boolean
}

// ---------------------------------------------------------------------------
// Required headcount cell (unchanged logic, updated type)
// ---------------------------------------------------------------------------

function RequirementCell({
  template,
  requirement,
  canEdit,
}: {
  template: ShiftTemplateWithContext
  requirement: ShiftRequirement | undefined
  canEdit: boolean
}) {
  const current = requirement?.requiredHeadcount ?? template.requiredEmployees
  const [value, setValue] = useState(current)
  const [saved, setSaved] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (value === current && saved === null) return
    setError(null)
    startTransition(async () => {
      const result = await setShiftRequirementAction(template.id, value)
      if (result.ok) {
        setSaved(value)
      } else {
        setError(result.error)
      }
    })
  }

  const displayValue = saved ?? current

  if (!canEdit) {
    return <span className="text-gray-600">{displayValue}</span>
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(parseInt(e.target.value, 10) || 0)}
        onBlur={handleSave}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
        disabled={isPending}
        className="w-16 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-gray-500 focus:outline-none disabled:opacity-60"
        aria-label={`Required headcount for ${template.name}`}
      />
      {isPending && <span className="text-xs text-gray-400">Saving…</span>}
      {!isPending && saved !== null && saved === value && (
        <span className="text-xs text-green-600">Saved</span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Required skill cell
// ---------------------------------------------------------------------------

function RequiredSkillCell({
  template,
  orgSkills,
  canEdit,
}: {
  template: ShiftTemplateWithContext
  orgSkills: Skill[]
  canEdit: boolean
}) {
  const [value, setValue] = useState(template.requiredSkillId ?? '')
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(skillId: string) {
    setValue(skillId)
    setSaved(false)
    setError(null)
    startTransition(async () => {
      const result = await setShiftRequiredSkillAction(template.id, skillId || null)
      if (result.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        setError(result.error)
      }
    })
  }

  if (!canEdit) {
    return (
      <span className={template.requiredSkill ? 'inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700' : 'text-gray-400 text-xs'}>
        {template.requiredSkill?.name ?? '—'}
      </span>
    )
  }

  if (orgSkills.length === 0) {
    return <span className="text-xs text-gray-400">No skills defined</span>
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-gray-500 focus:outline-none disabled:opacity-60 max-w-[180px]"
        aria-label={`Required skill for ${template.name}`}
      >
        <option value="">— None —</option>
        {orgSkills.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      {isPending && <span className="text-xs text-gray-400">Saving…</span>}
      {!isPending && saved && <span className="text-xs text-green-600">Saved</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Location / Department selector cell (reusable)
// ---------------------------------------------------------------------------

function ContextSelectCell({
  currentId,
  currentName,
  options,
  canEdit,
  onSave,
  placeholder,
  tagClassName,
}: {
  currentId: string | null
  currentName: string | null
  options: NamedItem[]
  canEdit: boolean
  onSave: (id: string | null) => Promise<{ ok: true } | { ok: false; error: string }>
  placeholder: string
  tagClassName: string
}) {
  const [value, setValue] = useState(currentId ?? '')
  const [displayName, setDisplayName] = useState(currentName)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleChange(newValue: string) {
    setValue(newValue)
    setError(null)
    const newId = newValue || null
    const found = options.find((o) => o.id === newValue)
    setDisplayName(found?.name ?? null)
    startTransition(async () => {
      const result = await onSave(newId)
      if (!result.ok) setError(result.error)
    })
  }

  if (!canEdit) {
    return displayName ? (
      <span className={tagClassName}>{displayName}</span>
    ) : (
      <span className="text-xs text-gray-400">—</span>
    )
  }

  if (options.length === 0) {
    return <span className="text-xs text-gray-400">None defined</span>
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-gray-500 focus:outline-none disabled:opacity-60 max-w-[150px]"
        aria-label={placeholder}
      >
        <option value="">— None —</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
      {isPending && <span className="text-xs text-gray-400">Saving…</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export default function ShiftTemplateTable({ templates, requirements, orgSkills, locations, departments, canEdit }: Props) {
  if (templates.length === 0) {
    return (
      <EmptyState
        icon="shifts"
        title="Nog geen shift templates"
        description="Maak een template om sneller planningen op te bouwen."
      />
    )
  }

  const reqMap = new Map(requirements.map((r) => [r.shiftTemplateId, r]))

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {['Name', 'Start time', 'End time', 'Required staff', 'Required skill', 'Location', 'Department'].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {templates.map((t) => (
            <tr key={t.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
              <td className="px-4 py-3 text-gray-600">{t.startTime}</td>
              <td className="px-4 py-3 text-gray-600">{t.endTime}</td>
              <td className="px-4 py-3">
                <RequirementCell
                  template={t}
                  requirement={reqMap.get(t.id)}
                  canEdit={canEdit}
                />
              </td>
              <td className="px-4 py-3">
                <RequiredSkillCell
                  template={t}
                  orgSkills={orgSkills}
                  canEdit={canEdit}
                />
              </td>
              <td className="px-4 py-3">
                <ContextSelectCell
                  currentId={t.locationId ?? null}
                  currentName={t.location?.name ?? null}
                  options={locations}
                  canEdit={canEdit}
                  onSave={(id) => setShiftTemplateLocationAction(t.id, id)}
                  placeholder="Location"
                  tagClassName="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700"
                />
              </td>
              <td className="px-4 py-3">
                <ContextSelectCell
                  currentId={t.departmentId ?? null}
                  currentName={t.department?.name ?? null}
                  options={departments}
                  canEdit={canEdit}
                  onSave={(id) => setShiftTemplateDepartmentAction(t.id, id)}
                  placeholder="Department"
                  tagClassName="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
