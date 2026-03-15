'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import NotificationBell from '@/components/NotificationBell'
import type { NotificationRow } from '@/lib/queries/notifications'
import {
  Sidebar as SidebarRoot,
  SidebarBody,
  SidebarLink,
  SidebarLabel,
  useSidebar,
} from '@/components/ui/sidebar'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  CalendarRange,
  Building2,
  Briefcase,
  Cog,
  Gem,
  TableProperties,
  Users,
  UsersRound,
  Clock,
  ScrollText,
  LogOut,
} from 'lucide-react'

// ── Navigation definition ──────────────────────────────────────────────────────

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  adminOnly?: boolean
}

interface NavGroup {
  label: string | null
  items: NavItem[]
}

const iconClass = 'h-4 w-4 flex-shrink-0'

const navGroups: NavGroup[] = [
  {
    label: null,
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className={iconClass} /> },
    ],
  },
  {
    label: 'Planning',
    items: [
      { label: 'Planner', href: '/planning', icon: <CalendarRange className={iconClass} /> },
    ],
  },
  {
    label: 'Workforce Setup',
    items: [
      { label: 'Departments',     href: '/settings/masterdata?section=departments', icon: <Building2 className={iconClass} />,      adminOnly: true },
      { label: 'Functions',       href: '/settings/masterdata?section=functions',   icon: <Briefcase className={iconClass} />,      adminOnly: true },
      { label: 'Processes',       href: '/settings/processes',                      icon: <Cog className={iconClass} />,            adminOnly: true },
      { label: 'Skills',          href: '/workforce/skills?section=skills',         icon: <Gem className={iconClass} /> },
      { label: 'Skill Matrix',    href: '/workforce/skills?section=matrix',         icon: <TableProperties className={iconClass} /> },
      { label: 'Employees',       href: '/workforce/employees',                     icon: <Users className={iconClass} /> },
      { label: 'Teams',           href: '/settings/teams',                          icon: <UsersRound className={iconClass} />,     adminOnly: true },
      { label: 'Shift Templates', href: '/shifts',                                  icon: <Clock className={iconClass} /> },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Audit Log', href: '/audit', icon: <ScrollText className={iconClass} /> },
    ],
  },
]

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  userName?: string | null
  userEmail?: string | null
  role?: string | null
  unreadCount?: number
  notifications?: NotificationRow[]
}

// ── Logo components ────────────────────────────────────────────────────────────

function AscentraIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className="flex-shrink-0">
      <circle cx="50" cy="50" r="48" fill="#1B2A4A" />
      <path d="M50 18L26 78C30 68 40 64 50 68C60 72 68 78 74 78L50 18Z" fill="white" />
      <path d="M50 38L40 58H60L50 38Z" fill="#1B2A4A" />
    </svg>
  )
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <AscentraIcon size={26} />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-semibold text-sm text-white whitespace-pre tracking-tight"
      >
        Planner{' '}
        <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
          Ascentra
        </span>
      </motion.span>
    </div>
  )
}

function LogoIcon() {
  return (
    <div className="flex items-center py-1">
      <AscentraIcon size={26} />
    </div>
  )
}

// ── Inner content (needs sidebar context) ──────────────────────────────────────

function SidebarContent({ userName, userEmail, role, unreadCount, notifications }: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { open } = useSidebar()

  const initials = userName
    ? userName
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?'

  function handleSignOut() {
    startTransition(async () => {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    })
  }

  function isActive(href: string) {
    const [itemPath, itemQuery] = href.split('?')
    const itemParams = itemQuery ? new URLSearchParams(itemQuery) : null
    const pathMatches = pathname === itemPath || pathname.startsWith(itemPath + '/')
    const queryMatches = itemParams
      ? [...itemParams.entries()].every(([k, v]) => searchParams.get(k) === v)
      : !searchParams.has('section')
    return pathMatches && queryMatches
  }

  return (
    <SidebarBody
      className="border-r justify-between gap-6"
      style={{ background: '#111318', borderColor: 'rgba(255,255,255,0.06)' }}
    >
      {/* Top section */}
      <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        {/* Header: Logo + Notifications */}
        <div className="flex items-center justify-between mb-6 px-0.5">
          {open ? <Logo /> : <LogoIcon />}
          {open && (
            <NotificationBell
              initialCount={unreadCount ?? 0}
              notifications={notifications ?? []}
            />
          )}
        </div>

        {/* Nav groups */}
        <nav className="flex flex-col gap-1">
          {navGroups.map((group, i) => {
            const visibleItems = group.items.filter(
              (item) => !item.adminOnly || role === 'admin',
            )
            if (visibleItems.length === 0) return null
            return (
              <div key={group.label ?? 'top'} className={i > 0 ? 'mt-4' : undefined}>
                {group.label && <SidebarLabel>{group.label}</SidebarLabel>}
                {visibleItems.map((item) => (
                  <SidebarLink
                    key={item.label}
                    link={item}
                    active={isActive(item.href)}
                  />
                ))}
              </div>
            )
          })}
        </nav>
      </div>

      {/* User footer */}
      <div className="border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg group">
          {/* Avatar */}
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1B2A4A] text-[10px] font-bold text-white">
            {initials}
          </div>
          {/* Name / email — hidden when collapsed */}
          <motion.div
            animate={{
              display: open ? 'block' : 'none',
              opacity: open ? 1 : 0,
            }}
            transition={{ duration: 0.15 }}
            className="min-w-0 flex-1"
          >
            {userName && (
              <p className="truncate text-sm font-medium text-white leading-tight">{userName}</p>
            )}
            {userEmail && (
              <p className="truncate text-[11px] text-gray-500 leading-tight">{userEmail}</p>
            )}
          </motion.div>
          {/* Sign out */}
          {open && (
            <button
              onClick={handleSignOut}
              disabled={isPending}
              title="Sign out"
              aria-label="Sign out"
              className="shrink-0 rounded-md p-1.5 text-gray-500 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </SidebarBody>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function Sidebar(props: Props) {
  return (
    <SidebarRoot>
      <SidebarContent {...props} />
    </SidebarRoot>
  )
}
