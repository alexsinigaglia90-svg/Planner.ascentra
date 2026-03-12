import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { getSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import Sidebar from '@/components/Sidebar'
import { getUserNotifications, getUnreadCount } from '@/lib/queries/notifications'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Planner — Ascentra',
  description: 'Workforce scheduling platform',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  const isAuthenticated = !!(session.userId && session.orgId)

  // Lightweight user lookup for display in Sidebar
  let userName: string | null = null
  let userEmail: string | null = null
  let userRole: string | null = null
  let unreadCount = 0
  let notifications: Awaited<ReturnType<typeof getUserNotifications>> = []
  if (isAuthenticated) {
    const [user, membership, count, notifs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.userId! },
        select: { name: true, email: true },
      }),
      prisma.organizationMembership.findUnique({
        where: { userId_organizationId: { userId: session.userId!, organizationId: session.orgId! } },
        select: { role: true },
      }),
      getUnreadCount(session.orgId!, session.userId!),
      getUserNotifications(session.orgId!, session.userId!, 20),
    ])
    userName = user?.name ?? null
    userEmail = user?.email ?? null
    userRole = membership?.role ?? null
    unreadCount = count
    notifications = notifs
  }

  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        {isAuthenticated ? (
          <div className="flex h-screen overflow-hidden app-bg">
            <Sidebar userName={userName} userEmail={userEmail} role={userRole} unreadCount={unreadCount} notifications={notifications} />
            <main className="flex-1 overflow-y-auto p-8 motion-page">{children}</main>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  )
}

