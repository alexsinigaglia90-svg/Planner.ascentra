'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTransition } from 'react'
import NotificationBell from '@/components/NotificationBell'
import type { NotificationRow } from '@/lib/queries/notifications'

const navItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Planning', href: '/planning' },
  { label: 'Employees', href: '/employees' },
  { label: 'Shifts', href: '/shifts' },
  { label: 'Audit Log', href: '/audit' },
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

  return (
    <aside className="flex w-60 flex-col bg-gray-900 text-white shrink-0">
      <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
        <div>
          <span className="text-base font-semibold tracking-tight text-white">
            Planner
          </span>
          <span className="ml-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
            Ascentra
          </span>
        </div>
        <NotificationBell initialCount={unreadCount ?? 0} notifications={notifications ?? []} />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
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
        })}

        {/* Workforce section */}
        <div className="pt-4">
          <p className="px-3 mb-1 text-xs font-semibold text-gray-600 uppercase tracking-wider">
            Workforce
          </p>
          {[{ label: 'Employees', href: '/workforce/employees' }].map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
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
          })}
        </div>

        {/* Admin-only: Settings section */}
        {role === 'admin' && (
          <div className="pt-4">
            <p className="px-3 mb-1 text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Settings
            </p>
            {[{ label: 'Users', href: '/settings/users' }, { label: 'Teams', href: '/settings/teams' }, { label: 'Delivery Log', href: '/settings/delivery' }].map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
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
            })}
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-white/10">
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

