'use server'

import { redirect } from 'next/navigation'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/db/client'
import { validateResetToken } from '@/lib/reset-token'

// ─── Error copy ───────────────────────────────────────────────────────────────

const ERROR_MESSAGES: Record<string, string> = {
  not_found:    'This password reset link is invalid.',
  expired:      'This reset link has expired (links are valid for 1 hour). Please request a new one.',
  already_used: 'This reset link has already been used. If you need access, please request a new one.',
  disabled:     'Your account has been disabled. Please contact your administrator.',
}

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Validates the reset token, hashes + stores the new password, and consumes the
 * token atomically. Redirects to /login on success.
 */
export async function resetPasswordAction(
  token: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const password = ((formData.get('password') as string) ?? '').trim()
  const confirm  = ((formData.get('confirm')  as string) ?? '').trim()

  // ── Input validation ──
  if (!password)            return { error: 'Password is required.' }
  if (password.length < 8)  return { error: 'Password must be at least 8 characters.' }
  if (password !== confirm)  return { error: 'Passwords do not match.' }

  // ── Re-validate token (guards against race / double-submit) ──
  const validation = await validateResetToken(token)
  if (!validation.ok) {
    return { error: ERROR_MESSAGES[validation.error] ?? 'This reset link is invalid.' }
  }

  const { tokenId, userId } = validation
  const passwordHash = await hash(password, 12)

  // ── Update password + consume token atomically ──
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { password: passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: tokenId },
      data: { usedAt: new Date() },
    }),
  ])

  redirect('/login?reset=1')
}
