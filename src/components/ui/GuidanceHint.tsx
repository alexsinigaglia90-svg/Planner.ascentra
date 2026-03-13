'use client'

import { useState, useEffect } from 'react'

export interface GuidanceHintProps {
  title: string
  description: string
  dismissible?: boolean
  dismissLabel?: string
  primaryAction?: { label: string; onClick?: () => void }
  storageKey?: string
}

export function GuidanceHint({
  title,
  description,
  dismissible = true,
  dismissLabel = 'Begrepen',
  primaryAction,
  storageKey,
}: GuidanceHintProps) {
  // Start unmounted to avoid hydration mismatch with localStorage-dependent state
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (storageKey) {
      try {
        setDismissed(localStorage.getItem(storageKey) === 'dismissed')
      } catch {
        // localStorage unavailable (e.g. private browsing with restricted storage)
      }
    }
    setMounted(true)
  }, [storageKey])

  if (!mounted || dismissed) return null

  function handleDismiss() {
    setDismissed(true)
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, 'dismissed')
      } catch {
        // ignore write failures
      }
    }
  }

  return (
    <div className="ds-guidance" role="note" aria-label={`Tip: ${title}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="ds-guidance-title">{title}</p>
          <p className="ds-guidance-body">{description}</p>
        </div>
        {dismissible && (
          <button
            type="button"
            onClick={handleDismiss}
            className="ds-guidance-dismiss shrink-0"
          >
            {dismissLabel}
          </button>
        )}
      </div>
      {primaryAction && (
        <div className="mt-1.5">
          <button
            type="button"
            onClick={primaryAction.onClick}
            className="ds-guidance-action"
          >
            {primaryAction.label}
          </button>
        </div>
      )}
    </div>
  )
}
