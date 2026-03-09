'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import LoginBackground from '@/app/login/LoginBackground'

function Spinner() {
  return <span className="login-spinner" aria-hidden="true" />
}

type ViewState = 'form' | 'sent'

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition()
  const [view, setView] = useState<ViewState>('form')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const email = ((fd.get('email') as string) ?? '').trim().toLowerCase()
    setError(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        const data = await res.json() as { ok?: boolean; error?: string }
        if (!res.ok) {
          setError(data.error ?? 'Something went wrong. Please try again.')
          return
        }
        setView('sent')
      } catch {
        setError('Unable to connect. Please check your connection and try again.')
      }
    })
  }

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
          {view === 'sent' ? (
            /* ── Sent state ── */
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.25rem',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M4 10.5l4 4 8-8"
                    stroke="#16a34a"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h1 className="login-heading">Check your inbox</h1>
              <p className="login-subheading" style={{ marginTop: '0.5rem', lineHeight: 1.6 }}>
                If an account with that email exists, a password reset link has been
                generated. Ask your administrator for the link, or check the admin
                Users panel.
              </p>
              <div
                className="login-submit-wrap"
                style={{ marginTop: '1.75rem', animationDelay: '0ms' }}
              >
                <Link
                  href="/login"
                  className="login-btn"
                  style={{ textDecoration: 'none' }}
                >
                  Back to sign in
                </Link>
              </div>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <h1 className="login-heading">Forgot password</h1>
              <p className="login-subheading">
                Enter the email address linked to your account.
              </p>

              <form onSubmit={handleSubmit} className="login-form">
                <div className="login-field" style={{ animationDelay: '310ms' }}>
                  <label htmlFor="email" className="login-label">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    disabled={isPending}
                    placeholder="you@company.com"
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

                <div className="login-submit-wrap" style={{ animationDelay: '380ms' }}>
                  <button type="submit" disabled={isPending} className="login-btn">
                    {isPending ? (
                      <>
                        <Spinner />
                        Sending…
                      </>
                    ) : (
                      'Send reset link'
                    )}
                  </button>
                </div>
              </form>

              <p
                style={{
                  marginTop: '1.25rem',
                  textAlign: 'center',
                  fontSize: '0.8125rem',
                  color: '#71717a',
                }}
              >
                <Link
                  href="/login"
                  style={{ color: '#18181b', fontWeight: 500, textDecoration: 'none' }}
                >
                  ← Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>

        <p className="login-footer" style={{ animationDelay: '500ms' }}>
          Secure access · Planner Ascentra
        </p>
      </div>
    </div>
  )
}
