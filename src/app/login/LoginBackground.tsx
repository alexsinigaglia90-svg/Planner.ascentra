'use client'

/**
 * LoginBackground
 * ────────────────────────────────────────────────────────────────
 * Three-layer cinematic background for the Planner Ascentra login page.
 *
 * Layer 1 — Atmospheric lights
 *   Large, slow-drifting radial gradients in deep navy / graphite.
 *   Near-imperceptible movement; adds cool undertone and luxury depth.
 *
 * Layer 2 — Logistics network
 *   Sparse node-and-edge graph suggesting supply-chain infrastructure.
 *   Nodes breathe softly. Occasional data pulses travel along edges.
 *
 * Layer 3 — Ambient signal particles
 *   Micro-dots drifting at glacial speed. Suggests operational flow.
 *
 * Performance notes:
 *   - Pure canvas, no library dependencies.
 *   - DPR capped at 2; all drawing is simple primitives.
 *   - Delta-time based updates (frame-rate independent).
 *   - Respects prefers-reduced-motion: draws one static frame, no loop.
 *   - Mobile path reduces node/particle counts automatically.
 *   - Subtle pointer parallax on the light layer only (desktop).
 */

import { useEffect, useRef } from 'react'

// ─── Tuning constants (easy to adjust without touching logic) ────────────────

// Atmospheric lights — position as fraction of W/H, ax/ay = drift amplitude
const LIGHTS = [
  { rx: 0.12, ry: 0.18, r: 600, col: '35,52,90',   op: 0.062, ax: 0.13, ay: 0.11, period: 40000 },
  { rx: 0.84, ry: 0.74, r: 470, col: '52,68,104',  op: 0.052, ax: 0.15, ay: 0.21, period: 48000 },
  { rx: 0.42, ry: 0.92, r: 400, col: '68,84,114',  op: 0.044, ax: 0.19, ay: 0.09, period: 36000 },
  { rx: 0.91, ry: 0.16, r: 360, col: '26,46,86',   op: 0.048, ax: 0.09, ay: 0.17, period: 56000 },
] as const

// Network nodes
const NC_DESK = 15      // desktop node count
const NC_MOB  = 9       // mobile node count
const CONN_BASE = 265   // connection max-distance at reference width (1440px)
const LINE_MAX  = 0.15  // max line alpha

// Node appearance
const NR_MIN = 1.8, NR_MAX = 3.2
const NA_MIN = 0.27, NA_MAX = 0.50
const BREATHE_AMP    = 0.09   // pulse amplitude (fraction of radius)
const BREATHE_PERIOD = 5500   // ms per breathe cycle

// Data pulses
const PULSE_MAX      = 2      // max simultaneous pulses
const PULSE_INTERVAL = 5000   // ms between pulse spawns
const PULSE_SPEED    = 0.00028 // progress per ms
const PULSE_R        = 2.0    // dot radius
const PULSE_ALPHA    = 0.50   // peak alpha

// Particles
const PC_DESK = 18, PC_MOB = 10
const PA_MIN  = 0.07, PA_MAX = 0.17
const PR      = 0.9  // radius
const PSPEED  = 0.013 // px/ms

// Pointer parallax for light layer (desktop only)
const PARALLAX = 5    // max pixel offset

// ─── Internal types ──────────────────────────────────────────────────────────

interface NodeT {
  x: number; y: number; r: number; alpha: number
  phase: number; period: number
}

interface PulseT { a: number; b: number; t: number }

interface ParticleT {
  x: number; y: number; vx: number; vy: number
  alpha: number; r: number
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LoginBackground() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const _c = ref.current
    if (!_c) return
    const _ctx = _c.getContext('2d')
    if (!_ctx) return

