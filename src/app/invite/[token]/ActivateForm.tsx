'use client'

import { useState, useTransition } from 'react'
import LoginBackground from '@/app/login/LoginBackground'
import { activateAccountAction } from './actions'

function Spinner() {
  return <span className="login-spinner" aria-hidden="true" />
}

interface Props {
  token: string
  userName: string
  userEmail: string
}

export default function ActivateForm({ token, userName, userEmail }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)

    startTransition(async () => {
      const res = await activateAccountAction(token, fd)
      if (res?.error) {
        setError(res.error)
      }
      // On success the action redirects — no further handling needed
    })
  }

  const initials = userName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

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
          <p className="login-tagline" style={{ animationDelay: '140ms' }}>
            Workforce scheduling platform
          </p>
        </div>

        {/* Card */}
        <div className="login-card" style={{ animationDelay: '210ms' }}>
          {/* User identity */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1.5rem',
              padding: '0.875rem',
              background: '#fafafa',
              borderRadius: '10px',
              border: '1px solid #e4e4e7',
            }}
          >
            <div
              style={{
                flexShrink: 0,
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#18181b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                letterSpacing: '-0.01em',
                userSelect: 'none',
              }}
            >
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: 500,
                  color: '#18181b',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                {userName}
              </p>
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: '#71717a',
                  marginTop: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {userEmail}
              </p>
            </div>
          </div>

          {/* Heading */}
          <h1 className="login-heading">Set your password</h1>
          <p className="login-subheading">
            Choose a password to activate your account and sign in.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field" style={{ animationDelay: '310ms' }}>
              <label htmlFor="password" className="login-label">
                New password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                disabled={isPending}
                placeholder="Minimum 8 characters"
                className="login-input"
              />
            </div>

            <div className="login-field" style={{ animationDelay: '370ms' }}>
              <label htmlFor="confirm" className="login-label">
                Confirm password
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                disabled={isPending}
                placeholder="Repeat your password"
                className="login-input"
              />
            </div>

            {error && (
              <div className="login-error" role="alert">
                <svg
                  className="shrink-0 mt-px"
                  style={{ width: 14, height: 14 }}
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="7" cy="7" r="6.5" stroke="currentColor" strokeWidth="1.2" />
                  <path
                    d="M7 4.5v3M7 9.5h.01"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="login-submit-wrap" style={{ animationDelay: '430ms' }}>
              <button type="submit" disabled={isPending} className="login-btn">
                {isPending ? (
                  <>
                    <Spinner />
                    Activating account…
                  </>
                ) : (
                  'Activate account'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Password hint */}
        <p className="login-footer" style={{ animationDelay: '500ms' }}>
          Use at least 8 characters · Secure access · Planner Ascentra
        </p>
      </div>
    </div>
  )
}
