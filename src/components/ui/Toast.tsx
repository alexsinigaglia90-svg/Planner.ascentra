'use client'

interface ToastProps {
  type: 'success' | 'error'
  message: string
  exiting: boolean
  major?: boolean
}

export function Toast({ type, message, exiting, major }: ToastProps) {
  const successClass = type === 'success'
    ? (major ? 'ds-toast-success-strong' : 'ds-toast-success')
    : 'ds-toast-error'

  const motionClass = exiting
    ? 'ds-toast--exit'
    : (major && type === 'success' ? 'ds-toast--enter-bounce' : 'ds-toast--enter')

  return (
    <div
      role="status"
      aria-live="polite"
      className={`ds-toast ${successClass} ${motionClass}`}
    >
      <span className="ds-toast-icon" aria-hidden="true">
        {type === 'success' ? (
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="9" r="8" />
            <path d="M5.5 9l2.5 2.5 4.5-4.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <circle cx="9" cy="9" r="8" />
            <path d="M9 5.5v4M9 12.5v.25" />
          </svg>
        )}
      </span>
      <span>{message}</span>
    </div>
  )
}
