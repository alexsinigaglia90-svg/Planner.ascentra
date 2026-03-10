'use server'

import { revalidatePath } from 'next/cache'
import { hash } from 'bcryptjs'
import { getCurrentContext } from '@/lib/auth/context'
import { logAction } from '@/lib/audit'
import { createInviteToken } from '@/lib/invite-token'
import { createPasswordResetToken } from '@/lib/reset-token'
import { getOrgMembers,
  createOrgMember,
  updateMemberRole,
  updateUserStatus,
  removeOrgMember,
  type OrgRole,
  type UserStatus,
} from '@/lib/queries/users'
import { notify } from '@/lib/notify'
import { deliver } from '@/lib/email/service'
import { prisma } from '@/lib/db/client'

// ─── Shared validators ────────────────────────────────────────────────────────

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function isValidId(s: string): boolean {
  return typeof s === 'string' && s.trim().length >= 10
}

function toOrgRole(raw: string): OrgRole | null {
  return raw === 'admin' || raw === 'planner' || raw === 'viewer' ? raw : null
}

function toUserStatus(raw: string): UserStatus | null {
  return raw === 'active' || raw === 'invited' || raw === 'disabled' ? raw : null
}

/** Guard: only admins may use user management actions. */
async function requireAdmin(): Promise<
  { orgId: string; userId: string } | { error: string }
