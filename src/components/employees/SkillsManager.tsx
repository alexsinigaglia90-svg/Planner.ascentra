'use client'

import { useRef, useState, useTransition, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Skill } from '@/lib/queries/skills'
import { createSkillAction, deleteSkillAction, renameSkillAction } from '@/app/employees/actions'

interface Props {
  skills: Skill[]
  canEdit?: boolean
}

// ── Skill Card ───────────────────────────────────────────────────────────────

function SkillCard({
  skill,
  canEdit,
  onDeleted,
  onRenamed,
}: {
  skill: Skill
  canEdit: boolean
  onDeleted: (id: string) => void
  onRenamed: (id: string, newName: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(skill.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleRename = useCallback(() => {
    const trimmed = editName.trim()
    if (!trimmed || trimmed === skill.name) {
      setEditing(false)
      setEditName(skill.name)
      return
    }
    startTransition(async () => {
      const res = await renameSkillAction(skill.id, trimmed)
      if (res.ok) {
        onRenamed(skill.id, res.name)
        setEditing(false)
      }
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
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="group relative"
    >
      {editing ? (
        <div className="flex items-center gap-1.5 rounded-xl border-2 border-[#4F6BFF] bg-white px-2.5 py-1.5 shadow-[0_0_0_3px_rgba(79,107,255,0.12)]">
          <input
            ref={inputRef}
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename()
              if (e.key === 'Escape') { setEditing(false); setEditName(skill.name) }
            }}
            onBlur={handleRename}
            maxLength={60}
            className="text-sm font-medium text-gray-900 bg-transparent focus:outline-none min-w-[60px] w-full"
            disabled={isPending}
          />
          {isPending && (
            <svg className="w-3.5 h-3.5 text-gray-400 animate-spin shrink-0" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
              <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 hover:border-gray-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200">
          {/* Color dot */}
          <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />

          {/* Skill name */}
          <span className="text-sm font-medium text-gray-800 px-1">{skill.name}</span>

          {/* Action buttons — visible on hover */}
          {canEdit && !confirmDelete && (
            <div className="flex items-center gap-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <button
                type="button"
                onClick={() => { setEditing(true); setEditName(skill.name) }}
                className="flex items-center justify-center w-6 h-6 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                title="Hernoemen"
              >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"><path d="M8 2l2 2-6 6H2v-2l6-6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center justify-center w-6 h-6 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                title="Verwijderen"
              >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"><path d="M2 3.5h8M5 3.5V2.5h2v1M4 3.5v5.5c0 .3.2.5.5.5h3c.3 0 .5-.2.5-.5V3.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /></svg>
              </button>
            </div>
          )}

          {/* Delete confirmation */}
          {confirmDelete && (
            <div className="flex items-center gap-1 ml-auto">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="text-[10px] font-bold text-red-600 bg-red-50 rounded-md px-2 py-0.5 hover:bg-red-100 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isPending ? '...' : 'Verwijder'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-[10px] text-gray-500 rounded-md px-1.5 py-0.5 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Annuleer
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function SkillsManager({ skills: initial, canEdit = true }: Props) {
  const [skills, setSkills] = useState<Skill[]>(initial)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredSkills = search
    ? skills.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : skills

  const handleCreate = useCallback(() => {
    const name = inputValue.trim()
    if (!name) return
    setError(null)
    startTransition(async () => {
      const result = await createSkillAction(name)
      if (result.ok) {
        setSkills((prev) =>
          prev.find((s) => s.id === result.id)
            ? prev
            : [...prev, { id: result.id, name: result.name, organizationId: '', createdAt: new Date() }]
                .sort((a, b) => a.name.localeCompare(b.name)),
        )
        setInputValue('')
        inputRef.current?.focus()
      } else {
        setError(result.error)
      }
    })
  }, [inputValue])

  const handleDeleted = useCallback((id: string) => {
    setSkills((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const handleRenamed = useCallback((id: string, newName: string) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name: newName } : s))
        .sort((a, b) => a.name.localeCompare(b.name)),
    )
  }, [])

  return (
    <div className="space-y-5">
      {/* Header + stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Skills & Competenties</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {skills.length} skill{skills.length !== 1 ? 's' : ''} gedefinieerd
          </p>
        </div>
      </div>

      {/* Search */}
      {skills.length > 5 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Zoek skill..."
              className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/20 focus:border-[#4F6BFF]/40 transition-[border-color,box-shadow]"
            />
          </div>
        </motion.div>
      )}

      {/* Skills grid */}
      {filteredSkills.length === 0 && !search ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-12 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50">
          <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center text-violet-400 mb-3">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 2l2.4 7.4H22l-6 4.4 2.3 7.2L12 16.5 5.7 21l2.3-7.2-6-4.4h7.6z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-600">Nog geen skills</p>
          <p className="text-xs text-gray-400 mt-1 text-center max-w-[240px]">
            Maak skills aan en koppel ze aan medewerkers en shift templates.
          </p>
        </motion.div>
      ) : filteredSkills.length === 0 && search ? (
        <p className="text-sm text-gray-400 text-center py-6">Geen resultaten voor &ldquo;{search}&rdquo;</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <AnimatePresence mode="popLayout">
            {filteredSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                canEdit={canEdit}
                onDeleted={handleDeleted}
                onRenamed={handleRenamed}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add skill form */}
      {canEdit && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border border-gray-200 bg-white p-4"
        >
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Nieuwe skill toevoegen</p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
                placeholder="bv. Heftruck, EHBO, VCA..."
                maxLength={60}
                className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/20 focus:border-[#4F6BFF]/40 transition-[border-color,box-shadow]"
              />
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={isPending || !inputValue.trim()}
              className="rounded-xl bg-gradient-to-r from-[#4F6BFF] to-[#6C83FF] text-white px-4 py-2.5 text-sm font-semibold shadow-[0_4px_14px_rgba(79,107,255,0.25)] hover:shadow-[0_6px_20px_rgba(79,107,255,0.35)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:hover:transform-none cursor-pointer"
            >
              {isPending ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
                  <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : 'Toevoegen'}
            </button>
          </div>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="mt-2 text-xs text-red-600"
            >
              {error}
            </motion.p>
          )}
        </motion.div>
      )}
    </div>
  )
}
