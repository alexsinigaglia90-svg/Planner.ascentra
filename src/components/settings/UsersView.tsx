'use client'

import { useTransition, useState, useRef } from 'react'
import {
  inviteUserAction,
  updateMemberRoleAction,
  updateUserStatusAction,
  removeMemberAction,
  generateInviteLinkAction,
  generateResetLinkAction,
} from '@/app/settings/users/actions'
import type { OrgMember } from '@/lib/queries/users'

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  active:   'bg-emerald-100 text-emerald-700',
  invited:  'bg-amber-100  text-amber-700',
  disabled: 'bg-gray-100   text-gray-500',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
        STATUS_STYLES[status] ?? STATUS_STYLES.disabled,
      ].join(' ')}
    >
      {status}
    </span>
  )
}

// ─── Invite link button ───────────────────────────────────────────────────────

function InviteLinkButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition()
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function handleGenerate() {
    setError(null)
    setUrl(null)
    setCopied(false)
    startTransition(async () => {
      const res = await generateInviteLinkAction(userId)
      if (res.error) {
        setError(res.error)
      } else if (res.token) {
        setUrl(`${window.location.origin}/invite/${res.token}`)
      }
    })
  }

  async function handleCopy() {
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  if (url) {
    return (
      <div className="flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5">
          <input
            readOnly
            value={url}
            className="w-48 truncate rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600 focus:outline-none"
          />
          <button
            onClick={handleCopy}
            className="shrink-0 rounded px-2 py-1 text-xs font-medium bg-gray-900 text-white hover:bg-gray-700 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <button
          onClick={() => setUrl(null)}
          className="text-xs text-gray-400 hover:text-gray-600 text-left"
        >
          Close
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleGenerate}
        disabled={isPending}
        className="rounded px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 border border-amber-200 transition-colors disabled:opacity-50"
      >
        {isPending ? 'Generating…' : 'Get activation link'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ─── Reset link button ─────────────────────────────────────────────────────

function ResetLinkButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition()
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function handleGenerate() {
    setError(null)
    setUrl(null)
    setCopied(false)
    startTransition(async () => {
      const res = await generateResetLinkAction(userId)
      if (res.error) {
        setError(res.error)
      } else if (res.token) {
        setUrl(`${window.location.origin}/reset-password/${res.token}`)
      }
    })
  }

  async function handleCopy() {
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  if (url) {
    return (
      <div className="flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5">
          <input
            readOnly
            value={url}
            className="w-48 truncate rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600 focus:outline-none"
          />
          <button
            onClick={handleCopy}
            className="shrink-0 rounded px-2 py-1 text-xs font-medium bg-gray-900 text-white hover:bg-gray-700 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <button
          onClick={() => setUrl(null)}
          className="text-xs text-gray-400 hover:text-gray-600 text-left"
        >
          Close
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleGenerate}
        disabled={isPending}
        className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors disabled:opacity-50"
      >
        {isPending ? 'Generating…' : 'Get reset link'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ─── Inline role selector ─────────────────────────────────────────────────────

function RoleSelect({
  userId,
  currentRole,
  isSelf,
}: {
  userId: string
  currentRole: string
  isSelf: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRole = e.target.value
    setError(null)
    startTransition(async () => {
      const res = await updateMemberRoleAction(userId, newRole)
      if (res.error) setError(res.error)
    })
  }

  return (
    <div className="relative">
      <select
        defaultValue={currentRole}
        onChange={handleChange}
        disabled={isPending || isSelf}
        title={isSelf ? 'You cannot change your own role here' : undefined}
        className={[
          'rounded border border-gray-200 bg-white py-1 pl-2 pr-6 text-xs font-medium text-gray-700',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 transition-opacity',
          isPending || isSelf ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-300',
        ].join(' ')}
      >
        <option value="admin">Admin</option>
        <option value="planner">Planner</option>
        <option value="viewer">Viewer</option>
      </select>
      {error && (
        <p className="absolute top-full left-0 mt-1 rounded bg-red-50 border border-red-200 px-2 py-1 text-xs text-red-600 whitespace-nowrap z-10">
          {error}
        </p>
      )}
    </div>
  )
}

// ─── Inline status selector ───────────────────────────────────────────────────

function StatusSelect({
  userId,
  currentStatus,
  isSelf,
}: {
  userId: string
  currentStatus: string
  isSelf: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value
    setError(null)
    startTransition(async () => {
      const res = await updateUserStatusAction(userId, newStatus)
      if (res.error) setError(res.error)
    })
  }

  return (
    <div className="relative">
      <select
        defaultValue={currentStatus}
        onChange={handleChange}
        disabled={isPending || isSelf}
        title={isSelf ? 'You cannot change your own status' : undefined}
        className={[
          'rounded border border-gray-200 bg-white py-1 pl-2 pr-6 text-xs font-medium text-gray-700',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 transition-opacity',
          isPending || isSelf ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-300',
        ].join(' ')}
      >
        <option value="active">Active</option>
        <option value="invited">Invited</option>
        <option value="disabled">Disabled</option>
      </select>
      {error && (
        <p className="absolute top-full left-0 mt-1 rounded bg-red-50 border border-red-200 px-2 py-1 text-xs text-red-600 whitespace-nowrap z-10">
          {error}
        </p>
      )}
    </div>
  )
}

// ─── Remove button ────────────────────────────────────────────────────────────

function RemoveButton({ userId, isSelf }: { userId: string; isSelf: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  if (isSelf) {
    return <span className="text-xs text-gray-300 select-none">—</span>
  }

  function handleClick() {
    if (!confirmed) {
      setConfirmed(true)
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await removeMemberAction(userId)
      if (res.error) {
        setError(res.error)
        setConfirmed(false)
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={isPending}
        className={[
          'rounded px-2 py-1 text-xs font-medium transition-colors',
          confirmed
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'text-gray-400 hover:text-red-600 hover:bg-red-50',
          isPending ? 'opacity-50 cursor-not-allowed' : '',
        ].join(' ')}
      >
        {isPending ? '…' : confirmed ? 'Confirm remove' : 'Remove'}
      </button>
      {confirmed && !isPending && (
        <button
          onClick={() => setConfirmed(false)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ─── Invite form ──────────────────────────────────────────────────────────────

function InviteForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const res = await inviteUserAction(fd)
      if (res.error) {
        setError(res.error)
      } else {
        setSuccess(true)
        formRef.current?.reset()
      }
    })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">Add user</h2>
      <form ref={formRef} onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Name */}
        <div>
          <label htmlFor="invite-name" className="block text-xs font-medium text-gray-600 mb-1">
            Full name <span className="text-red-500">*</span>
          </label>
          <input
            id="invite-name"
            name="name"
            type="text"
            required
            autoComplete="off"
            placeholder="Jane Smith"
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="invite-email" className="block text-xs font-medium text-gray-600 mb-1">
            Email address <span className="text-red-500">*</span>
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            autoComplete="off"
            placeholder="jane@company.com"
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Role */}
        <div>
          <label htmlFor="invite-role" className="block text-xs font-medium text-gray-600 mb-1">
            Role
          </label>
          <select
            id="invite-role"
            name="role"
            defaultValue="viewer"
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="viewer">Viewer</option>
            <option value="planner">Planner</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {/* Status */}
        <div>
          <label htmlFor="invite-status" className="block text-xs font-medium text-gray-600 mb-1">
            Initial status
          </label>
          <select
            id="invite-status"
            name="status"
            defaultValue="invited"
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="invited">Invited (pending login)</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        {/* Password (optional) */}
        <div className="sm:col-span-2">
          <label htmlFor="invite-password" className="block text-xs font-medium text-gray-600 mb-1">
            Initial password{' '}
            <span className="text-gray-400 font-normal">(optional — min 8 characters)</span>
          </label>
          <input
            id="invite-password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Leave blank to set later"
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Feedback + submit row */}
        <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-h-[1.25rem]">
            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 4.25a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 1.5 0v-3.5zM8 11a.875.875 0 1 0 0-1.75A.875.875 0 0 0 8 11z" />
                </svg>
                {error}
              </p>
            )}
            {success && (
              <p className="text-sm text-emerald-600 flex items-center gap-1">
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm3.03 4.47a.75.75 0 0 1 0 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06l.97.97 2.97-2.97a.75.75 0 0 1 1.06 0z" />
                </svg>
                User created successfully.
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="shrink-0 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Creating…' : 'Create user'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  members: OrgMember[]
  currentUserId: string
}

export default function UsersView({ members, currentUserId }: Props) {
  return (
    <div className="max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">User management</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage team members, roles, and account status for your organization.
        </p>
      </div>

      {/* Members table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Members
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 font-normal">
              {members.length}
            </span>
          </h2>
        </div>

        {members.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            No members found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="bg-gray-50">
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Activation
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {members.map((member) => {
                  const isSelf = member.userId === currentUserId
                  const joined = new Date(member.membershipCreatedAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                  const initials = member.name
                    .split(' ')
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()

                  return (
                    <tr key={member.userId} className="hover:bg-gray-50/60 transition-colors">
                      {/* User cell */}
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white select-none">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 truncate">
                                {member.name}
                              </span>
                              {isSelf && (
                                <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-600 font-medium">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 truncate">{member.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role cell */}
                      <td className="px-4 py-3.5">
                        <RoleSelect
                          userId={member.userId}
                          currentRole={member.role}
                          isSelf={isSelf}
                        />
                      </td>

                      {/* Status cell */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={member.status} />
                          <StatusSelect
                            userId={member.userId}
                            currentStatus={member.status}
                            isSelf={isSelf}
                          />
                        </div>
                      </td>

                      {/* Joined cell */}
                      <td className="px-4 py-3.5 text-xs text-gray-400 whitespace-nowrap">
                        {joined}
                      </td>

                      {/* Activation cell */}
                      <td className="px-4 py-3.5">
                        {member.status === 'invited' ? (
                          <InviteLinkButton userId={member.userId} />
                        ) : member.status === 'active' ? (
                          <ResetLinkButton userId={member.userId} />
                        ) : (
                          <span className="text-xs text-gray-300 select-none">—</span>
                        )}
                      </td>

                      {/* Actions cell */}
                      <td className="px-4 py-3.5 text-right">
                        <RemoveButton userId={member.userId} isSelf={isSelf} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite form */}
      <InviteForm />
    </div>
  )
}
