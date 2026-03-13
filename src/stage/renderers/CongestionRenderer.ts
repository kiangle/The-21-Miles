import * as PIXI from 'pixi.js'
import { COLORS } from '../../app/config/constants'

/**
 * CongestionRenderer — Freight lens.
 *
 * Human question: Why is the corridor slowing?
 *
 * Shows: Mombasa→Nairobi corridor, convoy rhythm, depot accumulation,
 * uneven spacing, bottleneck under reduced throughput.
 * Truck-hint beads move along the corridor band. Depot glow intensifies
 * as cargo accumulates. Bottleneck gate restricts flow.
 */

interface ConvoyBead {
  graphic: PIXI.Graphics
  progress: number
  speed: number
  size: number
}

export class CongestionRenderer {
  private container: PIXI.Container
  private corridorBand: PIXI.Graphics
  private corridorPath: { x: number; y: number }[] = []
  private beads: ConvoyBead[] = []
  private depotGlow: PIXI.Graphics
  private bottleneckGate: PIXI.Graphics

  // Depot attractor particles
  private particles: PIXI.Graphics[] = []
  private positions: { x: number; y: number; vx: number; vy: number }[] = []
  private attractorTarget: { x: number; y: number } | null = null
  private accumulated = 0
  private releaseThreshold = 40

  private pressure = 0.5
  private perspective: 'nurse' | 'driver' | null = null

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container()
    parent.addChild(this.container)
    this.container.visible = false

    this.corridorBand = new PIXI.Graphics()
    this.container.addChild(this.corridorBand)

    this.depotGlow = new PIXI.Graphics()
    this.container.addChild(this.depotGlow)

