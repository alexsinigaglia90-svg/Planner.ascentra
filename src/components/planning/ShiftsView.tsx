'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ShiftTemplateWithContext } from '@/lib/queries/shiftTemplates'
import type { ShiftRequirement } from '@/lib/queries/shiftRequirements'
import type { Skill } from '@/lib/queries/skills'
import type { ProcessDetailRow } from '@/lib/queries/processes'
import ShiftTemplateTable from '@/components/planning/ShiftTemplateTable'
import ShiftTemplateForm from '@/components/planning/ShiftTemplateForm'
import { OperationsTimeline } from '@/components/planning/OperationsTimeline'

type NamedItem = { id: string; name: string }

interface Props {
  templates: ShiftTemplateWithContext[]
  requirements: ShiftRequirement[]
  orgSkills: Skill[]
  locations: NamedItem[]
  departments: NamedItem[]
  processes?: ProcessDetailRow[]
  breakCovers?: { sourceProcessId: string; targetProcessId: string; headcount: number }[]
  canEdit: boolean
}

function parseHHMM(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export default function ShiftsView({
  templates,
  requirements,
  orgSkills,
  locations,
  departments,
  processes,
  breakCovers,
  canEdit,
}: Props) {
  const [showForm, setShowForm] = useState(false)
  const [showTimeline, setShowTimeline] = useState(true)

  // Stats
  const stats = useMemo(() => {
    const totalShifts = templates.length
    const totalHours = templates.reduce((sum, t) => {
      let mins = parseHHMM(t.endTime) - parseHHMM(t.startTime)
      if (mins <= 0) mins += 1440
      return sum + mins / 60
    }, 0)
    const reqMap = new Map(requirements.map((r) => [r.shiftTemplateId, r.requiredHeadcount]))
    const totalStaff = templates.reduce((sum, t) => sum + (reqMap.get(t.id) ?? t.requiredEmployees), 0)
    const withSkill = templates.filter((t) => t.requiredSkillId).length

    return { totalShifts, totalHours: Math.round(totalHours * 10) / 10, totalStaff, withSkill }
  }, [templates, requirements])

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1">Workforce setup</p>
          <h1 className="text-[22px] font-bold text-gray-900 leading-tight tracking-tight">Shifts</h1>
          <p className="mt-1 text-sm text-gray-500">Beheer shift templates, pauzes, bezettingseisen en vereiste skills.</p>
        </div>
        <div className="flex items-center gap-2">
          {processes && processes.length > 0 && (
            <button
              type="button"
              onClick={() => setShowTimeline(!showTimeline)}
              className={`ds-btn ds-btn-sm ${showTimeline ? 'ds-btn-secondary' : 'ds-btn-ghost'}`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 4h12M2 8h8M2 12h10" />
              </svg>
              Tijdlijn
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="ds-btn ds-btn-primary ds-btn-sm"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              Shift toevoegen
            </button>
          )}
        </div>
      </div>

      {/* ── Stats strip ── */}
      {templates.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Shifts', value: stats.totalShifts, color: '#4F6BFF' },
            { label: 'Daguren totaal', value: `${stats.totalHours}u`, color: '#8B5CF6' },
            { label: 'Benodigde bezetting', value: stats.totalStaff, color: '#F59E0B' },
            { label: 'Met skill-eis', value: stats.withSkill, color: '#22C55E' },
          ].map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="ds-stat-card p-4"
              style={{ '--stat-accent': s.color } as React.CSSProperties}
            >
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{s.label}</p>
              <p className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">{s.value}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Operations Timeline (collapsible) ── */}
      <AnimatePresence>
        {showTimeline && processes && processes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <OperationsTimeline
              shifts={templates}
              processes={processes}
              breakCovers={breakCovers}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add form (collapsible) ── */}
      <AnimatePresence>
        {showForm && canEdit && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <ShiftTemplateForm onCreated={() => setShowForm(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Shift template cards ── */}
      <ShiftTemplateTable
        templates={templates}
        requirements={requirements}
        orgSkills={orgSkills}
        locations={locations}
        departments={departments}
        canEdit={canEdit}
      />
    </div>
  )
}
