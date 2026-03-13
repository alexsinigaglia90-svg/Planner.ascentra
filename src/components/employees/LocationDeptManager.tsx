'use client'

import { useRef, useState, useTransition } from 'react'
import { createLocationAction, createDepartmentAction, createSubdepartmentAction } from '@/app/employees/actions'
import type { DepartmentWithChildren } from '@/lib/queries/locations'

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

// Minimal add-only form (no tag list)
interface AddFormProps {
  placeholder: string
  addLabel: string
  addingLabel: string
  onAdd: (name: string) => Promise<{ ok: true; id: string; name: string } | { ok: false; error: string }>
}

function AddForm({ placeholder, addLabel, addingLabel, onAdd }: AddFormProps) {
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
        if (inputRef.current) inputRef.current.value = ''
      } else {
        setError(result.error)
      }
    })
  }

  return (
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
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </form>
  )
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
  departments: DepartmentWithChildren[]
}

export default function LocationDeptManager({ locations, departments: initialDepts }: Props) {
  const [deptTree, setDeptTree] = useState<DepartmentWithChildren[]>(initialDepts)
  const [addingSubdeptFor, setAddingSubdeptFor] = useState<string | null>(null)
  const [subdeptName, setSubdeptName] = useState('')
  const [subdeptPending, startSubdeptTransition] = useTransition()
  const [subdeptError, setSubdeptError] = useState<string | null>(null)

  function handleAddTopLevelDept(id: string, name: string) {
    setDeptTree((prev) =>
      [...prev, { id, name, organizationId: '', archived: false, parentDepartmentId: null, createdAt: new Date(), children: [] }].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    )
  }

  function handleAddSubdept(parentId: string) {
    const name = subdeptName.trim()
    if (!name) return
    setSubdeptError(null)
    startSubdeptTransition(async () => {
      const result = await createSubdepartmentAction(name, parentId)
      if (result.ok) {
        setDeptTree((prev) =>
          prev.map((d) =>
            d.id !== parentId
              ? d
              : {
                  ...d,
                  children: [...d.children, { id: result.id, name: result.name, organizationId: '', archived: false, parentDepartmentId: parentId, createdAt: new Date() }].sort((a, b) =>
                    a.name.localeCompare(b.name),
                  ),
                },
          ),
        )
        setSubdeptName('')
        setAddingSubdeptFor(null)
      } else {
        setSubdeptError(result.error)
      }
    })
  }

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

      {/* Departments hierarchy */}
      <div>
        <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Departments</h3>
        {deptTree.length === 0 ? (
          <p className="text-xs text-gray-400 mb-3">None defined yet. Create one below.</p>
        ) : (
          <div className="flex flex-col gap-2 mb-3">
            {deptTree.map((dept) => (
              <div key={dept.id}>
                {/* Parent tag */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                    {dept.name}
                  </span>
                  <button
                    onClick={() => { setAddingSubdeptFor(dept.id); setSubdeptName(''); setSubdeptError(null) }}
                    className="text-xs text-gray-400 hover:text-amber-600 transition-colors"
                    title="Add subdepartment"
                  >
                    + sub
                  </button>
                </div>
                {/* Children indented */}
                {dept.children.length > 0 && (
                  <div className="ml-5 mt-1 flex flex-wrap gap-1.5">
                    {dept.children.map((child) => (
                      <span key={child.id} className="inline-flex items-center rounded-full bg-amber-50/60 border border-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-600">
                        {child.name}
                      </span>
                    ))}
                  </div>
                )}
                {/* Inline subdept add form */}
                {addingSubdeptFor === dept.id && (
                  <div className="ml-5 mt-1.5 flex items-center gap-2">
                    <input
                      autoFocus
                      value={subdeptName}
                      onChange={(e) => setSubdeptName(e.target.value)}
                      placeholder="Subdepartment name"
                      maxLength={80}
                      className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleAddSubdept(dept.id) }
                        if (e.key === 'Escape') { setAddingSubdeptFor(null) }
                      }}
                    />
                    <button
                      disabled={subdeptPending}
                      onClick={() => handleAddSubdept(dept.id)}
                      className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      {subdeptPending ? 'Adding\u2026' : 'Add'}
                    </button>
                    <button
                      onClick={() => { setAddingSubdeptFor(null); setSubdeptError(null) }}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                    {subdeptError && <p className="text-xs text-red-600">{subdeptError}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Top-level department add form */}
        <AddForm
          placeholder="e.g. Logistics, Security, Kitchen…"
          addLabel="Add department"
          addingLabel="Adding…"
          onAdd={async (name) => {
            const result = await createDepartmentAction(name)
            if (result.ok) handleAddTopLevelDept(result.id, result.name)
            return result
          }}
        />
      </div>
    </div>
  )
}
