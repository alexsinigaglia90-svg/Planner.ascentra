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

// Re-export all role types and capability checks from the client-safe module
// so existing server-side imports like `import { canMutate } from '@/lib/auth/context'`
// continue to work without changes.
export { type AppRole, hasRole, canMutate, canApprove, canViewCosts, canManageOrg, canManageUsers, ROLE_METADATA, type RoleMeta } from '@/lib/auth/roles'
import type { AppRole } from '@/lib/auth/roles'

// ── Context ─────────────────────────────────────────────────────────────────

/** The resolved context passed to all org-scoped operations. */
export interface AppContext {
  userId: string
  orgId: string
  role: AppRole
}

/** Narrows an arbitrary string to AppRole, falling back to 'viewer'. */
function toAppRole(raw: string | undefined | null): AppRole {
  if (raw === 'admin' || raw === 'manager' || raw === 'planner' || raw === 'viewer') return raw
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