> {
  const ctx = await getCurrentContext()
  if (ctx.role !== 'admin') {
    return { error: 'Only administrators may manage users.' }
  }
  return { orgId: ctx.orgId, userId: ctx.userId }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Creates a new user and adds them to the organization.
 * Status defaults to 'invited' for new accounts created by an admin.
 * An optional initial password may be set; otherwise the account is passwordless
 * until the user sets one via a future password-reset flow.
 */
export async function inviteUserAction(formData: FormData): Promise<{ error?: string }> {
  const guard = await requireAdmin()
  if ('error' in guard) return { error: guard.error }
  const { orgId, userId: actorId } = guard

  const name  = ((formData.get('name')  as string) ?? '').trim()
  const email = ((formData.get('email') as string) ?? '').trim().toLowerCase()
  const roleRaw   = (formData.get('role')   as string) ?? ''
  const statusRaw = (formData.get('status') as string) ?? 'invited'
  const password  = ((formData.get('password') as string) ?? '').trim()

  if (!name)               return { error: 'Name is required.' }
  if (!isValidEmail(email)) return { error: 'A valid email address is required.' }

  const role   = toOrgRole(roleRaw)
  const status = toUserStatus(statusRaw)
  if (!role)   return { error: 'Role must be admin, planner, or viewer.' }
  if (!status) return { error: 'Status must be active, invited, or disabled.' }

  let passwordHash: string | undefined
  if (password) {
    if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
    passwordHash = await hash(password, 12)
  }

  try {
    const result = await createOrgMember({ organizationId: orgId, name, email, role, status, passwordHash })
    if (!result.ok) return { error: result.error }

    revalidatePath('/settings/users')
    await logAction({
      organizationId: orgId,
      userId: actorId,
      actionType: 'invite_user',
      entityType: 'user',
      entityId: result.userId,
      summary: `Invited user ${email} as ${role}`,
      afterData: { email, name, role, status },
    })
    await notify({
      organizationId: orgId,
      userId: result.userId,
      type: 'user_invited',
      title: 'Welcome to Planner Ascentra',
      message: 'Your account has been created. Use your activation link to set your password.',
      severity: 'info',
    })
    return {}
  } catch (err) {
    console.error('inviteUserAction error:', err)
    return { error: 'Could not create user. Please try again.' }
  }
}

/** Updates a member's role within the current organization. */
export async function updateMemberRoleAction(
  targetUserId: string,
  role: string,
): Promise<{ error?: string }> {
  const guard = await requireAdmin()
  if ('error' in guard) return { error: guard.error }
  const { orgId, userId: actorId } = guard

  if (!isValidId(targetUserId)) return { error: 'Invalid user id.' }
  const newRole = toOrgRole(role)
  if (!newRole) return { error: 'Invalid role.' }

  // Prevent admin from downgrading their own role (must keep at least one admin)
  if (targetUserId === actorId && newRole !== 'admin') {
    const members = await getOrgMembers(orgId)
    const adminCount = members.filter((m) => m.role === 'admin').length
    if (adminCount <= 1) {
      return { error: 'Cannot remove admin role — the organization must have at least one admin.' }
    }
  }

  try {
    const result = await updateMemberRole({ organizationId: orgId, userId: targetUserId, role: newRole })
    if (!result.ok) return { error: result.error }

    revalidatePath('/settings/users')
    await logAction({
      organizationId: orgId,
      userId: actorId,
      actionType: 'update_member_role',
      entityType: 'user',
      entityId: targetUserId,
      summary: `Updated user role to ${newRole}`,
      afterData: { userId: targetUserId, role: newRole },
    })
    return {}
  } catch (err) {
    console.error('updateMemberRoleAction error:', err)
    return { error: 'Could not update role. Please try again.' }
  }
}

/** Updates a user's account status. */
export async function updateUserStatusAction(
  targetUserId: string,
  status: string,
): Promise<{ error?: string }> {
  const guard = await requireAdmin()
  if ('error' in guard) return { error: guard.error }
  const { orgId, userId: actorId } = guard

  if (!isValidId(targetUserId)) return { error: 'Invalid user id.' }
  const newStatus = toUserStatus(status)
  if (!newStatus) return { error: 'Invalid status.' }

  // Prevent admin from disabling their own account
  if (targetUserId === actorId && newStatus === 'disabled') {
    return { error: 'You cannot disable your own account.' }
  }

  try {
    await updateUserStatus({ userId: targetUserId, status: newStatus })
    revalidatePath('/settings/users')
    await logAction({
      organizationId: orgId,
      userId: actorId,
      actionType: 'update_user_status',
      entityType: 'user',
      entityId: targetUserId,
      summary: `Updated user status to ${newStatus}`,
      afterData: { userId: targetUserId, status: newStatus },
    })
    return {}
  } catch (err) {
    console.error('updateUserStatusAction error:', err)
    return { error: 'Could not update status. Please try again.' }
  }
}

/** Removes a user's membership from the organization. */
export async function removeMemberAction(
  targetUserId: string,
): Promise<{ error?: string }> {
  const guard = await requireAdmin()
  if ('error' in guard) return { error: guard.error }
  const { orgId, userId: actorId } = guard

  if (!isValidId(targetUserId)) return { error: 'Invalid user id.' }
  if (targetUserId === actorId) {
    return { error: 'You cannot remove yourself from the organization.' }
  }

  try {
    const result = await removeOrgMember({ organizationId: orgId, userId: targetUserId })
    if (!result.ok) return { error: result.error }

    revalidatePath('/settings/users')
    await logAction({
      organizationId: orgId,
      userId: actorId,
      actionType: 'remove_member',
      entityType: 'user',
      entityId: targetUserId,
      summary: `Removed user from organization`,
      afterData: { userId: targetUserId },
    })
    return {}
  } catch (err) {
    console.error('removeMemberAction error:', err)
    return { error: 'Could not remove member. Please try again.' }
  }
}

/**
 * Generates a single-use activation link token for an invited user.
 * Returns the raw token; the client is responsible for building the full URL.
 */
export async function generateInviteLinkAction(
  targetUserId: string,
): Promise<{ error?: string; token?: string }> {
  const guard = await requireAdmin()
  if ('error' in guard) return { error: guard.error }
  const { orgId, userId: actorId } = guard

  if (!isValidId(targetUserId)) return { error: 'Invalid user id.' }

  try {
    const token = await createInviteToken(targetUserId)

    await logAction({
      organizationId: orgId,
      userId: actorId,
      actionType: 'generate_invite_link',
      entityType: 'user',
      entityId: targetUserId,
      summary: 'Generated activation link',
    })

    // Awaited delivery — required for Vercel serverless (fire-and-forget is killed on return)
    try {
      const [target, org] = await Promise.all([
        prisma.user.findUnique({ where: { id: targetUserId }, select: { name: true, email: true } }),
        prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
      ])
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'http://localhost:3000'
      if (target?.email) {
        await deliver({
          organizationId: orgId,
          userId: targetUserId,
          type: 'invite',
          recipient: target.email,
          data: {
            userName: target.name ?? target.email,
            userEmail: target.email,
            inviteUrl: `${appUrl}/invite/${token}`,
            orgName: org?.name ?? 'your organization',
          },
        })
      }
    } catch (e) {
      console.error('deliver invite error:', e)
    }

    return { token }
  } catch (err) {
    console.error('generateInviteLinkAction error:', err)
    return { error: 'Could not generate invite link. Please try again.' }
  }
}

/**
 * Generates a single-use password reset link token for any org member.
 * Admin-only. Returns the raw token; client builds the full URL.
 */
export async function generateResetLinkAction(
  targetUserId: string,
): Promise<{ error?: string; token?: string }> {
  const guard = await requireAdmin()
  if ('error' in guard) return { error: guard.error }
  const { orgId, userId: actorId } = guard

  if (!isValidId(targetUserId)) return { error: 'Invalid user id.' }

  try {
    const token = await createPasswordResetToken(targetUserId)

    await logAction({
      organizationId: orgId,
      userId: actorId,
      actionType: 'generate_reset_link',
      entityType: 'user',
      entityId: targetUserId,
      summary: 'Admin generated password reset link',
    })

    // Fire-and-forget delivery — non-throwing
    void (async () => {
      try {
        const [target, org] = await Promise.all([
          prisma.user.findUnique({ where: { id: targetUserId }, select: { name: true, email: true } }),
          prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
        ])
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'http://localhost:3000'
        if (target?.email) {
          await deliver({
            organizationId: orgId,
            userId: targetUserId,
            type: 'password_reset',
            recipient: target.email,
            data: {
              userName: target.name ?? target.email,
              userEmail: target.email,
              resetUrl: `${appUrl}/reset-password/${token}`,
            },
          })
        }
      } catch (e) {
        console.error('deliver reset error:', e)
      }
    })()

    return { token }
  } catch (err) {
    console.error('generateResetLinkAction error:', err)
    return { error: 'Could not generate reset link. Please try again.' }
  }
}
