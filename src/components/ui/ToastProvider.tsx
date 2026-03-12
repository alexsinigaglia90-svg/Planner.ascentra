'use client'

import { useState, useCallback } from 'react'
import { ToastContext, type ToastItem } from './useToast'
import { Toast } from './Toast'

let _id = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set())

  const dismiss = useCallback((id: string) => {
    setExitingIds((prev) => new Set([...prev, id]))
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
      setExitingIds((prev) => {
        const n = new Set(prev)
        n.delete(id)
        return n
      })
    }, 200)
  }, [])

  const add = useCallback(
    (type: 'success' | 'error', message: string) => {
      const id = String(++_id)
      setToasts((prev) => [...prev, { id, type, message }])
      setTimeout(() => dismiss(id), 3500)
    },
    [dismiss],
  )

  const value = {
    success: (message: string) => add('success', message),
    error: (message: string) => add('error', message),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="ds-toast-stack"
        role="region"
        aria-label="Notificaties"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <Toast key={t.id} type={t.type} message={t.message} exiting={exitingIds.has(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
