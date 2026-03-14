'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SkillLevelIndicator, LEVEL_LABELS, LEVEL_COLORS } from './SkillLevelIndicator'

// ─── SkillLevelPicker ─────────────────────────────────────────────────────────
// Compact inline popover anchored to a trigger element.
// Renders into document.body via portal to escape table overflow clipping.

interface Position {
  top: number
  left: number
  above: boolean
}

const PICKER_WIDTH = 176 // px
const PICKER_ITEM_HEIGHT = 38 // px
const PICKER_HEIGHT = 5 * PICKER_ITEM_HEIGHT + 8 // 5 levels + padding
const ANIM_MS = 130 // enter/exit duration

interface Props {
  anchorEl: HTMLElement | null
  currentLevel: number
  onSelect: (level: number) => void
  onClose: () => void
}

export function SkillLevelPicker({ anchorEl, currentLevel, onSelect, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const [pos, setPos] = useState<Position | null>(null)
  const [visible, setVisible] = useState(false)

  // Keep onClose ref fresh without re-registering listeners
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  // Measure anchor position after mount
  useEffect(() => {
    if (!anchorEl) return
    const rect = anchorEl.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const above = spaceBelow < PICKER_HEIGHT + 12
    const top = above ? rect.top - PICKER_HEIGHT - 6 : rect.bottom + 6
    // Center picker horizontally on anchor
    const left = Math.max(8, Math.min(
      rect.left + rect.width / 2 - PICKER_WIDTH / 2,
      window.innerWidth - PICKER_WIDTH - 8,
    ))
    setPos({ top, left, above })
  }, [anchorEl])

  // Trigger enter animation one frame after position is measured
  useEffect(() => {
    if (!pos) return
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [pos])

  // Animated close — fade/scale out then unmount
  function handleClose() {
    setVisible(false)
    setTimeout(() => onCloseRef.current(), ANIM_MS)
  }

  // Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        handleClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Focus panel once visible
  useEffect(() => {
    if (visible) panelRef.current?.focus()
  }, [visible])

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      {/* Transparent backdrop — captures outside clicks */}
      <div
        className="fixed inset-0 z-[199]"
        aria-hidden="true"
        onClick={handleClose}
      />

      {/* Picker panel */}
      <div
        ref={panelRef}
        role="listbox"
        aria-label="Select skill level"
        tabIndex={-1}
        className="fixed z-[200] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg outline-none will-change-[opacity,transform]"
        style={{
          width: PICKER_WIDTH,
          top: pos?.top ?? -9999,
          left: pos?.left ?? -9999,
          transformOrigin: pos?.above ? 'bottom center' : 'top center',
          opacity: visible ? 1 : 0,
          transform: visible
            ? 'translateY(0px) scale(1)'
            : `translateY(${pos?.above ? '4px' : '-4px'}) scale(0.96)`,
          transition: `opacity ${ANIM_MS}ms ease, transform ${ANIM_MS}ms cubic-bezier(0.16,1,0.3,1)`,
        }}
      >
        {/* Header */}
        <div className="px-3 pt-2.5 pb-1.5 border-b border-gray-100">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            Skill Level
          </span>
        </div>

        {/* Level options */}
        {LEVEL_LABELS.map((label, i) => {
          const isActive = i === currentLevel
          const color = LEVEL_COLORS[i]
          return (
            <button
              key={i}
              type="button"
              role="option"
              aria-selected={isActive}
              onClick={() => { onSelect(i); handleClose() }}
              className={[
                'relative flex w-full items-center gap-2.5 px-3 text-left transition-colors duration-75',
                isActive
                  ? 'bg-[#f5f5f5]'
                  : 'hover:bg-[#f7f7f7] active:bg-[#f0f0f0]',
              ].join(' ')}
              style={{ height: PICKER_ITEM_HEIGHT }}
            >
              {/* Colored left accent bar for active level */}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-[7px] left-0 w-[3px] rounded-r-full"
                  style={{ backgroundColor: color }}
                />
              )}
              {/* Mini ring */}
              <SkillLevelIndicator level={i} size={20} strokeWidth={3.5} />

              {/* Level number */}
              <span className="w-3.5 shrink-0 text-[11px] tabular-nums font-medium text-gray-400">
                {i}
              </span>

              {/* Label */}
              <span
                className={[
                  'flex-1 text-[13px]',
                  isActive ? 'font-semibold text-gray-900' : 'text-gray-600',
                ].join(' ')}
              >
                {label}
              </span>

              {/* Active checkmark */}
              {isActive && (
                <span aria-hidden="true">
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 12 12"
                    fill="none"
                    style={{ color }}
                  >
                    <path
                      d="M1.5 6.5L4.5 9.5L10.5 3"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
            </button>
          )
        })}

        {/* Footer padding */}
        <div className="h-1.5" />
      </div>
    </>,
    document.body,
  )
}
