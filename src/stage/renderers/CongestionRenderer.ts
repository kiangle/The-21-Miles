import * as PIXI from 'pixi.js'
import { COLORS } from '../../app/config/constants'

/**
 * CongestionRenderer — Freight lens.
 *
 * Human question: Why is the corridor slowing?
 *
 * Shows: Mombasa→Nairobi corridor as a dominant glowing band, convoy clusters
 * as small circles moving in bursts, depot accumulation as a radial glow,
 * bottleneck as corridor thinning, irregular spacing under pressure.
 */

interface ConvoyBead {
  progress: number
  speed: number
  baseSpeed: number
  radius: number
  groupId: number
}

interface DepotParticle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
}

const FREIGHT_HEX = PIXI.utils.string2hex(COLORS.freight)

// Convoy group config
const GROUP_COUNT = 4
const BEADS_PER_GROUP = 4 // 3-5 per group, we use 4 as midpoint
const GROUP_GAP = 0.20 // 0.15-0.25 gap between groups
const BEAD_CLUSTER_SPREAD = 0.015 // how close beads are within a group

export class CongestionRenderer {
  private container: PIXI.Container
  private corridorGfx: PIXI.Graphics
  private beadGfx: PIXI.Graphics
  private depotGfx: PIXI.Graphics

  private corridorPath: { x: number; y: number }[] = []
  private beads: ConvoyBead[] = []

  private depotParticles: DepotParticle[] = []
  private attractorTarget: { x: number; y: number } | null = null
  private accumulated = 0
  private releaseThreshold = 40

  private pressure = 0.5
  private perspective: 'nurse' | 'driver' | null = null

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container()
    parent.addChild(this.container)
    this.container.visible = false

    // Corridor band (3-pass glow)
    this.corridorGfx = new PIXI.Graphics()
    this.container.addChild(this.corridorGfx)

    // Depot glow (drawn behind beads)
    this.depotGfx = new PIXI.Graphics()
    this.container.addChild(this.depotGfx)

