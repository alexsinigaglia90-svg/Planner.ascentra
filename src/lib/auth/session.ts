/**
 * iron-session configuration and helpers.
 *
 * Session stores the authenticated user's ID and their active organization ID
 * in an encrypted, signed HttpOnly cookie. No JWT, no external DB for sessions.
 */

import { getIronSession, type IronSession, type SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'

// ---------------------------------------------------------------------------
// Session shape
// ---------------------------------------------------------------------------

export interface SessionData {
  userId?: string
  orgId?: string
}

// ---------------------------------------------------------------------------
// Cookie configuration
// ---------------------------------------------------------------------------

export const sessionOptions: SessionOptions = {
  /**
   * SESSION_SECRET must be at least 32 characters.
   * Set a strong random value in production via environment variables.
   */
  password:
    process.env.SESSION_SECRET ??
    'dev-only-planner-session-secret-change-in-prod-!!',
  cookieName: 'planner_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
}

// ---------------------------------------------------------------------------
// Server-side helpers (Server Components, Server Actions, Route Handlers)
// ---------------------------------------------------------------------------

/**
 * Returns the current iron-session from the request cookies.
 * Reads `userId` and `orgId` set at login time.
 * Returns an empty session object if no valid cookie is present.
 */
export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions)
}
