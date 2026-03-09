/**
 * Invite / activation token helpers.
 *
 * Tokens are 256-bit random hex strings (64 chars).
 * Each token is single-use and expires after TOKEN_TTL_DAYS.
 */

import { randomBytes } from 'crypto'
import { prisma } from '@/lib/db/client'

const TOKEN_LENGTH_BYTES = 32 // 64 hex chars = 256-bit entropy
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// ─── Types ────────────────────────────────────────────────────────────────────

export type TokenError = 'not_found' | 'expired' | 'already_used' | 'disabled'

export type TokenValidationResult =
  | { ok: true; tokenId: string; userId: string; userName: string; userEmail: string; userStatus: string }
  | { ok: false; error: TokenError }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Basic format guard — 64 lowercase hex chars. */
function isTokenFormat(token: string): boolean {
  return token.length === 64 && /^[0-9a-f]+$/.test(token)
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a cryptographically secure invite token and stores it in the DB.
 * Returns the raw token string (to be embedded in an /invite/<token> URL).
 */
export async function createInviteToken(userId: string): Promise<string> {
  const token = randomBytes(TOKEN_LENGTH_BYTES).toString('hex')
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)
  await prisma.inviteToken.create({ data: { token, userId, expiresAt } })
  return token
}

/**
 * Validates a raw invite token string.
 * Returns user details on success, or a typed error on failure.
 * Does NOT mark the token as used.
 */
export async function validateInviteToken(token: string): Promise<TokenValidationResult> {
  if (!token || !isTokenFormat(token)) {
    return { ok: false, error: 'not_found' }
  }

  const record = await prisma.inviteToken.findUnique({
    where: { token },
    select: {
      id: true,
      usedAt: true,
      expiresAt: true,
      user: { select: { id: true, name: true, email: true, status: true } },
    },
  })

  if (!record) return { ok: false, error: 'not_found' }
  if (record.usedAt !== null) return { ok: false, error: 'already_used' }
  if (record.expiresAt < new Date()) return { ok: false, error: 'expired' }
  if (record.user.status === 'disabled') return { ok: false, error: 'disabled' }

  return {
    ok: true,
    tokenId: record.id,
    userId: record.user.id,
    userName: record.user.name,
    userEmail: record.user.email,
    userStatus: record.user.status,
  }
}
