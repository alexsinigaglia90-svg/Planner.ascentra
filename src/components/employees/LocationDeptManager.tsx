'use client'

import { useRef, useState, useTransition } from 'react'
import { createLocationAction, createDepartmentAction } from '@/app/employees/actions'

interface NamedItem { id: string; name: string }

interface SectionProps {
  label: string
  items: NamedItem[]
  placeholder: string
  addLabel: string
  addingLabel: string
  onAdd: (name: string) => Promise<{ ok: true; id: string; name: string } | { ok: false; error: string }>
  tagClassName: string
}

function Section({ label, items, placeholder, addLabel, addingLabel, onAdd, tagClassName }: SectionProps) {
  const [current, setCurrent] = useState<NamedItem[]>(items)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const name = (inputRef.current?.value ?? '').trim()
    if (!name) return
    setError(null)
    startTransition(async () => {
      const result = await onAdd(name)
      if (result.ok) {
        setCurrent((prev) =>
          prev.find((i) => i.id === result.id)
            ? prev
            : [...prev, { id: result.id, name: result.name }].sort((a, b) =>
                a.name.localeCompare(b.name),
              ),
        )
        if (inputRef.current) inputRef.current.value = ''
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">{label}</h3>

      {current.length === 0 ? (
        <p className="text-xs text-gray-400 mb-3">
          None defined yet. Create one below.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {current.map((item) => (
            <span key={item.id} className={tagClassName}>
              {item.name}
            </span>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          maxLength={80}
          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none"
          required
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 transition-colors"
        >
          {isPending ? addingLabel : addLabel}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}

interface Props {
  locations: NamedItem[]
  departments: NamedItem[]
}

export default function LocationDeptManager({ locations, departments }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-6">
      <h2 className="text-sm font-semibold text-gray-800">Locations &amp; Departments</h2>

      <Section
        label="Locations"
        items={locations}
        placeholder="e.g. Amsterdam, Warehouse A, Site B…"
        addLabel="Add location"
        addingLabel="Adding…"
        onAdd={createLocationAction}
        tagClassName="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700"
      />

      <div className="border-t border-gray-100" />

      <Section
        label="Departments"
        items={departments}
        placeholder="e.g. Logistics, Security, Kitchen…"
        addLabel="Add department"
        addingLabel="Adding…"
        onAdd={createDepartmentAction}
        tagClassName="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700"
      />
    </div>
  )
}
