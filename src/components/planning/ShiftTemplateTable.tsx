'use client'

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ShiftTemplateWithContext } from '@/lib/queries/shiftTemplates'
import type { ShiftRequirement } from '@/lib/queries/shiftRequirements'
import type { Skill } from '@/lib/queries/skills'
import type { ProcessDetailRow } from '@/lib/queries/processes'
import type { ProcessShiftLinkRow } from '@/lib/queries/processShiftLinks'
import { EmptyState } from '@/components/ui'
import {
  setShiftRequirementAction,
  setShiftRequiredSkillAction,
  setShiftTemplateLocationAction,
  setShiftTemplateDepartmentAction,
  updateShiftBreakConfigAction,
  deleteShiftTemplateAction,
  toggleProcessShiftLinkAction,
} from '@/app/shifts/actions'

type NamedItem = { id: string; name: string }

interface Props {
  templates: ShiftTemplateWithContext[]
  requirements: ShiftRequirement[]
  orgSkills: Skill[]
  locations: NamedItem[]
  departments: NamedItem[]
  processes: ProcessDetailRow[]
  processShiftLinks: ProcessShiftLinkRow[]
  canEdit: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseHHMM(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function durationLabel(start: string, end: string): string {
  let mins = parseHHMM(end) - parseHHMM(start)
  if (mins <= 0) mins += 1440
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}u ${m}m` : `${h}u`
}

const SHIFT_COLORS = ['#4F6BFF', '#0D9488', '#6D28D9', '#047857', '#BE123C', '#B45309', '#7C3AED', '#C2410C']

function getShiftColor(index: number): string {
  return SHIFT_COLORS[index % SHIFT_COLORS.length]
}

// ── Break config ─────────────────────────────────────────────────────────────

const BREAK_MODES: { value: string; label: string; short: string }[] = [
  { value: 'all', label: 'Iedereen tegelijk', short: 'Tegelijk' },
  { value: 'rotating', label: 'Roulerend', short: 'Roulerend' },
  { value: 'individual', label: 'Individueel', short: 'Vrij' },
]

// ── Shift card ───────────────────────────────────────────────────────────────

function ShiftCard({
  template,
  requirement,
  orgSkills,
  locations,
  departments,
  processes,
  linkedProcessIds,
  canEdit,
  color,
  index,
}: {
  template: ShiftTemplateWithContext
  requirement: ShiftRequirement | undefined
  orgSkills: Skill[]
  locations: NamedItem[]
  departments: NamedItem[]
  processes: ProcessDetailRow[]
  linkedProcessIds: Set<string>
  canEdit: boolean
  color: string
  index: number
}) {
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleted, setDeleted] = useState(false)

  // Inline edit states
  const [reqValue, setReqValue] = useState(requirement?.requiredHeadcount ?? template.requiredEmployees)
  const [skillId, setSkillId] = useState(template.requiredSkillId ?? '')
  const [locId, setLocId] = useState(template.locationId ?? '')
  const [deptId, setDeptId] = useState(template.departmentId ?? '')

  const reqCurrent = requirement?.requiredHeadcount ?? template.requiredEmployees
  const duration = durationLabel(template.startTime, template.endTime)
  const breakLabel = template.breakMinutes ? `${template.breakMinutes}min pauze` : null
  const breakMode = BREAK_MODES.find((m) => m.value === (template.breakMode ?? 'all'))?.short ?? ''
  const skillName = orgSkills.find((s) => s.id === skillId)?.name
  const locName = locations.find((l) => l.id === locId)?.name
  const deptName = departments.find((d) => d.id === deptId)?.name

  function saveReq() {
    if (reqValue === reqCurrent) return
    startTransition(async () => { await setShiftRequirementAction(template.id, reqValue) })
  }
  function saveSkill(id: string) {
    setSkillId(id)
    startTransition(async () => { await setShiftRequiredSkillAction(template.id, id || null) })
  }
  function saveLoc(id: string) {
    setLocId(id)
    startTransition(async () => { await setShiftTemplateLocationAction(template.id, id || null) })
  }
  function saveDept(id: string) {
    setDeptId(id)
    startTransition(async () => { await setShiftTemplateDepartmentAction(template.id, id || null) })
  }
  function handleDelete() {
    startTransition(async () => {
      const res = await deleteShiftTemplateAction(template.id)
      if (res.ok) setDeleted(true)
      else setDeleteError(res.error)
    })
  }

  if (deleted) return null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      className="group relative rounded-2xl border border-gray-200 bg-white overflow-hidden hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Top color accent */}
      <div className="h-1" style={{ backgroundColor: color }} />

      <div className="p-5">
        {/* Row 1: Name + time + duration */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            {/* Time badge */}
            <div className="flex flex-col items-center rounded-xl px-3 py-2" style={{ backgroundColor: `${color}0A` }}>
              <span className="text-sm font-bold tabular-nums" style={{ color }}>{template.startTime}</span>
              <span className="text-[9px] text-gray-400">tot</span>
              <span className="text-sm font-bold tabular-nums" style={{ color }}>{template.endTime}</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">{template.name}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{duration}{breakLabel ? ` · ${breakLabel} (${breakMode})` : ''}</p>
            </div>
          </div>

          {/* Actions */}
          {canEdit && !confirmDelete && (
            <button type="button" onClick={() => setConfirmDelete(true)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
              title="Verwijderen">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 5h10M6 5V3h4v2M5 5l.5 8h5L11 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
            </button>
          )}
          {confirmDelete && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button type="button" onClick={handleDelete} disabled={isPending}
                className="text-[10px] font-bold text-white bg-red-500 rounded-lg px-2.5 py-1 hover:bg-red-600 transition-colors disabled:opacity-50 cursor-pointer">
                {isPending ? '...' : 'Verwijder'}
              </button>
              <button type="button" onClick={() => { setConfirmDelete(false); setDeleteError(null) }}
                className="text-[10px] text-gray-500 rounded-lg px-2 py-1 hover:bg-gray-100 transition-colors cursor-pointer">
                Annuleer
              </button>
            </div>
          )}
        </div>

        {deleteError && <p className="text-xs text-red-600 mb-3">{deleteError}</p>}

        {/* Row 2: Config chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Required staff */}
          {canEdit ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5">
              <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                <path d="M9.5 12.5v-1a3 3 0 00-3-3h-2a3 3 0 00-3 3v1" /><circle cx="5.5" cy="4.5" r="2.5" />
              </svg>
              <input type="number" min={0} value={reqValue}
                onChange={(e) => setReqValue(parseInt(e.target.value) || 0)}
                onBlur={saveReq} onKeyDown={(e) => e.key === 'Enter' && saveReq()}
                className="w-10 text-xs font-semibold text-gray-900 bg-transparent focus:outline-none tabular-nums text-center"
              />
              <span className="text-[10px] text-gray-400">FTE</span>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-700">
              <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                <path d="M9.5 12.5v-1a3 3 0 00-3-3h-2a3 3 0 00-3 3v1" /><circle cx="5.5" cy="4.5" r="2.5" />
              </svg>
              {reqCurrent} FTE
            </span>
          )}

          {/* Skill */}
          {canEdit ? (
            <select value={skillId} onChange={(e) => saveSkill(e.target.value)}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-gray-400 cursor-pointer bg-white">
              <option value="">Geen skill</option>
              {orgSkills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          ) : skillName ? (
            <span className="inline-flex items-center rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-700">{skillName}</span>
          ) : null}

          {/* Location */}
          {canEdit ? (
            locations.length > 0 && (
              <select value={locId} onChange={(e) => saveLoc(e.target.value)}
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-gray-400 cursor-pointer bg-white">
                <option value="">Geen locatie</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )
          ) : locName ? (
            <span className="inline-flex items-center rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-700">{locName}</span>
          ) : null}

          {/* Department */}
          {canEdit ? (
            departments.length > 0 && (
              <select value={deptId} onChange={(e) => saveDept(e.target.value)}
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-gray-400 cursor-pointer bg-white">
                <option value="">Geen afdeling</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )
          ) : deptName ? (
            <span className="inline-flex items-center rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700">{deptName}</span>
          ) : null}

          {isPending && (
            <span className="text-[10px] text-gray-400 animate-pulse">Opslaan...</span>
          )}
        </div>

        {/* Process links — which processes run in this shift */}
        {processes.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Processen in deze shift</p>
            <div className="flex flex-wrap gap-1.5">
              {processes.filter((p) => p.active).map((proc) => {
                const isLinked = linkedProcessIds.has(proc.id)
                return (
                  <button
                    key={proc.id}
                    type="button"
                    onClick={() => {
                      if (!canEdit) return
                      startTransition(async () => {
                        await toggleProcessShiftLinkAction(proc.id, template.id, !isLinked)
                        // Optimistic: toggle is handled by re-render from revalidatePath
                      })
                    }}
                    disabled={!canEdit}
                    className={[
                      'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium transition-all cursor-pointer border',
                      isLinked
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-600',
                    ].join(' ')}
                  >
                    {proc.color && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: proc.color }} />}
                    {proc.name}
                    {isLinked && <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Main table ───────────────────────────────────────────────────────────────

export default function ShiftTemplateTable({ templates, requirements, orgSkills, locations, departments, processes, processShiftLinks, canEdit }: Props) {
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

  // Build per-shift linked process IDs
  const shiftLinkedProcesses = new Map<string, Set<string>>()
  for (const link of processShiftLinks) {
    const existing = shiftLinkedProcesses.get(link.shiftTemplateId) ?? new Set()
    existing.add(link.processId)
    shiftLinkedProcesses.set(link.shiftTemplateId, existing)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <AnimatePresence mode="popLayout">
        {templates.map((t, i) => (
          <ShiftCard
            key={t.id}
            template={t}
            requirement={reqMap.get(t.id)}
            orgSkills={orgSkills}
            locations={locations}
            departments={departments}
            processes={processes}
            linkedProcessIds={shiftLinkedProcesses.get(t.id) ?? new Set()}
            canEdit={canEdit}
            color={getShiftColor(i)}
            index={i}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