    // Typed aliases — declared types are non-nullable, so closures stay clean
    const canvas: HTMLCanvasElement = _c
    const ctx: CanvasRenderingContext2D = _ctx

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const mobile = () => window.innerWidth < 768
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2)

    let W = 0, H = 0

    // Pointer tracking
    const ptr   = { x: 0.5, y: 0.5 }  // raw, normalized
    const lerp  = { x: 0.5, y: 0.5 }  // smoothed

    // Scene
    let nodes: NodeT[]       = []
    let edges: [number, number, number][] = [] // [i, j, distFraction]
    let pulses: PulseT[]     = []
    let particles: ParticleT[] = []
    let lastPulseTs = 0

    // ── Scene initialisation ────────────────────────────────────────────────
    function initScene() {
      const isMob = mobile()
      const nc = isMob ? NC_MOB : NC_DESK
      const pc = isMob ? PC_MOB : PC_DESK

      // Golden-angle spiral — evenly spread nodes, padded from edges
      nodes = Array.from({ length: nc }, (_, i) => {
        const frac  = i / nc
        const angle = i * 2.399963            // golden angle (rad)
        const spread = 0.28 + frac * 0.54    // radial spread 28–82 %
        const nx = W * (0.5 + Math.cos(angle) * spread * 0.50)
        const ny = H * (0.5 + Math.sin(angle) * spread * 0.44)
        return {
          x: Math.max(48, Math.min(W - 48, nx)),
          y: Math.max(48, Math.min(H - 48, ny)),
          r: NR_MIN + Math.random() * (NR_MAX - NR_MIN),
          alpha: NA_MIN + Math.random() * (NA_MAX - NA_MIN),
          phase: Math.random() * Math.PI * 2,
          period: BREATHE_PERIOD * (0.78 + Math.random() * 0.44),
        }
      })

      // Edge list — store normalised distance so we can shade line opacity
      const maxDist = CONN_BASE * (W / 1440)
      edges = []
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const d  = Math.sqrt(dx * dx + dy * dy)
          if (d < maxDist) edges.push([i, j, d / maxDist])
        }
      }

      // Particles — random walk
      particles = Array.from({ length: pc }, () => {
        const a   = Math.random() * Math.PI * 2
        const spd = PSPEED * (0.4 + Math.random() * 0.8)
        return {
          x: Math.random() * W,
          y: Math.random() * H,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          alpha: PA_MIN + Math.random() * (PA_MAX - PA_MIN),
          r: PR * (0.55 + Math.random() * 0.9),
        }
      })

      pulses = []
    }

    function resize() {
      W = window.innerWidth
      H = window.innerHeight
      canvas.width  = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      canvas.style.width  = W + 'px'
      canvas.style.height = H + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      initScene()
    }

    // ── Draw ───────────────────────────────────────────────────────────────
    function draw(ts: number, dt: number) {
      ctx.clearRect(0, 0, W, H)

      // Smooth pointer
      lerp.x += (ptr.x - lerp.x) * 0.04
      lerp.y += (ptr.y - lerp.y) * 0.04

      // ── Layer 1: Atmospheric lights ─────────────────────────────────────
      const rScale = Math.min(W, H) / 900
      for (const l of LIGHTS) {
        const t   = ts / l.period
        const cx0 = (l.rx + Math.sin(t * Math.PI * 2) * l.ax) * W
        const cy0 = (l.ry + Math.cos(t * Math.PI * 2 * 0.618) * l.ay) * H
        // Pointer parallax
        const ox  = (lerp.x - 0.5) * PARALLAX
        const oy  = (lerp.y - 0.5) * PARALLAX
        const cx  = cx0 + ox
        const cy  = cy0 + oy
        const r   = l.r * rScale

        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        g.addColorStop(0,    `rgba(${l.col},${l.op})`)
        g.addColorStop(0.50, `rgba(${l.col},${l.op * 0.38})`)
        g.addColorStop(1,    `rgba(${l.col},0)`)
        ctx.fillStyle = g
        ctx.fillRect(0, 0, W, H)
      }

      // ── Layer 2: Network edges ──────────────────────────────────────────
      ctx.lineCap = 'round'
      for (const [i, j, df] of edges) {
        const a = (1 - df) * (1 - df) * LINE_MAX
        ctx.strokeStyle = `rgba(36,60,100,${a.toFixed(3)})`
        ctx.lineWidth = 0.65
        ctx.beginPath()
        ctx.moveTo(nodes[i].x, nodes[i].y)
        ctx.lineTo(nodes[j].x, nodes[j].y)
        ctx.stroke()
      }

      // ── Layer 2: Nodes ──────────────────────────────────────────────────
      for (const nd of nodes) {
        const b  = 1 + BREATHE_AMP * Math.sin(ts / nd.period * Math.PI * 2 + nd.phase)
        const r  = nd.r * b

        // Soft halo
        const halo = ctx.createRadialGradient(nd.x, nd.y, 0, nd.x, nd.y, r * 4.5)
        halo.addColorStop(0,   `rgba(28,50,90,${(nd.alpha * 0.42).toFixed(3)})`)
        halo.addColorStop(0.5, `rgba(28,50,90,${(nd.alpha * 0.12).toFixed(3)})`)
        halo.addColorStop(1,   `rgba(28,50,90,0)`)
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(nd.x, nd.y, r * 4.5, 0, Math.PI * 2)
        ctx.fill()

        // Crisp centre dot
        ctx.fillStyle = `rgba(30,54,94,${nd.alpha.toFixed(3)})`
        ctx.beginPath()
        ctx.arc(nd.x, nd.y, r, 0, Math.PI * 2)
        ctx.fill()
      }

      // ── Layer 2: Pulses ─────────────────────────────────────────────────
      if (
        !reduceMotion &&
        edges.length > 0 &&
        pulses.length < PULSE_MAX &&
        ts - lastPulseTs > PULSE_INTERVAL
      ) {
        const ei   = Math.floor(Math.random() * edges.length)
        const [a, b] = edges[ei]
        const [from, to] = Math.random() < 0.5 ? [a, b] : [b, a]
        pulses.push({ a: from, b: to, t: 0 })
        lastPulseTs = ts
      }

      const live: PulseT[] = []
      for (const p of pulses) {
        p.t += PULSE_SPEED * dt
        if (p.t >= 1) continue
        live.push(p)

        // Ease in + ease out opacity envelope
        const env = p.t < 0.14
          ? p.t / 0.14
          : p.t > 0.86
            ? (1 - p.t) / 0.14
            : 1

        const na  = nodes[p.a], nb = nodes[p.b]
        const px  = na.x + (nb.x - na.x) * p.t
        const py  = na.y + (nb.y - na.y) * p.t
        const pa  = (PULSE_ALPHA * env).toFixed(3)

        // Pulse glow
        const pg = ctx.createRadialGradient(px, py, 0, px, py, PULSE_R * 3.8)
        pg.addColorStop(0, `rgba(82,132,210,${pa})`)
        pg.addColorStop(1, `rgba(82,132,210,0)`)
        ctx.fillStyle = pg
        ctx.beginPath()
        ctx.arc(px, py, PULSE_R * 3.8, 0, Math.PI * 2)
        ctx.fill()

        // Pulse dot
        ctx.fillStyle = `rgba(100,152,218,${(PULSE_ALPHA * env * 0.85).toFixed(3)})`
        ctx.beginPath()
        ctx.arc(px, py, PULSE_R, 0, Math.PI * 2)
        ctx.fill()
      }
      pulses = live

      // ── Layer 3: Ambient particles ──────────────────────────────────────
      for (const p of particles) {
        if (!reduceMotion) {
          p.x += p.vx * dt
          p.y += p.vy * dt
          if (p.x < -6) p.x = W + 6
          else if (p.x > W + 6) p.x = -6
          if (p.y < -6) p.y = H + 6
          else if (p.y > H + 6) p.y = -6
        }
        ctx.fillStyle = `rgba(52,72,108,${p.alpha.toFixed(3)})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // ── Animation loop ──────────────────────────────────────────────────────
    let running = true
    let raf     = 0
    let lastTs  = 0

    function loop(ts: number) {
      if (!running) return
      const dt = lastTs === 0 ? 16 : Math.min(ts - lastTs, 50)
      lastTs = ts
      draw(ts, dt)
      raf = requestAnimationFrame(loop)
    }

    resize()

    if (reduceMotion) {
      // Static single frame — elegant fallback
      requestAnimationFrame(ts => draw(ts, 16))
    } else {
      raf = requestAnimationFrame(loop)
    }

    // ── Event listeners ─────────────────────────────────────────────────────
    function onResize() { resize() }
    function onMouse(e: MouseEvent) {
      ptr.x = e.clientX / window.innerWidth
      ptr.y = e.clientY / window.innerHeight
    }

    window.addEventListener('resize', onResize)
    window.addEventListener('mousemove', onMouse, { passive: true })

    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMouse)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}
