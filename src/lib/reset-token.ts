/**
 * Password reset token helpers.
 *
 * Tokens are 256-bit random hex strings (64 chars), single-use, 1-hour TTL.
 * Short TTL is intentional for password reset — reduces window of exposure.
 */

import { randomBytes } from 'crypto'
import { prisma } from '@/lib/db/client'

const TOKEN_LENGTH_BYTES = 32 // 64 hex chars = 256-bit entropy
const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResetTokenError = 'not_found' | 'expired' | 'already_used' | 'disabled'

export type ResetTokenValidationResult =
  | { ok: true; tokenId: string; userId: string; userName: string; userEmail: string }
  | { ok: false; error: ResetTokenError }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Basic format guard — 64 lowercase hex chars. */
function isTokenFormat(token: string): boolean {
  return token.length === 64 && /^[0-9a-f]+$/.test(token)
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a cryptographically secure password reset token for the given user.
 * Any previously unused tokens for this user are invalidated first (best-effort)
 * so only the latest link works at any time.
 * Returns the raw token string (to be embedded in a /reset-password/<token> URL).
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = randomBytes(TOKEN_LENGTH_BYTES).toString('hex')
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)

  await prisma.$transaction([
    // Consume all previous unused tokens for this user so only one is live at a time
    prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({ data: { token, userId, expiresAt } }),
  ])

  return token
}

/**
 * Validates a raw reset token string.
 * Returns user details on success, or a typed error on failure.
 * Does NOT mark the token as used — call consumeResetToken() after success.
 */
export async function validateResetToken(token: string): Promise<ResetTokenValidationResult> {
  if (!token || !isTokenFormat(token)) {
    return { ok: false, error: 'not_found' }
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    select: {
      id: true,
      usedAt: true,
      expiresAt: true,
      user: { select: { id: true, name: true, email: true, status: true } },
    },
  })

  if (!record)                        return { ok: false, error: 'not_found' }
  if (record.usedAt !== null)         return { ok: false, error: 'already_used' }
  if (record.expiresAt < new Date())  return { ok: false, error: 'expired' }
  if (record.user.status === 'disabled') return { ok: false, error: 'disabled' }

  return {
    ok: true,
    tokenId: record.id,
    userId: record.user.id,
    userName: record.user.name,
    userEmail: record.user.email,
  }
}
