'use client'

import { useRef, useState } from 'react'
import { SkillLevelIndicator, LEVEL_LABELS } from './SkillLevelIndicator'
import { SkillLevelPicker } from './SkillLevelPicker'

// ─── SkillMatrixCell ──────────────────────────────────────────────────────────
// Matrix cell: clicking opens a compact inline level picker.

interface Props {
  level: number
  canEdit: boolean
  onSelect: (level: number) => void
}

export function SkillMatrixCell({ level, canEdit, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const lv = Math.max(0, Math.min(4, level))
  const label = LEVEL_LABELS[lv]

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
        title={canEdit ? `${label} — click to change` : label}
        aria-label={`Level: ${label}${canEdit ? '. Click to change.' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          'flex items-center justify-center rounded-full outline-none transition-opacity',
          open ? 'opacity-60' : '',
          canEdit
            ? 'cursor-pointer hover:opacity-80 focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-1'
            : 'cursor-default',
        ].join(' ')}
        style={{ width: 40, height: 40 }}
      >
        <SkillLevelIndicator level={lv} />
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
