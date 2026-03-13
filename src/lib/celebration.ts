const BRAND_COLORS = ['#4F6BFF', '#6C83FF', '#22C55E', '#ffffff']

const BURST_ORIGINS = [
  { xFrac: 0.15, yFrac: 0.30 },
  { xFrac: 0.50, yFrac: 0.24 },
  { xFrac: 0.85, yFrac: 0.30 },
]

function spawnParticle(
  cx: number,
  cy: number,
  idx: number,
  total: number,
  dist: number,
  angleOffset: number,
  fallMode: boolean,
  delay: number,
): void {
  const el = document.createElement('div')
  el.className = fallMode ? 'ds-burst-particle-fall' : 'ds-burst-particle'

  const angle = (idx / total) * 2 * Math.PI + angleOffset
  const d = dist * (0.7 + Math.random() * 0.6)
  const dx = Math.cos(angle) * d
  const dy = fallMode
    ? 60 + Math.random() * 100  // downward fall
    : Math.sin(angle) * d - 20  // upward-biased burst

  const size = fallMode ? 4 + Math.round(Math.random() * 3) : 5 + Math.round(Math.random() * 4)
  const color = BRAND_COLORS[idx % BRAND_COLORS.length]
  const dur = fallMode ? 900 + Math.round(Math.random() * 400) : undefined

  el.style.cssText = [
    `left:${cx}px`,
    `top:${cy}px`,
    `background:${color}`,
    `width:${size}px`,
    `height:${size}px`,
    `--dx:${dx}px`,
    `--dy:${dy}px`,
    delay > 0 ? `animation-delay:${delay}ms` : '',
    dur ? `--dur:${dur}ms` : '',
  ].filter(Boolean).join(';')

  document.body.appendChild(el)
  el.addEventListener('animationend', () => el.remove(), { once: true })
}

/**
 * Upgraded 3-origin burst. Used directly for single-origin moments.
 * @deprecated Prefer celebrateSuccess() for major events.
 */
export function triggerCelebration(): void {
  if (typeof document === 'undefined') return
  celebrateSuccess()
}

/** Inject the ambient success flash overlay. */
export function showSuccessFlash(): void {
  if (typeof document === 'undefined') return
  const el = document.createElement('div')
  el.className = 'ds-success-flash'
  document.body.appendChild(el)
  el.addEventListener('animationend', () => el.remove(), { once: true })
}

/**
 * Premium major success sequence:
 * ambient flash + 3-origin confetti burst + trickle fall.
 * Use only for bulk import, planning generation, or template applied.
 */
export function celebrateSuccess(): void {
  if (typeof document === 'undefined') return

  showSuccessFlash()

  const W = window.innerWidth
  const H = window.innerHeight

  // Phase 1 — simultaneous burst from 3 origins (t=0)
  for (const o of BURST_ORIGINS) {
    const cx = o.xFrac * W
    const cy = o.yFrac * H
    for (let i = 0; i < 20; i++) {
      spawnParticle(cx, cy, i, 20, 88, o.xFrac * 0.4, false, 0)
    }
  }

  // Phase 2 — trickle fall from center + spread positions (t=320ms)
  setTimeout(() => {
    for (const o of BURST_ORIGINS) {
      const cx = o.xFrac * W + (Math.random() - 0.5) * 60
      const cy = o.yFrac * H - 20
      for (let i = 0; i < 8; i++) {
        spawnParticle(cx, cy, i, 8, 30, 0, true, i * 30)
      }
    }
  }, 320)

  // Phase 3 — final light scatter (t=700ms)
  setTimeout(() => {
    const cx = W * 0.5
    const cy = H * 0.20
    for (let i = 0; i < 10; i++) {
      spawnParticle(cx + (Math.random() - 0.5) * W * 0.5, cy, i, 10, 24, 0, true, i * 40)
    }
  }, 700)
}
