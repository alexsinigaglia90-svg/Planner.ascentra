'use client'

import { useRef, useState, useTransition, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Skill, SkillWithUsage } from '@/lib/queries/skills'
import { createSkillAction, deleteSkillAction, renameSkillAction } from '@/app/employees/actions'

interface Props {
  skills: Skill[]
  skillsWithUsage: SkillWithUsage[]
  totalEmployees: number
  canEdit?: boolean
}

// ── Skill Entity Card ────────────────────────────────────────────────────────

function SkillEntityCard({
  skill,
  totalEmployees,
  canEdit,
  onDeleted,
  onRenamed,
  index,
}: {
  skill: SkillWithUsage
  totalEmployees: number
  canEdit: boolean
  onDeleted: (id: string) => void
  onRenamed: (id: string, newName: string) => void
  index: number
}) {
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(skill.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showEmployees, setShowEmployees] = useState(false)

  const coverage = totalEmployees > 0 ? Math.round((skill.employeeCount / totalEmployees) * 100) : 0
  const coverageColor = coverage >= 75 ? 'bg-emerald-500' : coverage >= 40 ? 'bg-blue-500' : coverage >= 15 ? 'bg-amber-500' : 'bg-gray-300'
  const coverageTextColor = coverage >= 75 ? 'text-emerald-600' : coverage >= 40 ? 'text-blue-600' : coverage >= 15 ? 'text-amber-600' : 'text-gray-400'

  const handleRename = useCallback(() => {
    const trimmed = editName.trim()
    if (!trimmed || trimmed === skill.name) {
      setEditing(false)
      setEditName(skill.name)
      return
    }
    startTransition(async () => {
      const res = await renameSkillAction(skill.id, trimmed)
      if (res.ok) { onRenamed(skill.id, res.name); setEditing(false) }
    })
  }, [editName, skill.id, skill.name, onRenamed])

  const handleDelete = useCallback(() => {
    startTransition(async () => {
      const res = await deleteSkillAction(skill.id)
      if (res.ok) onDeleted(skill.id)
    })
  }, [skill.id, onDeleted])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.90, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 350, damping: 25, delay: index * 0.03 }}
      className="group relative rounded-2xl border border-gray-200 bg-white p-4 hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
    >
      {/* Top accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-[3px] ${coverageColor} opacity-60`} />

      {/* Header: name + actions */}
      <div className="flex items-start justify-between gap-2 mb-3">
        {editing ? (
          <div className="flex items-center gap-1.5 flex-1 rounded-lg border-2 border-[#4F6BFF] bg-white px-2 py-1 shadow-[0_0_0_3px_rgba(79,107,255,0.10)]">
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') { setEditing(false); setEditName(skill.name) }
              }}
              onBlur={handleRename}
              maxLength={60}
              className="text-sm font-semibold text-gray-900 bg-transparent focus:outline-none flex-1 min-w-0"
              disabled={isPending}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${coverage >= 50 ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-500'}`}>
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M8 1l1.8 5.5H16l-5 3.6 1.8 5.6L8 12.3 2.2 15.7l1.8-5.6-5-3.6h6.2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-gray-900 truncate">{skill.name}</h3>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {canEdit && !editing && !confirmDelete && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
            <button type="button" onClick={() => { setEditing(true); setEditName(skill.name) }}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
              title="Hernoemen">
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"><path d="M10 2l2 2-7 7H3v-2l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
            </button>
            <button type="button" onClick={() => setConfirmDelete(true)}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
              title="Verwijderen">
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"><path d="M2.5 4h9M5.5 4V2.5h3V4M4 4v7a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
            </button>
          </div>
        )}

        {/* Delete confirmation */}
        {confirmDelete && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={handleDelete} disabled={isPending}
              className="text-[10px] font-bold text-white bg-red-500 rounded-lg px-2.5 py-1 hover:bg-red-600 transition-colors disabled:opacity-50 cursor-pointer shadow-sm">
              {isPending ? '...' : 'Verwijder'}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)}
              className="text-[10px] text-gray-500 rounded-lg px-2 py-1 hover:bg-gray-100 transition-colors cursor-pointer">
              Annuleer
            </button>
          </motion.div>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-3">
        <button type="button" onClick={() => setShowEmployees(!showEmployees)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors cursor-pointer">
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
            <path d="M9.5 12.5v-1a3 3 0 00-3-3h-2a3 3 0 00-3 3v1" /><circle cx="5.5" cy="4.5" r="2.5" />
            <path d="M14 12.5v-1a2.5 2.5 0 00-2-2.45" /><path d="M10 2.05a2.5 2.5 0 010 4.9" />
          </svg>
          <span className="font-semibold tabular-nums">{skill.employeeCount}</span>
          <span className="text-gray-400">medewerker{skill.employeeCount !== 1 ? 's' : ''}</span>
        </button>
        {skill.shiftCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
              <circle cx="7" cy="7" r="5.5" /><path d="M7 3.5v3.5l2.5 1.5" />
            </svg>
            <span className="font-semibold tabular-nums">{skill.shiftCount}</span>
            <span className="text-gray-400">shift{skill.shiftCount !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Coverage bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-gray-400 font-medium">Dekking</span>
          <span className={`text-[10px] font-bold tabular-nums ${coverageTextColor}`}>{coverage}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${coverageColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${coverage}%` }}
            transition={{ duration: 0.6, delay: 0.15 + index * 0.03, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      {/* Employee list (expandable) */}
      <AnimatePresence>
        {showEmployees && skill.employeeNames.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex flex-wrap gap-1">
                {skill.employeeNames.slice(0, 12).map((name) => (
                  <span key={name} className="text-[10px] bg-gray-50 text-gray-600 rounded-md px-1.5 py-0.5 border border-gray-100">
                    {name}
                  </span>
                ))}
                {skill.employeeNames.length > 12 && (
                  <span className="text-[10px] text-gray-400 px-1 py-0.5">+{skill.employeeNames.length - 12}</span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function SkillsManager({ skills: initial, skillsWithUsage: initialUsage, totalEmployees, canEdit = true }: Props) {
  const [skills, setSkills] = useState<Skill[]>(initial)
  const [usageData, setUsageData] = useState<SkillWithUsage[]>(initialUsage)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredSkills = search
    ? usageData.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : usageData

  // Stats
  const totalSkills = usageData.length
  const avgCoverage = totalEmployees > 0 && usageData.length > 0
    ? Math.round(usageData.reduce((sum, s) => sum + (s.employeeCount / totalEmployees), 0) / usageData.length * 100)
    : 0
  const usedByShifts = usageData.filter((s) => s.shiftCount > 0).length

  const handleCreate = useCallback(() => {
    const name = inputValue.trim()
    if (!name) return
    setError(null)
    startTransition(async () => {
      const result = await createSkillAction(name)
      if (result.ok) {
        const newSkill: Skill = { id: result.id, name: result.name, organizationId: '', createdAt: new Date() }
        setSkills((prev) => prev.find((s) => s.id === result.id) ? prev : [...prev, newSkill].sort((a, b) => a.name.localeCompare(b.name)))
        setUsageData((prev) => prev.find((s) => s.id === result.id) ? prev : [...prev, { id: result.id, name: result.name, employeeCount: 0, shiftCount: 0, employeeNames: [] }].sort((a, b) => a.name.localeCompare(b.name)))
        setInputValue('')
        inputRef.current?.focus()
      } else {
        setError(result.error)
      }
    })
  }, [inputValue])

  const handleDeleted = useCallback((id: string) => {
    setSkills((prev) => prev.filter((s) => s.id !== id))
    setUsageData((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const handleRenamed = useCallback((id: string, newName: string) => {
    setSkills((prev) => prev.map((s) => s.id === id ? { ...s, name: newName } : s).sort((a, b) => a.name.localeCompare(b.name)))
    setUsageData((prev) => prev.map((s) => s.id === id ? { ...s, name: newName } : s).sort((a, b) => a.name.localeCompare(b.name)))
  }, [])

  return (
    <div className="space-y-5">
      {/* ── Toolbar: Stats + Search + Add ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Stats chips */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-violet-50 border border-violet-100 px-3 py-1.5 text-xs font-medium text-violet-700">
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
              <path d="M7 1l1.5 4.5H13l-3.5 2.5 1.5 4.5L7 10l-4 2.5 1.5-4.5L1 5.5h4.5z" />
            </svg>
            {totalSkills} skill{totalSkills !== 1 ? 's' : ''}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-gray-50 border border-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600">
            {avgCoverage}% gem. dekking
          </span>
          {usedByShifts > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 border border-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700">
              {usedByShifts} shift-gekoppeld
            </span>
          )}
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative w-52">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Zoek..."
            className="w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/20 focus:border-[#4F6BFF]/40 transition-[border-color,box-shadow]"
          />
        </div>

        {/* Add button */}
        {canEdit && (
          <button
            type="button"
            onClick={() => { setShowAdd(!showAdd); setTimeout(() => inputRef.current?.focus(), 100) }}
            className="rounded-lg bg-gradient-to-r from-[#4F6BFF] to-[#6C83FF] text-white px-3.5 py-1.5 text-sm font-semibold shadow-[0_4px_14px_rgba(79,107,255,0.25)] hover:shadow-[0_6px_20px_rgba(79,107,255,0.35)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center gap-1.5 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            Nieuwe skill
          </button>
        )}
      </div>

      {/* ── Add skill form (collapsible) ── */}
      <AnimatePresence>
        {showAdd && canEdit && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-[#4F6BFF]/20 bg-[#4F6BFF]/[0.03] p-4">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowAdd(false) }}
                  placeholder="bv. Heftruck, EHBO, VCA, Reachtruck..."
                  maxLength={60}
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/20 focus:border-[#4F6BFF]/40"
                />
                <button type="button" onClick={handleCreate} disabled={isPending || !inputValue.trim()}
                  className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50 cursor-pointer">
                  {isPending ? '...' : 'Toevoegen'}
                </button>
                <button type="button" onClick={() => setShowAdd(false)}
                  className="rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 w-8 h-8 flex items-center justify-center transition-colors cursor-pointer">
                  <svg className="w-4 h-4" viewBox="0 0 14 14" fill="none"><path d="M10 4L4 10M4 4l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </button>
              </div>
              {error && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-xs text-red-600">{error}</motion.p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Skills grid ── */}
      {filteredSkills.length === 0 && !search ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-gray-200 bg-gray-50/30">
          <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center text-violet-400 mb-4">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 2l2.4 7.4H22l-6 4.4 2.3 7.2L12 16.5 5.7 21l2.3-7.2-6-4.4h7.6z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-700">Nog geen skills gedefinieerd</p>
          <p className="text-xs text-gray-400 mt-1 text-center max-w-[280px]">
            Skills worden gekoppeld aan medewerkers en shifts om de juiste bezetting te garanderen.
          </p>
          {canEdit && (
            <button type="button" onClick={() => { setShowAdd(true); setTimeout(() => inputRef.current?.focus(), 100) }}
              className="mt-4 rounded-lg bg-gradient-to-r from-[#4F6BFF] to-[#6C83FF] text-white px-4 py-2 text-sm font-semibold shadow-[0_4px_14px_rgba(79,107,255,0.25)] hover:shadow-[0_6px_20px_rgba(79,107,255,0.35)] transition-all duration-200 cursor-pointer">
              Eerste skill aanmaken
            </button>
          )}
        </motion.div>
      ) : filteredSkills.length === 0 && search ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-400">Geen resultaten voor &ldquo;{search}&rdquo;</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <AnimatePresence mode="popLayout">
            {filteredSkills.map((skill, i) => (
              <SkillEntityCard
                key={skill.id}
                skill={skill}
                totalEmployees={totalEmployees}
                canEdit={canEdit}
                onDeleted={handleDeleted}
                onRenamed={handleRenamed}
                index={i}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
