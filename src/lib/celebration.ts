const PARTICLE_COUNT = 14
const COLORS = ['#22C55E', '#4ADE80', '#86EFAC', '#ffffff', '#A3E635']

/**
 * Triggers a subtle burst effect at the given origin (defaults to center of screen).
 * Only for major success moments: bulk import, full planning generation, template applied.
 */
export function triggerCelebration(originX?: number, originY?: number): void {
  if (typeof document === 'undefined') return

  const cx = originX ?? window.innerWidth / 2
  const cy = originY ?? window.innerHeight * 0.38

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const el = document.createElement('div')
    el.className = 'ds-burst-particle'

    const angle = (i / PARTICLE_COUNT) * 2 * Math.PI
    const dist = 48 + Math.random() * 44
    const dx = Math.cos(angle) * dist
    const dy = Math.sin(angle) * dist - 28 // slight upward drift

    el.style.cssText = `
      left: ${cx}px;
      top: ${cy}px;
      background: ${COLORS[i % COLORS.length]};
      width: ${4 + Math.round(Math.random() * 4)}px;
      height: ${4 + Math.round(Math.random() * 4)}px;
      --dx: ${dx}px;
      --dy: ${dy}px;
    `

    document.body.appendChild(el)
    el.addEventListener('animationend', () => el.remove(), { once: true })
  }
}