    // All convoy beads share one Graphics object
    this.beadGfx = new PIXI.Graphics()
    this.container.addChild(this.beadGfx)
  }

  setCorridor(path: { x: number; y: number }[]) {
    this.corridorPath = path
    this.beads = []
    // Spawn convoy clusters: GROUP_COUNT groups, each with 3-5 beads
    for (let g = 0; g < GROUP_COUNT; g++) {
      const groupBase = (g / GROUP_COUNT) * (1 - GROUP_GAP) + (g * GROUP_GAP) / GROUP_COUNT
      const beadCount = 3 + Math.floor(Math.random() * 3) // 3-5
      for (let b = 0; b < beadCount; b++) {
        this.beads.push({
          progress: (groupBase + b * BEAD_CLUSTER_SPREAD) % 1,
          baseSpeed: 0.0008 + Math.random() * 0.0006,
          speed: 0.0008 + Math.random() * 0.0006,
          radius: 2 + Math.random() * 1.5, // 2-3.5
          groupId: g,
        })
      }
    }
  }

  setAttractor(target: { x: number; y: number }) {
    this.attractorTarget = target
  }

  spawn(x: number, y: number) {
    this.depotParticles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      radius: 1.5 + Math.random() * 1.5,
    })
  }

  setPressure(p: number) {
    this.pressure = Math.max(0, Math.min(1.5, p))
  }

  setPerspective(role: 'nurse' | 'driver' | null) {
    this.perspective = role
  }

  update(delta: number) {
    const dt = delta * 60
    const time = Date.now() * 0.001
    const speedMod = 1.0 - this.pressure * 0.5

    this.drawCorridor(time)
    this.updateBeads(dt, time, speedMod)
    this.drawBeads(time)
    this.drawDepotGlow(time)
    this.updateDepotParticles(dt, time)

    // Driver perspective: full alpha. Other: 0.75.
    this.container.alpha = this.perspective === 'driver' ? 1.0 : 0.75
  }

  // ── Corridor band: 3-pass multi-width glow with bottleneck thinning ──

  private drawCorridor(time: number) {
    this.corridorGfx.clear()
    if (this.corridorPath.length < 2) return

    // Bottleneck thinning factor at each point: near the start (progress < 0.3)
    // the band narrows under pressure
    const passes = [
      { widthBase: 16, alpha: 0.04 + this.pressure * 0.02 },   // wide dim
      { widthBase: 9, alpha: 0.08 + this.pressure * 0.03 },    // medium softer
      { widthBase: 3, alpha: 0.25 + this.pressure * 0.06 },    // narrow bright
    ]

    for (const pass of passes) {
      this.drawGlowingPath(pass.widthBase, pass.alpha, time)
    }
  }

  private drawGlowingPath(widthBase: number, alpha: number, _time: number) {
    const path = this.corridorPath
    const total = path.length - 1

    // Draw segment by segment so we can vary width for bottleneck thinning
    for (let i = 0; i < total; i++) {
      const t = i / total // progress along corridor
      // Bottleneck: thinning near the start under pressure
      let thinFactor = 1.0
      if (t < 0.3 && this.pressure > 0.3) {
        // Maximum thinning at t=0.15
        const proximity = 1.0 - Math.abs(t - 0.15) / 0.15
        thinFactor = 1.0 - proximity * this.pressure * 0.5
      }
      const w = widthBase * thinFactor + this.pressure * widthBase * 0.15
      this.corridorGfx.lineStyle(w, FREIGHT_HEX, alpha)
      this.corridorGfx.moveTo(path[i].x, path[i].y)
      this.corridorGfx.lineTo(path[i + 1].x, path[i + 1].y)
    }
  }

  // ── Convoy beads: group movement with irregular spacing under pressure ──

  private updateBeads(dt: number, _time: number, speedMod: number) {
    if (this.corridorPath.length < 2) return

    for (const bead of this.beads) {
      // Base movement
      let effectiveSpeed = bead.baseSpeed * speedMod * dt

      // Under pressure, beads near the start (progress < 0.3) slow down unevenly
      if (this.pressure > 0.3 && bead.progress < 0.3) {
        // Irregular slowdown: use sin with bead-specific offset for uneven clumping
        const slowFactor = this.pressure * (0.5 + 0.4 * Math.sin(bead.progress * 30 + bead.groupId * 2.1))
        effectiveSpeed *= Math.max(0.05, 1.0 - slowFactor)
      }

      bead.speed = effectiveSpeed / dt // store for potential use
      bead.progress += effectiveSpeed

      // Wrap
      if (bead.progress > 1) bead.progress -= 1
      if (bead.progress < 0) bead.progress += 1
    }
  }

  private drawBeads(time: number) {
    this.beadGfx.clear()
    if (this.corridorPath.length < 2) return

    const totalSegs = this.corridorPath.length - 1

    for (const bead of this.beads) {
      const t = bead.progress
      const seg = Math.min(Math.floor(t * totalSegs), totalSegs - 1)
      const lt = t * totalSegs - seg

      const x =
        this.corridorPath[seg].x +
        (this.corridorPath[seg + 1].x - this.corridorPath[seg].x) * lt
      const y =
        this.corridorPath[seg].y +
        (this.corridorPath[seg + 1].y - this.corridorPath[seg].y) * lt

      // Pulsing alpha per bead
      const pulseAlpha =
        0.6 + Math.sin(time * 2 + bead.progress * 20 + bead.groupId) * this.pressure * 0.25

      // Soft outer glow per bead
      this.beadGfx.beginFill(FREIGHT_HEX, pulseAlpha * 0.25)
      this.beadGfx.drawCircle(x, y, bead.radius * 2)
      this.beadGfx.endFill()

      // Core circle
      this.beadGfx.beginFill(FREIGHT_HEX, pulseAlpha)
      this.beadGfx.drawCircle(x, y, bead.radius)
      this.beadGfx.endFill()
    }
  }

  // ── Depot accumulation glow: concentric circles with decreasing alpha ──

  private drawDepotGlow(time: number) {
    this.depotGfx.clear()
    if (!this.attractorTarget) return

    const { x, y } = this.attractorTarget
    const intensity = 0.1 + this.pressure * 0.35
    const breathe = Math.sin(time * 1.5) * 3

    // Concentric rings: outermost to innermost, decreasing radius, increasing alpha
    const rings = [
      { r: 28 + this.pressure * 18 + breathe, alphaScale: 0.12 },
      { r: 20 + this.pressure * 12 + breathe * 0.7, alphaScale: 0.22 },
      { r: 12 + this.pressure * 6 + breathe * 0.4, alphaScale: 0.35 },
      { r: 5 + this.pressure * 3, alphaScale: 0.55 },
    ]

    for (const ring of rings) {
      this.depotGfx.beginFill(FREIGHT_HEX, intensity * ring.alphaScale)
      this.depotGfx.drawCircle(x, y, ring.r)
      this.depotGfx.endFill()
    }

    // Draw accumulated depot particles as small circles
    for (let i = 0; i < this.depotParticles.length; i++) {
      const p = this.depotParticles[i]
      const alpha = 0.3 + 0.2 * Math.sin(time * 2 + i)
      this.depotGfx.beginFill(FREIGHT_HEX, alpha)
      this.depotGfx.drawCircle(p.x, p.y, p.radius)
      this.depotGfx.endFill()
    }
  }

  // ── Depot particles: drift and accumulate ──

  private updateDepotParticles(dt: number, _time: number) {
    for (let i = 0; i < this.depotParticles.length; i++) {
      const p = this.depotParticles[i]

      if (this.attractorTarget) {
        const dx = this.attractorTarget.x - p.x
        const dy = this.attractorTarget.y - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist > 5) {
          const force = 0.00003 * dist * (1 + this.pressure)
          p.vx += (dx / dist) * force * dt
          p.vy += (dy / dist) * force * dt
        } else {
          this.accumulated++
        }
      }

      p.vx *= 0.97
      p.vy *= 0.97
      p.x += p.vx * dt
      p.y += p.vy * dt
    }

    if (this.accumulated >= this.releaseThreshold) {
      this.accumulated = 0
      this.releasePulse()
    }
  }

  private releasePulse() {
    if (!this.attractorTarget) return
    for (const p of this.depotParticles) {
      const dx = p.x - this.attractorTarget.x
      const dy = p.y - this.attractorTarget.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 30 && dist > 0) {
        p.vx += (dx / dist) * 1.5
        p.vy += (dy / dist) * 1.5
      }
    }
  }

  setVisible(visible: boolean) {
    this.container.visible = visible
  }

  clear() {
    this.beads = []
    this.beadGfx.clear()
    this.depotParticles = []
    this.depotGfx.clear()
    this.corridorGfx.clear()
    this.accumulated = 0
  }

  dispose() {
    this.clear()
    this.container.destroy({ children: true })
  }
}
