'use client'

import { useState, useTransition } from 'react'
import type { TeamWithSlots } from '@/lib/queries/teams'
import type { ShiftTemplate } from '@/lib/queries/shiftTemplates'
import {
  createTeamAction,
  updateTeamAction,
  deleteTeamAction,
  setTeamRotationSlotsAction,
} from '@/app/settings/teams/actions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the ISO Monday of today as YYYY-MM-DD. */
function currentMonday(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Team color dot ───────────────────────────────────────────────────────────

function ColorDot({ color }: { color: string | null }) {
  return (
    <span
      className="inline-block w-3 h-3 rounded-full border border-white/20 shrink-0"
      style={{ background: color ?? '#6b7280' }}
    />
  )
}

// ─── Rotation slots editor ────────────────────────────────────────────────────

interface RotationEditorProps {
  teamId: string
  rotationLength: number
  initialSlots: TeamWithSlots['rotationSlots']
  shiftTemplates: ShiftTemplate[]
  onSaved: () => void
}

function RotationEditor({
  teamId,
  rotationLength,
  initialSlots,
  shiftTemplates,
  onSaved,
}: RotationEditorProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Build a mapping weekOffset → shiftTemplateId (mutable local state)
  const [slots, setSlots] = useState<Record<number, string>>(() => {
    const map: Record<number, string> = {}
    for (const s of initialSlots) map[s.weekOffset] = s.shiftTemplateId
    return map
  })

  function handleChange(weekOffset: number, shiftTemplateId: string) {
    setSlots((prev) => ({ ...prev, [weekOffset]: shiftTemplateId }))
  }

  function handleSave() {
    setError(null)
    const slotsArray = Array.from({ length: rotationLength }, (_, i) => ({
      weekOffset: i,
      shiftTemplateId: slots[i] ?? '',
    })).filter((s) => s.shiftTemplateId !== '')

    startTransition(async () => {
      const res = await setTeamRotationSlotsAction(teamId, slotsArray)
      if (!res.ok) {
        setError(res.error)
      } else {
        onSaved()
      }
    })
  }

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
        Rotation schedule ({rotationLength}-week cycle)
      </p>
      <div className="space-y-2">
        {Array.from({ length: rotationLength }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-sm font-medium text-gray-500">
              Week {i + 1}
            </span>
            <select
              value={slots[i] ?? ''}
              onChange={(e) => handleChange(i, e.target.value)}
              className="flex-1 rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="">— not assigned —</option>
              {shiftTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.startTime}–{t.endTime})
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <button
        onClick={handleSave}
        disabled={isPending}
        className="mt-3 rounded bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Saving…' : 'Save rotation'}
      </button>
    </div>
  )
}

// ─── Team row ─────────────────────────────────────────────────────────────────

interface TeamRowProps {
  team: TeamWithSlots
  shiftTemplates: ShiftTemplate[]
  onDeleted: (id: string) => void
  onUpdated: () => void
}

function TeamRow({ team, shiftTemplates, onDeleted, onUpdated }: TeamRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [editName, setEditName] = useState(team.name)
  const [editColor, setEditColor] = useState(team.color ?? '#6b7280')
  const [editAnchor, setEditAnchor] = useState(team.rotationAnchorDate)
  const [editLength, setEditLength] = useState(String(team.rotationLength))

  function handleDelete() {
    if (!confirm(`Delete team "${team.name}"? Employees in this team will be unassigned.`)) return
    setDeleteError(null)
    startTransition(async () => {
      const res = await deleteTeamAction(team.id)
      if (!res.ok) setDeleteError(res.error)
      else onDeleted(team.id)
    })
  }

  function handleSaveEdit() {
    setEditError(null)
    const length = parseInt(editLength, 10)
    startTransition(async () => {
      const res = await updateTeamAction(team.id, {
        name: editName,
        color: editColor,
        rotationAnchorDate: editAnchor,
        rotationLength: length,
      })
      if (!res.ok) {
        setEditError(res.error)
      } else {
        setEditing(false)
        onUpdated()
      }
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-3 px-4 py-3">
        <ColorDot color={team.color} />
        {editing ? (
          <div className="flex-1 grid grid-cols-2 gap-2 text-sm">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Team name"
              className="col-span-2 rounded border border-gray-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 shrink-0">Color</label>
              <input
                type="color"
                value={editColor}
                onChange={(e) => setEditColor(e.target.value)}
                className="h-7 w-10 cursor-pointer rounded border border-gray-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 shrink-0">Weeks</label>
              <input
                type="number"
                min={1}
                max={52}
                value={editLength}
                onChange={(e) => setEditLength(e.target.value)}
                className="w-16 rounded border border-gray-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <label className="text-xs text-gray-500 shrink-0">Anchor (Monday)</label>
              <input
                type="date"
                value={editAnchor}
                onChange={(e) => setEditAnchor(e.target.value)}
                className="rounded border border-gray-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            {editError && (
              <p className="col-span-2 text-xs text-red-600">{editError}</p>
            )}
            <div className="col-span-2 flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={isPending}
                className="rounded bg-gray-900 px-3 py-1 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => { setEditing(false); setEditError(null) }}
                className="rounded border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{team.name}</p>
              <p className="text-xs text-gray-500">
                {team.rotationLength}-week cycle · anchor {team.rotationAnchorDate}
                {' · '}{team.rotationSlots.length} slot{team.rotationSlots.length !== 1 ? 's' : ''} configured
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="rounded px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50"
              >
                {expanded ? 'Hide rotation' : 'Edit rotation'}
              </button>
              <button
                onClick={() => { setEditing(true); setExpanded(false) }}
                className="rounded px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="rounded px-2.5 py-1 text-xs font-medium text-red-600 border border-red-100 hover:bg-red-50 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
      {deleteError && (
        <p className="px-4 pb-3 text-xs text-red-600">{deleteError}</p>
      )}
      {expanded && !editing && (
        <div className="border-t border-gray-100 px-4 pb-4">
          <RotationEditor
            teamId={team.id}
            rotationLength={team.rotationLength}
            initialSlots={team.rotationSlots}
            shiftTemplates={shiftTemplates}
            onSaved={onUpdated}
          />
        </div>
      )}
    </div>
  )
}

// ─── New team form ────────────────────────────────────────────────────────────

interface NewTeamFormProps {
  onCreated: (team: { id: string; name: string }) => void
}

function NewTeamForm({ onCreated }: NewTeamFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [rotationLength, setRotationLength] = useState('3')
  const [anchorDate, setAnchorDate] = useState(currentMonday)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const length = parseInt(rotationLength, 10)
    startTransition(async () => {
      const res = await createTeamAction({
        name,
        color,
        rotationAnchorDate: anchorDate,
        rotationLength: length,
      })
      if (!res.ok) {
        setError(res.error)
      } else {
        setName('')
        setRotationLength('3')
        onCreated({ id: res.id, name })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
      <p className="text-sm font-semibold text-gray-700 mb-3">New team</p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="col-span-2 flex gap-3">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Team name (e.g. Ploeg A)"
            className="flex-1 rounded border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-xs text-gray-500">Color</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-gray-200"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Rotation length (weeks)</label>
          <input
            type="number"
            required
            min={1}
            max={52}
            value={rotationLength}
            onChange={(e) => setRotationLength(e.target.value)}
            className="rounded border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Anchor date (a Monday)</label>
          <input
            type="date"
            required
            value={anchorDate}
            onChange={(e) => setAnchorDate(e.target.value)}
            className="rounded border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="mt-3 rounded bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Creating…' : 'Create team'}
      </button>
    </form>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

interface Props {
  teams: TeamWithSlots[]
  shiftTemplates: ShiftTemplate[]
}

export default function TeamsView({ teams: initialTeams, shiftTemplates }: Props) {
  const [teams, setTeams] = useState(initialTeams)

  function handleCreated(_info: { id: string; name: string }) {
    // Full reload via revalidatePath has already happened server-side.
    // We reload the page for simplicity to pick up the new team with slots.
    window.location.reload()
  }

  function handleDeleted(id: string) {
    setTeams((prev) => prev.filter((t) => t.id !== id))
  }

  function handleUpdated() {
    window.location.reload()
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Teams</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create teams (ploegen) and configure their rotating shift schedules. Employees assigned
          to a team will be flagged when planned outside their rotation week.
        </p>
      </div>

      <div className="space-y-3 mb-8">
        {teams.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No teams yet.</p>
        ) : (
          teams.map((team) => (
            <TeamRow
              key={team.id}
              team={team}
              shiftTemplates={shiftTemplates}
              onDeleted={handleDeleted}
              onUpdated={handleUpdated}
            />
          ))
        )}
      </div>

      <NewTeamForm onCreated={handleCreated} />
    </div>
  )
}
