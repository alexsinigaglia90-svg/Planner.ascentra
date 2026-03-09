/**
 * /reset-password/[token] — Password reset page.
 *
 * Server Component: validates token, resolves user info.
 * Renders ResetPasswordForm (client) on success, clean error state on failure.
 */

import Link from 'next/link'
import { validateResetToken, type ResetTokenError } from '@/lib/reset-token'
import ResetPasswordForm from './ResetPasswordForm'
import LoginBackground from '@/app/login/LoginBackground'

// ─── Error state ──────────────────────────────────────────────────────────────

const ERROR_COPY: Record<
  ResetTokenError,
  { heading: string; body: string; cta?: { label: string; href: string } }
> = {
  not_found: {
    heading: 'Link not found',
    body: 'This password reset link is invalid or has been removed. Please request a new one.',
    cta: { label: 'Request new link', href: '/forgot-password' },
  },
  expired: {
    heading: 'Link expired',
    body: 'Reset links are valid for 1 hour. Please request a new password reset link.',
    cta: { label: 'Request new link', href: '/forgot-password' },
  },
  already_used: {
    heading: 'Link already used',
    body: 'This reset link has already been used. Sign in with your new password, or request another reset.',
    cta: { label: 'Sign in', href: '/login' },
  },
  disabled: {
    heading: 'Account disabled',
    body: 'Your account has been disabled. Please contact your administrator.',
  },
}

function ErrorPage({ error }: { error: ResetTokenError }) {
  const copy = ERROR_COPY[error]
  return (
    <div className="login-root">
      <LoginBackground />
      <div className="login-bg-vignette" aria-hidden="true" />

      <div className="login-center">
        <div className="login-brand">
          <div className="login-mark" style={{ animationDelay: '0ms' }}>
            <span className="login-mark-letter">P</span>
          </div>
          <div className="login-wordmark" style={{ animationDelay: '70ms' }}>
            <span className="login-wordmark-name">Planner</span>
            <span className="login-wordmark-sub">Ascentra</span>
          </div>
        </div>

        <div className="login-card" style={{ animationDelay: '140ms' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <circle cx="9" cy="9" r="8" stroke="#dc2626" strokeWidth="1.5" />
              <path
                d="M9 5.5v4M9 11.5h.01"
                stroke="#dc2626"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <h1 className="login-heading">{copy.heading}</h1>
          <p className="login-subheading" style={{ marginTop: '0.5rem', lineHeight: 1.55 }}>
            {copy.body}
          </p>

          {copy.cta ? (
            <div className="login-submit-wrap" style={{ marginTop: '1.75rem', animationDelay: '0ms' }}>
              <Link href={copy.cta.href} className="login-btn" style={{ textDecoration: 'none' }}>
                {copy.cta.label}
              </Link>
            </div>
          ) : (
            <p style={{ marginTop: '1.25rem', fontSize: '0.8125rem', color: '#71717a' }}>
              <Link href="/login" style={{ color: '#18181b', fontWeight: 500, textDecoration: 'none' }}>
                ← Back to sign in
              </Link>
            </p>
          )}
        </div>

        <p className="login-footer" style={{ animationDelay: '300ms' }}>
          Secure access · Planner Ascentra
        </p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  return { title: 'Reset password — Planner Ascentra' }
}

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const result = await validateResetToken(token)

  if (!result.ok) {
    return <ErrorPage error={result.error} />
  }

  return (
    <ResetPasswordForm
      token={token}
      userName={result.userName}
      userEmail={result.userEmail}
    />
  )
}
