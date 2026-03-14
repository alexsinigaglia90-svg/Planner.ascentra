'use client'

import { useState } from 'react'
import { SkillLevelIndicator, LEVEL_LABELS } from './SkillLevelIndicator'

// ─── SkillMatrixCell ──────────────────────────────────────────────────────────
// Clickable matrix cell that displays a level indicator and cycles levels on click.

interface Props {
  level: number
  canEdit: boolean
  onCycle: () => void
}

export function SkillMatrixCell({ level, canEdit, onCycle }: Props) {
  const [pressed, setPressed] = useState(false)
  const lv = Math.max(0, Math.min(4, level))
  const label = LEVEL_LABELS[lv]

  function handleClick() {
    if (!canEdit) return
    setPressed(true)
    setTimeout(() => setPressed(false), 130)
    onCycle()
  }

  return (
    <button
      type="button"
      disabled={!canEdit}
      onClick={handleClick}
      title={canEdit ? `${label} — click to advance` : label}
      aria-label={`Level: ${label}${canEdit ? '. Click to advance.' : ''}`}
      className={[
        'flex items-center justify-center rounded-full outline-none',
        canEdit
          ? 'cursor-pointer hover:opacity-80 focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-1'
          : 'cursor-default',
      ].join(' ')}
      style={{
        width: 40,
        height: 40,
        transform: pressed ? 'scale(0.88)' : 'scale(1)',
        transition: 'transform 0.13s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <SkillLevelIndicator level={lv} />
    </button>
  )
}
