/**
 * /invite/[token] — Account activation / invite redemption page.
 *
 * Server Component: validates token, resolves user info.
 * Renders ActivateForm (client) on success, or a clean error state.
 * Layout: reuses the login page visual system (LoginBackground, .login-* CSS).
 */

import { validateInviteToken, type TokenError } from '@/lib/invite-token'
import ActivateForm from './ActivateForm'
import LoginBackground from '@/app/login/LoginBackground'

// ─── Error state ──────────────────────────────────────────────────────────────

const ERROR_COPY: Record<
  TokenError,
  { heading: string; body: string; cta?: { label: string; href: string } }
> = {
  not_found: {
    heading: 'Link not found',
    body: 'This invite link is invalid or has been removed. Please check the URL or ask your administrator for a new one.',
  },
  expired: {
    heading: 'Link expired',
    body: 'This invite link is more than 7 days old. Ask your administrator to generate a new activation link for your account.',
  },
  already_used: {
    heading: 'Already activated',
    body: 'This invite link has already been used to activate an account.',
    cta: { label: 'Sign in', href: '/login' },
  },
  disabled: {
    heading: 'Account disabled',
    body: 'Your account has been disabled. Please contact your administrator.',
  },
}

function ErrorPage({ error }: { error: TokenError }) {
  const copy = ERROR_COPY[error]
  return (
    <div className="login-root">
      <LoginBackground />
      <div className="login-bg-vignette" aria-hidden="true" />

      <div className="login-center">
        {/* Brand */}
        <div className="login-brand">
          <div className="login-mark" style={{ animationDelay: '0ms' }}>
            <span className="login-mark-letter">P</span>
          </div>
          <div className="login-wordmark" style={{ animationDelay: '70ms' }}>
            <span className="login-wordmark-name">Planner</span>
            <span className="login-wordmark-sub">Ascentra</span>
          </div>
        </div>

        {/* Error card */}
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

          {copy.cta && (
            <div className="login-submit-wrap" style={{ marginTop: '1.75rem', animationDelay: '0ms' }}>
              <a href={copy.cta.href} className="login-btn" style={{ textDecoration: 'none' }}>
                {copy.cta.label}
              </a>
            </div>
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

// Disable full-route caching so token validation always runs fresh
export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  return { title: 'Activate account — Planner Ascentra' }
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const result = await validateInviteToken(token)

  if (!result.ok) {
    return <ErrorPage error={result.error} />
  }

  return (
    <ActivateForm
      token={token}
      userName={result.userName}
      userEmail={result.userEmail}
    />
  )
}
