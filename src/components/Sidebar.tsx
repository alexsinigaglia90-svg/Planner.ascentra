'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import NotificationBell from '@/components/NotificationBell'
import type { NotificationRow } from '@/lib/queries/notifications'

interface NavItem {
  label: string
  href: string
  adminOnly?: boolean
}

interface NavGroup {
  label: string | null
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: null,
    items: [
      { label: 'Dashboard', href: '/dashboard' },
    ],
  },
  {
    label: 'Planning',
    items: [
      { label: 'Planner', href: '/planning' },
    ],
  },
  {
    label: 'Workforce Setup',
    items: [
      { label: 'Departments',      href: '/settings/masterdata?section=departments', adminOnly: true },
      { label: 'Functions',        href: '/settings/masterdata?section=functions',   adminOnly: true },
      { label: 'Processes',        href: '/settings/processes',                      adminOnly: true },
      { label: 'Skills',           href: '/workforce/skills?section=skills' },
      { label: 'Skill Matrix',     href: '/workforce/skills?section=matrix' },
      { label: 'Employees',        href: '/workforce/employees' },
      { label: 'Teams',            href: '/settings/teams',                          adminOnly: true },
      { label: 'Shift Templates',  href: '/shifts' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Audit Log', href: '/audit' },
    ],
  },
]

interface Props {
  userName?: string | null
  userEmail?: string | null
  role?: string | null
  unreadCount?: number
  notifications?: NotificationRow[]
}

export default function Sidebar({ userName, userEmail, role, unreadCount, notifications }: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleSignOut() {
    startTransition(async () => {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    })
  }

  // Derive initials for the avatar
  const initials = userName
    ? userName
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?'

  function renderItems(items: NavItem[]) {
    return items
      .filter((item) => !item.adminOnly || role === 'admin')
      .map((item) => {
        const [itemPath, itemQuery] = item.href.split('?')
        const itemParams = itemQuery ? new URLSearchParams(itemQuery) : null
        const pathMatches = pathname === itemPath || pathname.startsWith(itemPath + '/')
        const queryMatches = itemParams
          ? [...itemParams.entries()].every(([k, v]) => searchParams.get(k) === v)
          : !searchParams.has('section')
        const isActive = pathMatches && queryMatches
        return (
          <Link
            key={item.label}
            href={item.href}
            className={[
              'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-white/10 text-white'
                : 'text-gray-400 hover:bg-white/5 hover:text-white',
            ].join(' ')}
          >
            {item.label}
          </Link>
        )
      })
  }

  return (
    <aside
      className="flex w-60 flex-col shrink-0 border-r"
      style={{ background: '#111318', borderColor: 'rgba(255,255,255,0.06)' }}
    >
      <div className="px-5 py-5 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div>
          <span className="text-base font-semibold tracking-tight" style={{ color: '#FFFFFF' }}>
            Planner
          </span>
          <span className="ml-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
            Ascentra
          </span>
        </div>
        <NotificationBell initialCount={unreadCount ?? 0} notifications={notifications ?? []} />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navGroups.map((group, i) => {
          const visibleItems = group.items.filter(
            (item) => !item.adminOnly || role === 'admin',
          )
          if (visibleItems.length === 0) return null
          return (
            <div key={group.label ?? 'top'} className={i > 0 ? 'pt-4' : undefined}>
              {group.label && (
                <p className="px-3 mb-1 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {group.label}
                </p>
              )}
              {renderItems(group.items)}
            </div>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg group">
          {/* Avatar */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
            {initials}
          </div>
          {/* Name / email */}
          <div className="min-w-0 flex-1">
            {userName && (
              <p className="truncate text-sm font-medium text-white leading-tight">{userName}</p>
            )}
            {userEmail && (
              <p className="truncate text-xs text-gray-400 leading-tight">{userEmail}</p>
            )}
          </div>
          {/* Sign out */}
          <button
            onClick={handleSignOut}
            disabled={isPending}
            title="Sign out"
            aria-label="Sign out"
            className="shrink-0 rounded-md p-1.5 text-gray-500 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10 11l3-3-3-3M13 8H6"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}

