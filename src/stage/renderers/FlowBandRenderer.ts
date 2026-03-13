import * as PIXI from 'pixi.js'
import { COLORS } from '../../app/config/constants'

/**
 * FlowBandRenderer — Shipping lens.
 *
 * Human question: Where did the ships go?
 *
 * Shows: chokepoint blockage, bunching upstream, reroute around Africa,
 * maritime current, slower longer path. Thick glowing path bands carry
 * small circle particles with afterimage trails. Width modulates with
 * pressure; queue bloom grows near the chokepoint. Reroute bands fade
 * in as pressure rises.
 */

interface ParticleData {
  progress: number
  speed: number
  trail: { x: number; y: number }[]
}

export interface FlowBand {
  container: PIXI.Container
  pathGraphics: PIXI.Graphics
  particleGraphics: PIXI.Graphics
  particles: ParticleData[]
  path: { x: number; y: number }[]
  progresses: number[]
  speeds: number[]
  active: boolean
  isReroute: boolean
  baseColor: number
  baseWidth: number
}

// ── Drawing helpers ──────────────────────────────────────────────────

/**
 * Glowing path: draw same path 3 times at increasing width and decreasing alpha.
 */
function drawGlowingPath(
  g: PIXI.Graphics,
  points: { x: number; y: number }[],
  baseWidth: number,
  color: number,
  alpha: number,
) {
  if (points.length < 2) return
  for (let pass = 2; pass >= 0; pass--) {
    const w = baseWidth * (1 + pass * 1.2)
    const a = alpha * (pass === 0 ? 1 : pass === 1 ? 0.15 : 0.04)
    g.lineStyle(w, color, a)
    g.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y)
  }
}

/**
 * Queue bloom: soft radial gradient via concentric circles.
 */
function drawQueueBloom(
  g: PIXI.Graphics,
  x: number,
  y: number,
  pressure: number,
) {
  const layers = 5
  for (let i = layers; i >= 0; i--) {
    const r = (8 + i * 6) * pressure
    const a = 0.02 + (layers - i) * 0.015 * pressure
    g.beginFill(0xFF5555, a)
    g.drawCircle(x, y, r)
    g.endFill()
  }
}

// ── Renderer ─────────────────────────────────────────────────────────

export class FlowBandRenderer {
  private container: PIXI.Container
  private bands: FlowBand[] = []
  private pressure = 0.5
  private perspective: 'nurse' | 'driver' | null = null
  private constricted = false

  // Anchor nodes
  private chokepointGlow: PIXI.Graphics
  private portNode: PIXI.Graphics
  private queueBloom: PIXI.Graphics

  // Stored positions for dynamic redraws
  private chokepointPos: { x: number; y: number } | null = null
  private portPos: { x: number; y: number } | null = null

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container()
    parent.addChild(this.container)

    // Chokepoint — soft pulsing glow (no ring, no cross)
    this.chokepointGlow = new PIXI.Graphics()
    this.container.addChild(this.chokepointGlow)

    // Port node — warm subtle dot
    this.portNode = new PIXI.Graphics()
    this.container.addChild(this.portNode)