    this.bottleneckGate = new PIXI.Graphics()
    this.container.addChild(this.bottleneckGate)
  }

  setCorridor(path: { x: number; y: number }[]) {
    this.corridorPath = path
    for (let i = 0; i < 20; i++) {
      this.spawnBead()
    }
  }

  private spawnBead() {
    const g = new PIXI.Graphics()
    const size = 2.5 + Math.random() * 2
    const color = PIXI.utils.string2hex(COLORS.freight)
    // Truck hint: rectangle body + cab
    g.beginFill(color, 0.8)
    g.drawRect(-size, -size * 0.5, size * 1.6, size)
    g.endFill()
    g.beginFill(color, 0.6)
    g.drawRect(size * 0.6, -size * 0.4, size * 0.5, size * 0.8)
    g.endFill()

    this.container.addChild(g)
    this.beads.push({
      graphic: g, progress: Math.random(),
      speed: 0.0008 + Math.random() * 0.001, size,
    })
  }

  setAttractor(target: { x: number; y: number }) {
    this.attractorTarget = target
  }

  spawn(x: number, y: number) {
    const g = new PIXI.Graphics()
    g.beginFill(PIXI.utils.string2hex(COLORS.freight), 0.5)
    g.drawCircle(0, 0, 1.5 + Math.random() * 1.5)
    g.endFill()
    g.x = x
    g.y = y
    this.container.addChild(g)
    this.particles.push(g)
    this.positions.push({ x, y, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3 })
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

    // ── Corridor band ──
    if (this.corridorPath.length > 1) {
      this.corridorBand.clear()
      const glowW = 8 + this.pressure * 6
      this.corridorBand.lineStyle(glowW, PIXI.utils.string2hex(COLORS.freight), 0.06 + this.pressure * 0.04)
      this.corridorBand.moveTo(this.corridorPath[0].x, this.corridorPath[0].y)
      for (let i = 1; i < this.corridorPath.length; i++) this.corridorBand.lineTo(this.corridorPath[i].x, this.corridorPath[i].y)

      this.corridorBand.lineStyle(2, PIXI.utils.string2hex(COLORS.freight), 0.3)
      this.corridorBand.moveTo(this.corridorPath[0].x, this.corridorPath[0].y)
      for (let i = 1; i < this.corridorPath.length; i++) this.corridorBand.lineTo(this.corridorPath[i].x, this.corridorPath[i].y)
    }

    // ── Convoy beads ──
    if (this.corridorPath.length > 1) {
      const totalSegs = this.corridorPath.length - 1
      for (const bead of this.beads) {
        bead.progress += bead.speed * speedMod * dt
        // Bottleneck near port
        if (bead.progress < 0.25 && this.pressure > 0.4) {
          bead.progress -= bead.speed * speedMod * dt * 0.6 * this.pressure
        }
        if (bead.progress > 1) bead.progress -= 1
        if (bead.progress < 0) bead.progress += 1

        const t = bead.progress
        const seg = Math.min(Math.floor(t * totalSegs), totalSegs - 1)
        const lt = (t * totalSegs) - seg
        bead.graphic.x = this.corridorPath[seg].x + (this.corridorPath[seg + 1].x - this.corridorPath[seg].x) * lt
        bead.graphic.y = this.corridorPath[seg].y + (this.corridorPath[seg + 1].y - this.corridorPath[seg].y) * lt
        bead.graphic.alpha = 0.6 + Math.sin(time * 2 + bead.progress * 20) * this.pressure * 0.3
      }
    }

    // ── Depot glow ──
    if (this.attractorTarget) {
      this.depotGlow.clear()
      const depotI = 0.1 + this.pressure * 0.3
      const depotR = 12 + this.pressure * 15 + Math.sin(time * 1.5) * 3
      this.depotGlow.beginFill(PIXI.utils.string2hex(COLORS.freight), depotI * 0.2)
      this.depotGlow.drawCircle(this.attractorTarget.x, this.attractorTarget.y, depotR)
      this.depotGlow.endFill()
      this.depotGlow.lineStyle(1.5, PIXI.utils.string2hex(COLORS.freight), depotI)
      this.depotGlow.drawCircle(this.attractorTarget.x, this.attractorTarget.y, depotR * 0.7)
      // Cargo stack hint
      const sz = 4
      this.depotGlow.beginFill(PIXI.utils.string2hex(COLORS.freight), 0.4)
      this.depotGlow.drawRect(this.attractorTarget.x - sz, this.attractorTarget.y - sz, sz * 2, sz * 2)
      this.depotGlow.endFill()
    }

    // ── Bottleneck gate ──
    if (this.corridorPath.length > 2 && this.pressure > 0.3) {
      this.bottleneckGate.clear()
      const gatePos = this.corridorPath[1]
      const gateOpen = 1 - this.pressure * 0.6
      const gateH = 8
      this.bottleneckGate.lineStyle(2, PIXI.utils.string2hex(COLORS.warning), 0.3 + this.pressure * 0.3)
      this.bottleneckGate.moveTo(gatePos.x, gatePos.y - gateH)
      this.bottleneckGate.lineTo(gatePos.x, gatePos.y - gateH * gateOpen)
      this.bottleneckGate.moveTo(gatePos.x, gatePos.y + gateH * gateOpen)
      this.bottleneckGate.lineTo(gatePos.x, gatePos.y + gateH)
    } else {
      this.bottleneckGate.clear()
    }

    // ── Depot particles ──
    for (let i = 0; i < this.particles.length; i++) {
      const pos = this.positions[i]
      if (this.attractorTarget) {
        const dx = this.attractorTarget.x - pos.x
        const dy = this.attractorTarget.y - pos.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 5) {
          const force = 0.00003 * dist * (1 + this.pressure)
          pos.vx += (dx / dist) * force * dt
          pos.vy += (dy / dist) * force * dt
        } else {
          this.accumulated++
        }
      }
      pos.vx *= 0.97
      pos.vy *= 0.97
      pos.x += pos.vx * dt
      pos.y += pos.vy * dt
      this.particles[i].x = pos.x
      this.particles[i].y = pos.y
      this.particles[i].alpha = 0.3 + 0.2 * Math.sin(time * 2 + i)
    }

    if (this.accumulated >= this.releaseThreshold) {
      this.accumulated = 0
      this.releasePulse()
    }

    // Joseph's perspective: freight is vivid
    this.container.alpha = this.perspective === 'driver' ? 1.0 : 0.75
  }

  private releasePulse() {
    if (!this.attractorTarget) return
    for (let i = 0; i < this.particles.length; i++) {
      const pos = this.positions[i]
      const dx = pos.x - this.attractorTarget.x
      const dy = pos.y - this.attractorTarget.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 30 && dist > 0) {
        pos.vx += (dx / dist) * 1.5
        pos.vy += (dy / dist) * 1.5
      }
    }
  }

  setVisible(visible: boolean) {
    this.container.visible = visible
  }

  clear() {
    this.beads.forEach(b => b.graphic.destroy())
    this.beads = []
    this.particles.forEach(p => p.destroy())
    this.particles = []
    this.positions = []
    this.accumulated = 0
  }

  dispose() {
    this.clear()
    this.container.destroy({ children: true })
  }
}
