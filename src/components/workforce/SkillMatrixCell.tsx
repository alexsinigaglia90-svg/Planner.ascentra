'use client'

import { useEffect, useRef, useState } from 'react'
import { SkillLevelIndicator, LEVEL_LABELS } from './SkillLevelIndicator'
import { SkillLevelPicker } from './SkillLevelPicker'

// ─── SkillMatrixCell ──────────────────────────────────────────────────────────
// Matrix cell: clicking opens a compact inline level picker.
// Provides bump feedback when level changes and hover lift.

interface Props {
  level: number
  canEdit: boolean
  onSelect: (level: number) => void
}

export function SkillMatrixCell({ level, canEdit, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [bumped, setBumped] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const prevLvRef = useRef(level)

  const lv = Math.max(0, Math.min(4, level))
  const label = LEVEL_LABELS[lv]

  // Brief scale-pop when the level changes (optimistic update fires this)
  useEffect(() => {
    if (lv !== prevLvRef.current) {
      prevLvRef.current = lv
      setBumped(true)
      const id = setTimeout(() => setBumped(false), 280)
      return () => clearTimeout(id)
    }
  }, [lv])

  // Compose scale from priority: bump > open-dim > hover > idle
  const indicatorScale = bumped ? 1.18 : open ? 0.88 : hovered && canEdit ? 1.07 : 1
  const indicatorTransition = bumped
    ? 'transform 110ms cubic-bezier(0.34,1.56,0.64,1)'
    : 'transform 160ms ease-out'

  function handleClick() {
    if (!canEdit) return
    setOpen((v) => !v)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={!canEdit}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={canEdit ? `${label} — click to change` : label}
        aria-label={`Level: ${label}${canEdit ? '. Click to change.' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          'flex items-center justify-center rounded-full outline-none',
          canEdit
            ? 'cursor-pointer focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-1'
            : 'cursor-default',
        ].join(' ')}
        style={{ width: 40, height: 40 }}
      >
        <span
          style={{
            display: 'block',
            transform: `scale(${indicatorScale})`,
            transition: indicatorTransition,
            willChange: 'transform',
          }}
        >
          <SkillLevelIndicator level={lv} />
        </span>
      </button>

      {open && (
        <SkillLevelPicker
          anchorEl={triggerRef.current}
          currentLevel={lv}
          onSelect={onSelect}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