    // Queue density bloom
    this.queueBloom = new PIXI.Graphics()
    this.container.addChild(this.queueBloom)
  }

  // ── Anchors ──────────────────────────────────────────────────────

  setAnchors(
    chokepoint: { x: number; y: number },
    port: { x: number; y: number },
  ) {
    this.chokepointPos = chokepoint
    this.portPos = port
    this.drawChokepointGlow(chokepoint)
    this.drawPortNode(port)
  }

  /** Soft pulsing glow — no ring, no X */
  private drawChokepointGlow(pos: { x: number; y: number }) {
    this.chokepointGlow.clear()
    // Layered radial glow
    const layers = 4
    for (let i = layers; i >= 0; i--) {
      const r = 6 + i * 5
      const a = 0.25 - i * 0.05
      this.chokepointGlow.beginFill(0xFF5555, Math.max(0.02, a))
      this.chokepointGlow.drawCircle(pos.x, pos.y, r)
      this.chokepointGlow.endFill()
    }
  }

  /** Port node — warm subtle dot */
  private drawPortNode(pos: { x: number; y: number }) {
    this.portNode.clear()
    // Outer soft halo
    this.portNode.beginFill(0xC8A96E, 0.1)
    this.portNode.drawCircle(pos.x, pos.y, 8)
    this.portNode.endFill()
    // Inner warm dot
    this.portNode.beginFill(0xC8A96E, 0.45)
    this.portNode.drawCircle(pos.x, pos.y, 4)
    this.portNode.endFill()
  }

  // ── Band management ──────────────────────────────────────────────

  addBand(
    path: { x: number; y: number }[],
    particleCount: number,
    color: string = COLORS.shipping,
    width: number = 3,
    isReroute = false,
  ): FlowBand {
    const bandContainer = new PIXI.Container()
    this.container.addChild(bandContainer)
    const hexColor = PIXI.utils.string2hex(color)

    // Path graphics — thick glowing band (redrawn each frame for width modulation)
    const pathGraphics = new PIXI.Graphics()
    bandContainer.addChild(pathGraphics)
    drawGlowingPath(pathGraphics, path, width, hexColor, 0.7)

    // Single shared Graphics for ALL particles in this band
    const particleGraphics = new PIXI.Graphics()
    bandContainer.addChild(particleGraphics)

    // Particle data
    const particles: ParticleData[] = []
    const progresses: number[] = []
    const speeds: number[] = []

    for (let i = 0; i < particleCount; i++) {
      const progress = Math.random()
      const speed = 0.001 + Math.random() * 0.002
      progresses.push(progress)
      speeds.push(speed)
      particles.push({
        progress,
        speed,
        trail: [],
      })
    }

    const band: FlowBand = {
      container: bandContainer,
      pathGraphics,
      particleGraphics,
      particles,
      path,
      progresses,
      speeds,
      active: true,
      isReroute,
      baseColor: hexColor,
      baseWidth: width,
    }

    // Reroute bands start nearly invisible
    if (isReroute) {
      bandContainer.alpha = 0.15
    }

    this.bands.push(band)
    return band
  }

  setPressure(p: number) {
    this.pressure = Math.max(0, Math.min(1.5, p))
  }

  setPerspective(role: 'nurse' | 'driver' | null) {
    this.perspective = role
  }

  setConstricted(constricted: boolean) {
    this.constricted = constricted
  }

  // ── Frame update ─────────────────────────────────────────────────

  update(delta: number) {
    const time = Date.now() * 0.001
    const speedMod = this.constricted ? 0.08 : (1.0 - this.pressure * 0.4)

    // Width modulation: bands get thinner under high pressure
    const widthScale = this.constricted
      ? Math.max(0.3, 1.0 - this.pressure * 0.5)
      : 1.0

    for (const band of this.bands) {
      if (!band.active) continue

      const path = band.path
      const totalLen = path.length - 1

      // ── Progressive reroute activation ───────────────────────
      if (band.isReroute) {
        const targetAlpha = this.constricted
          ? Math.min(0.9, 0.2 + this.pressure * 0.7)
          : 0.15
        band.container.alpha += (targetAlpha - band.container.alpha) * 0.02
      }

      // ── Redraw path band with current width modulation ──────
      band.pathGraphics.clear()
      const currentWidth = band.baseWidth * widthScale
      drawGlowingPath(band.pathGraphics, path, currentWidth, band.baseColor, 0.7)

      // ── Move particles ──────────────────────────────────────
      const bandSpeed = band.isReroute ? speedMod * 0.6 : speedMod

      // Clear particle graphics for redraw
      band.particleGraphics.clear()

      for (let i = 0; i < band.particles.length; i++) {
        const pd = band.particles[i]

        // Advance progress
        pd.progress += pd.speed * bandSpeed * delta * 60

        // Queue effect: particles bunch near start of path under constriction
        if (!band.isReroute && this.constricted && pd.progress < 0.3) {
          pd.progress -= pd.speed * bandSpeed * delta * 60 * 0.7
        }

        // Wrap
        if (pd.progress > 1) pd.progress -= 1
        if (pd.progress < 0) pd.progress += 1

        // Keep legacy arrays in sync
        band.progresses[i] = pd.progress
        band.speeds[i] = pd.speed

        // Interpolate position on path
        const t = pd.progress
        const seg = Math.min(Math.floor(t * totalLen), totalLen - 1)
        const localT = (t * totalLen) - seg

        const x = path[seg].x + (path[seg + 1].x - path[seg].x) * localT
        const y = path[seg].y + (path[seg + 1].y - path[seg].y) * localT

        // ── Trail management ────────────────────────────────
        pd.trail.push({ x, y })
        if (pd.trail.length > 4) pd.trail.shift()

        // Particle alpha: bunching opacity near chokepoint
        let particleAlpha: number
        if (this.constricted && !band.isReroute) {
          const proximity = 1 - Math.min(1, pd.progress / 0.3)
          particleAlpha = 0.3 + proximity * 0.6
        } else {
          particleAlpha = 0.75
        }

        // ── Draw trail segments (decreasing alpha) ──────────
        const trailLen = pd.trail.length
        if (trailLen >= 2) {
          for (let ti = 0; ti < trailLen - 1; ti++) {
            const trailAlpha = particleAlpha * ((ti + 1) / trailLen) * 0.4
            const trailWidth = 1.0 + ((ti + 1) / trailLen) * 1.0
            band.particleGraphics.lineStyle(trailWidth, band.baseColor, trailAlpha)
            band.particleGraphics.moveTo(pd.trail[ti].x, pd.trail[ti].y)
            band.particleGraphics.lineTo(pd.trail[ti + 1].x, pd.trail[ti + 1].y)
          }
        }

        // ── Draw particle as a small circle ─────────────────
        const radius = 1.5 + Math.random() * 1.0 // 1.5–2.5
        band.particleGraphics.lineStyle(0)
        band.particleGraphics.beginFill(band.baseColor, particleAlpha)
        band.particleGraphics.drawCircle(x, y, radius)
        band.particleGraphics.endFill()
      }
    }

    // ── Queue bloom near chokepoint ────────────────────────────────
    this.queueBloom.clear()
    if (this.constricted && this.pressure > 0.3) {
      const chokePos = this.chokepointPos ?? this.bands[0]?.path[0]
      if (chokePos) {
        drawQueueBloom(this.queueBloom, chokePos.x, chokePos.y, this.pressure)
      }
    }

    // ── Animate chokepoint pulsing glow ────────────────────────────
    if (this.chokepointPos) {
      this.chokepointGlow.clear()
      const basePulse = this.constricted
        ? 0.4 + Math.sin(time * 2.5) * 0.25
        : 0.2
      const layers = 4
      for (let i = layers; i >= 0; i--) {
        const r = (6 + i * 5) * (1 + (this.constricted ? Math.sin(time * 2.5) * 0.15 : 0))
        const a = basePulse * (0.25 - i * 0.05)
        this.chokepointGlow.beginFill(0xFF5555, Math.max(0.01, a))
        this.chokepointGlow.drawCircle(
          this.chokepointPos.x,
          this.chokepointPos.y,
          r,
        )
        this.chokepointGlow.endFill()
      }
    }

    // ── Perspective emphasis ────────────────────────────────────────
    // Nurse dims shipping; driver keeps full
    const dimForPerspective = this.perspective === 'nurse' ? 0.5 : 1.0
    this.container.alpha = dimForPerspective
  }

  // ── Visibility ───────────────────────────────────────────────────

  setVisible(visible: boolean) {
    this.container.visible = visible
  }

  clear() {
    this.bands.forEach(b => b.container.destroy({ children: true }))
    this.bands = []
  }

  dispose() {
    this.clear()
    this.container.destroy({ children: true })
  }
}
