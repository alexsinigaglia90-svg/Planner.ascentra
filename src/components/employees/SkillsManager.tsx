'use client'

import { useRef, useState, useTransition } from 'react'
import type { Skill } from '@/lib/queries/skills'
import { createSkillAction } from '@/app/employees/actions'

interface Props {
  skills: Skill[]
}

export default function SkillsManager({ skills: initial }: Props) {
  const [skills, setSkills] = useState<Skill[]>(initial)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const name = (inputRef.current?.value ?? '').trim()
    if (!name) return
    setError(null)
    startTransition(async () => {
      const result = await createSkillAction(name)
      if (result.ok) {
        // Only add if not already present (upsert is idempotent)
        setSkills((prev) =>
          prev.find((s) => s.id === result.id)
            ? prev
            : [...prev, { id: result.id, name: result.name, organizationId: '', createdAt: new Date() }].sort(
                (a, b) => a.name.localeCompare(b.name),
              ),
        )
        if (inputRef.current) inputRef.current.value = ''
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Skills / functions</h2>

      {skills.length === 0 ? (
        <p className="text-xs text-gray-400 mb-3">
          No skills defined yet. Create one below — then assign it to employees and shift templates.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {skills.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700"
            >
              {s.name}
            </span>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          placeholder="e.g. Forklift, Security, First Aid…"
          maxLength={60}
          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none"
          required
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Adding…' : 'Add skill'}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
