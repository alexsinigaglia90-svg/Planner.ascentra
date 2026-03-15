/**
 * Application context layer — current user, organization, and role.
 *
 * Resolves from the authenticated iron-session cookie set at login.
 * Falls back to a viewer context when no valid session is present —
 * middleware prevents unauthenticated requests from reaching app routes, so
 * this fallback is a defensive guard for corrupted/expired cookies.
 */

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db/client'
import { getSession } from '@/lib/auth/session'

/** Application roles — values stored in OrganizationMembership.role. */
export type AppRole = 'admin' | 'planner' | 'viewer'

/** The resolved context passed to all org-scoped operations. */
export interface AppContext {
  userId: string
  orgId: string
  role: AppRole
}

/**
 * Returns true when the role may create, edit, delete, move, or copy planner
 * data. Viewers are read-only; planners and admins can mutate.
 */
export function canMutate(role: AppRole): boolean {
  return role === 'admin' || role === 'planner'
}

/** Narrows an arbitrary string to AppRole, falling back to 'viewer'. */
function toAppRole(raw: string | undefined | null): AppRole {
  if (raw === 'admin' || raw === 'planner' || raw === 'viewer') return raw
  return 'viewer'
}

/**
 * Returns the current user/org/role context for the active request.
 *
 * Reads userId and orgId from the iron-session cookie set at login, then
 * resolves the role from OrganizationMembership. Falls back to an empty
 * viewer context when the session is missing or invalid.
 */
export async function getCurrentContext(): Promise<AppContext> {
  const session = await getSession()
  const userId = session.userId ?? ''
  const orgId = session.orgId ?? ''

  if (!userId || !orgId) {
    // Session cookie is missing, expired, or corrupted — destroy it so the
    // middleware no longer treats the request as authenticated, then redirect
    // to login. Without clearing the cookie first we'd loop: middleware sees
    // cookie → allows /login → redirects to /dashboard → back here.
    session.destroy()
    redirect('/login')
  }

  const membership = await prisma.organizationMembership.findUnique({
    where: {
      userId_organizationId: { userId, organizationId: orgId },
    },
    select: { role: true },
  })

  return {
    userId,
    orgId,
    role: toAppRole(membership?.role),
  }
}

