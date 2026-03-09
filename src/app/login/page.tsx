'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import LoginBackground from './LoginBackground'

function Spinner() {
  return <span className="login-spinner" aria-hidden="true" />
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from') ?? '/dashboard'
  const justReset = searchParams.get('reset') === '1'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })

        const data = await res.json() as { ok?: boolean; error?: string }

        if (!res.ok) {
          setError(data.error ?? 'Sign in failed. Please try again.')
          return
        }

        router.push(from)
        router.refresh()
      } catch {
        setError('Unable to connect. Please check your connection and try again.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <div className="login-field" style={{ animationDelay: '310ms' }}>
        <label htmlFor="email" className="login-label">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
          placeholder="you@company.com"
          className="login-input"
        />
      </div>

      <div className="login-field" style={{ animationDelay: '380ms' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <label htmlFor="password" className="login-label" style={{ marginBottom: 0 }}>Password</label>
          <Link
            href="/forgot-password"
            tabIndex={-1}
            style={{ fontSize: '0.75rem', color: '#71717a', textDecoration: 'none', letterSpacing: '-0.01em' }}
          >
            Forgot password?
          </Link>
        </div>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isPending}
          placeholder="••••••••••"
          className="login-input"
        />
      </div>

      {justReset && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5625rem',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '8px',
            padding: '0.6875rem 0.9375rem',
            fontSize: '0.8125rem',
            color: '#15803d',
            letterSpacing: '-0.005em',
          }}
          role="status"
        >
          <svg
            className="shrink-0 mt-px"
            style={{ width: 14, height: 14 }}
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2.5 7l3.5 3.5 5.5-6"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Password updated. Sign in with your new password.</span>
        </div>
      )}

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

      <div className="login-submit-wrap" style={{ animationDelay: '450ms' }}>
        <button type="submit" disabled={isPending} className="login-btn">
          {isPending ? (
            <>
              <Spinner />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </div>
    </form>
  )
}

export default function LoginPage() {
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
          <div>
            <h1 className="login-heading">Sign in</h1>
            <p className="login-subheading">Enter your credentials to continue</p>
          </div>

          <Suspense>
            <LoginForm />
          </Suspense>
        </div>

        {/* Footer */}
        <p className="login-footer" style={{ animationDelay: '560ms' }}>
          Secure access · Planner Ascentra
        </p>
      </div>
    </div>
  )
}

