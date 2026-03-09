'use server'

import { redirect } from 'next/navigation'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/db/client'
import { getSession } from '@/lib/auth/session'
import { validateInviteToken } from '@/lib/invite-token'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ERROR_MESSAGES: Record<string, string> = {
  not_found:    'This invite link is invalid.',
  expired:      'This invite link has expired. Please ask your administrator to generate a new one.',
  already_used: 'This invite link has already been used. If you need access, please sign in.',
  disabled:     'Your account has been disabled. Please contact your administrator.',
}

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Validates the invite token, sets the user's password, activates the account,
 * and logs them in with an iron-session cookie.
 *
 * On success: redirects to /dashboard.
 * On failure: returns { error } — never throws.
 */
export async function activateAccountAction(
  token: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const password = ((formData.get('password') as string) ?? '').trim()
  const confirm  = ((formData.get('confirm')  as string) ?? '').trim()

  // ── Input validation ──
  if (!password)              return { error: 'Password is required.' }
  if (password.length < 8)    return { error: 'Password must be at least 8 characters.' }
  if (password !== confirm)   return { error: 'Passwords do not match.' }

  // ── Re-validate token (guards against race conditions / double-submission) ──
  const validation = await validateInviteToken(token)
  if (!validation.ok) {
    return { error: ERROR_MESSAGES[validation.error] ?? 'This invite link is invalid.' }
  }

  const { tokenId, userId } = validation
  const passwordHash = await hash(password, 12)

  // ── Activate account + consume token atomically ──
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { password: passwordHash, status: 'active' },
    }),
    prisma.inviteToken.update({
      where: { id: tokenId },
      data: { usedAt: new Date() },
    }),
  ])

  // ── Resolve org membership (pick earliest for session) ──
  const membership = await prisma.organizationMembership.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { organizationId: true },
  })

  if (!membership) {
    // Account activated but no org — partial state, let them sign in manually
    return {
      error:
        'Your password has been set but your account has no organization. Please sign in and contact your administrator.',
    }
  }

  // ── Sign in ──
  const session = await getSession()
  session.userId = userId
  session.orgId  = membership.organizationId
  await session.save()

  redirect('/dashboard')
}
