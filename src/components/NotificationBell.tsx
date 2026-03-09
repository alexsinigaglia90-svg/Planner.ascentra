'use client'

import { useState, useTransition, useRef, useEffect, useCallback } from 'react'
import type { NotificationRow } from '@/lib/queries/notifications'
import { markNotificationReadAction, markAllReadAction } from '@/app/notifications/actions'

interface Props {
  initialCount: number
  notifications: NotificationRow[]
}

function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const severityDot: Record<string, string> = {
  info: 'bg-blue-400',
  warning: 'bg-amber-400',
  critical: 'bg-red-400',
}

export default function NotificationBell({ initialCount, notifications: initialNotifications }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [items, setItems] = useState(initialNotifications)
  const [, startTransition] = useTransition()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null)

  // Sync local state when the server RSC re-renders with fresh data.
  // initialCount is a stable scalar — safe to use as the sentinel for both
  // count and items, since they come from the same query in the layout.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setCount(initialCount); setItems(initialNotifications) }, [initialCount])

  const handleToggle = useCallback(() => {
    if (!isOpen && buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect()
      setPanelPos({ top: r.bottom + 6, left: r.left })
    }
    setIsOpen((prev) => !prev)
  }, [isOpen])

  // Close panel when clicking outside
  useEffect(() => {
    if (!isOpen) return
    function onPointerDown(e: PointerEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [isOpen])

  function markOneRead(id: string) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'read' as const } : item)),
    )
    setCount((c) => Math.max(0, c - 1))
    startTransition(() => {
      markNotificationReadAction(id)
    })
  }

  function markAll() {
    setItems((prev) => prev.map((item) => ({ ...item, status: 'read' as const })))
    setCount(0)
    startTransition(() => {
      markAllReadAction()
    })
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ''}`}
        className="relative flex items-center justify-center w-8 h-8 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
      >
        {/* Bell icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Unread badge */}
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 rounded-full bg-red-500 text-[10px] font-bold text-white px-0.5 leading-none pointer-events-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Floating panel — fixed position to escape overflow:hidden ancestors */}
      {isOpen && panelPos && (
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: panelPos.top, left: panelPos.left }}
          className="w-80 rounded-xl bg-gray-800 border border-white/10 shadow-2xl z-[200] overflow-hidden"
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="text-sm font-semibold text-white">Notifications</span>
            {count > 0 && (
              <button
                onClick={markAll}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                No notifications yet
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => item.status === 'unread' && markOneRead(item.id)}
                  className={[
                    'w-full text-left px-4 py-3 border-b border-white/5 transition-colors',
                    item.status === 'unread'
                      ? 'bg-white/5 hover:bg-white/10 cursor-pointer'
                      : 'hover:bg-white/5 cursor-default',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-3">
                    {/* Severity dot */}
                    <span
                      className={`mt-1.5 w-2 h-2 shrink-0 rounded-full ${severityDot[item.severity] ?? 'bg-gray-400'}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm leading-snug ${
                          item.status === 'unread'
                            ? 'font-semibold text-white'
                            : 'font-medium text-gray-300'
                        }`}
                      >
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.message}</p>
                      <p className="text-xs text-gray-600 mt-1">{timeAgo(item.createdAt)}</p>
                    </div>
                    {/* Unread indicator */}
                    {item.status === 'unread' && (
                      <span className="mt-2 w-1.5 h-1.5 shrink-0 rounded-full bg-blue-500" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </>
  )
}
