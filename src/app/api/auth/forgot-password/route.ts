/**
 * POST /api/auth/forgot-password
 *
 * Accepts an email address and generates a password-reset token if the user
 * exists and is not disabled.
 *
 * Security note: Always returns HTTP 200 with { ok: true } regardless of
 * whether the email was found — prevents user enumeration.
 *
 * In v1, the reset link is surfaced in the admin Users panel.
 * When email delivery is added, call sendResetEmail() here.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { createPasswordResetToken } from '@/lib/reset-token'
import { notify } from '@/lib/notify'
import { deliver } from '@/lib/email/service'

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json() as { email?: unknown }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      // Return 200 to avoid enumeration even on bad input
      return NextResponse.json({ ok: true })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, status: true },
    })

    // Silently succeed when user not found or is disabled — no enumeration
    if (user && user.status !== 'disabled') {
      const token = await createPasswordResetToken(user.id)
      // Notify the user in-app (best-effort, non-throwing)
      const membership = await prisma.organizationMembership.findFirst({
        where: { userId: user.id },
        select: { organizationId: true },
      })
      if (membership) {
        await notify({
          organizationId: membership.organizationId,
          userId: user.id,
          type: 'password_reset',
          title: 'Password reset requested',
          message: 'A password reset link has been generated for your account. If you did not request this, please contact your administrator.',
          severity: 'info',
        })
        // Send delivery email (best-effort, non-throwing)
        const userRecord = await prisma.user.findUnique({
          where: { id: user.id },
          select: { name: true },
        })
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'http://localhost:3000'
        await deliver({
          organizationId: membership.organizationId,
          userId: user.id,
          type: 'password_reset',
          recipient: email,
          immediate: true,
          data: {
            userName: userRecord?.name ?? email,
            userEmail: email,
            resetUrl: `${appUrl}/reset-password/${token}`,
          },
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[auth/forgot-password]', err)
    // Still return 200 to avoid leaking information via error responses
    return NextResponse.json({ ok: true })
  }
}
