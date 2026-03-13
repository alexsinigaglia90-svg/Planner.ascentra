'use client'

import { createContext, useContext } from 'react'

export interface ToastItem {
  id: string
  type: 'success' | 'error'
  message: string
  major?: boolean
}

export interface ToastContextValue {
  success: (message: string, options?: { major?: boolean }) => void
  error: (message: string) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
