import * as PIXI from 'pixi.js'
import { COLORS } from '../../app/config/constants'

/**
 * PulseRenderer — Medicine lens.
 *
 * Human question: Why is the clinic running short?
 *
 * Shows: a single fragile pulse route, heartbeat-cadence medicine dots,
 * missed beats that flash as red ghosts, a depleting shelf bar,
 * and soft pulsing glow rings at pulse points.
 */

interface PulsePoint {
  graphic: PIXI.Graphics
  x: number
  y: number
  phase: number
  baseRadius: number
  strength: number
}

interface MedicinePulse {
  graphic: PIXI.Graphics
  progress: number
  speed: number
  alive: boolean
}

interface MissedBeatGhost {
  graphic: PIXI.Graphics
  age: number       // seconds since spawn
  lifetime: number  // total seconds to live (0.5)
}

export class PulseRenderer {
  private container: PIXI.Container
  private pulses: PulsePoint[] = []
  private supplyLevel = 1.0

  // Supply path (single fragile route)
  private supplyPath: { x: number; y: number }[] = []
  private pathGraphic: PIXI.Graphics
  private medicinePulses: MedicinePulse[] = []
  private cadenceTimer = 0
  private cadenceInterval = 2.0

  // Missed beat ghosts
  private missedGhosts: MissedBeatGhost[] = []

  // Shelf depletion bar
  private shelfGraphic: PIXI.Graphics
  private shelfPos = { x: 0, y: 0 }
  private shelfFill = 1.0
  private shelfTargetFill = 1.0

  // Heartbeat
  private heartbeatLine: PIXI.Graphics
  private heartbeatHistory: number[] = []

  private pressure = 0.5
  private perspective: 'nurse' | 'driver' | null = null

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container()
    parent.addChild(this.container)
    this.container.visible = false

    this.pathGraphic = new PIXI.Graphics()
    this.container.addChild(this.pathGraphic)

    this.shelfGraphic = new PIXI.Graphics()
    this.container.addChild(this.shelfGraphic)

    this.heartbeatLine = new PIXI.Graphics()
    this.container.addChild(this.heartbeatLine)
  }

  setSupplyLevel(pct: number) {
    this.supplyLevel = Math.max(0, Math.min(1, pct / 100))
  }

  setSupplyPath(path: { x: number; y: number }[]) {
    this.supplyPath = path
  }

  setShelfPosition(pos: { x: number; y: number }) {
    this.shelfPos = pos
  }

  addPulsePoint(x: number, y: number) {
    const g = new PIXI.Graphics()
    this.container.addChild(g)
    this.pulses.push({
      graphic: g, x, y,
      phase: Math.random() * Math.PI * 2,
      baseRadius: 8 + Math.random() * 6,
      strength: 1,
    })
  }

  setPressure(p: number) {
    this.pressure = Math.max(0, Math.min(1.5, p))
  }

  setPerspective(role: 'nurse' | 'driver' | null) {
    this.perspective = role
  }

  update(delta: number) {
    const time = Date.now() * 0.001
    const dt = delta / 60
    const medColor = PIXI.utils.string2hex(COLORS.medicine)
    const dangerColor = 0xCC3366

    // ── Draw supply path (3-pass glow, narrow) ──
    this.drawSupplyPath(medColor)

    // ── Cadence system ──
    this.cadenceTimer += dt
    const adjustedInterval = this.cadenceInterval * (1 + this.pressure * 0.8)
    const skipBeat = this.pressure > 0.6 && Math.random() < this.pressure * 0.3

    if (this.cadenceTimer >= adjustedInterval) {
      this.cadenceTimer = 0
      if (!skipBeat && this.supplyPath.length > 1) {
        this.spawnMedicinePulse()
      } else if (skipBeat && this.supplyPath.length > 1) {
        this.spawnMissedBeatGhost()
      }
      this.heartbeatHistory.push(skipBeat ? 0 : 1)
      if (this.heartbeatHistory.length > 30) this.heartbeatHistory.shift()
    }

    // ── Medicine pulse dots ──
    const speedMod = 0.6 + (1 - this.pressure) * 0.4
    for (const mp of this.medicinePulses) {
      if (!mp.alive) continue
      mp.progress += mp.speed * speedMod * delta * 60
      if (mp.progress >= 1) {
        mp.alive = false
        mp.graphic.visible = false
        this.refillShelf()
        continue
      }
      const totalSegs = this.supplyPath.length - 1
      const seg = Math.min(Math.floor(mp.progress * totalSegs), totalSegs - 1)
      const lt = (mp.progress * totalSegs) - seg
      const px = this.supplyPath[seg].x + (this.supplyPath[seg + 1].x - this.supplyPath[seg].x) * lt
      const py = this.supplyPath[seg].y + (this.supplyPath[seg + 1].y - this.supplyPath[seg].y) * lt
      mp.graphic.x = px
      mp.graphic.y = py

      // Redraw dot each frame for subtle pulse
      mp.graphic.clear()
      const dotPulse = 0.85 + 0.15 * Math.sin(time * 3 + mp.progress * 10)
      // Soft glow ring
      mp.graphic.beginFill(medColor, 0.15)
      mp.graphic.drawCircle(0, 0, 5)
      mp.graphic.endFill()
      // Core dot
      mp.graphic.beginFill(medColor, dotPulse)
      mp.graphic.drawCircle(0, 0, 2.5)
      mp.graphic.endFill()
    }
    this.medicinePulses = this.medicinePulses.filter(mp => {
      if (!mp.alive) { mp.graphic.destroy(); return false }
      return true
    })

    // ── Missed beat ghosts ──
    for (const ghost of this.missedGhosts) {
      ghost.age += dt
      const t = ghost.age / ghost.lifetime
      ghost.graphic.clear()
      if (t < 1) {
        const fadeAlpha = 0.4 * (1 - t)
        ghost.graphic.beginFill(dangerColor, fadeAlpha)
        ghost.graphic.drawCircle(0, 0, 3 + t * 4)
        ghost.graphic.endFill()
      }
    }
    this.missedGhosts = this.missedGhosts.filter(ghost => {
      if (ghost.age >= ghost.lifetime) { ghost.graphic.destroy(); return false }
      return true
    })

    // ── Shelf depletion bar ──
    this.shelfTargetFill = Math.max(0, this.shelfTargetFill - dt * 0.02 * this.pressure)
    this.shelfFill += (this.shelfTargetFill - this.shelfFill) * 0.05
    this.drawShelfBar(medColor, dangerColor)

    // ── Heartbeat line ──
    this.drawHeartbeat(medColor, dangerColor)

    // ── Pulse points (soft glow rings, no crosses) ──
    for (const pulse of this.pulses) {
      pulse.graphic.clear()
      pulse.strength = this.supplyLevel

      const wave = Math.sin(time * 1.5 + pulse.phase)
      const radius = pulse.baseRadius * (0.5 + 0.5 * wave)
      const opacity = 0.2 + 0.5 * pulse.strength * Math.abs(wave)

      // Outer expanding glow ring
      const outerRadius = radius * 1.6
      const outerAlpha = opacity * 0.15 * (0.5 + 0.5 * wave)
      pulse.graphic.beginFill(medColor, outerAlpha)
      pulse.graphic.drawCircle(pulse.x, pulse.y, outerRadius)
      pulse.graphic.endFill()

      // Main ring
      pulse.graphic.lineStyle(1.5 * pulse.strength, medColor, opacity * 0.7)
      pulse.graphic.drawCircle(pulse.x, pulse.y, radius)

      // Inner soft fill
      pulse.graphic.beginFill(medColor, opacity * 0.12)
      pulse.graphic.drawCircle(pulse.x, pulse.y, radius * 0.7)
      pulse.graphic.endFill()

      // Warning halo under low supply
      if (this.supplyLevel < 0.7) {
        const warningAlpha = (1 - this.supplyLevel) * 0.35 * (0.6 + 0.4 * Math.sin(time * 2.5 + pulse.phase))
        pulse.graphic.lineStyle(1, dangerColor, warningAlpha)
        pulse.graphic.drawCircle(pulse.x, pulse.y, radius * 2)
      }
    }

    // Nurse sees medicine vividly; others at 0.7
    this.container.alpha = this.perspective === 'nurse' ? 1.0 : 0.7
  }

  // ── Supply path: 3-pass glow, narrow ──
  private drawSupplyPath(color: number) {
    this.pathGraphic.clear()
    if (this.supplyPath.length < 2) return

    // Pass 1: wide dim glow
    this.pathGraphic.lineStyle(4.5, color, 0.06)
    this.tracePath(this.pathGraphic)

    // Pass 2: medium glow
    this.pathGraphic.lineStyle(2.5, color, 0.15)
    this.tracePath(this.pathGraphic)

    // Pass 3: bright core
    this.pathGraphic.lineStyle(1.5, color, 0.45)
    this.tracePath(this.pathGraphic)
  }

  private tracePath(g: PIXI.Graphics) {
    g.moveTo(this.supplyPath[0].x, this.supplyPath[0].y)
    for (let i = 1; i < this.supplyPath.length; i++) {
      g.lineTo(this.supplyPath[i].x, this.supplyPath[i].y)
    }
  }

  // ── Shelf bar: single horizontal bar, depletes right-to-left ──
  private drawShelfBar(medColor: number, dangerColor: number) {
    this.shelfGraphic.clear()
    if (this.shelfPos.x === 0 && this.shelfPos.y === 0) return

    const barW = 50
    const barH = 4
    const bx = this.shelfPos.x - barW / 2
    const by = this.shelfPos.y - 15

    // Background outline
    this.shelfGraphic.lineStyle(0.5, medColor, 0.25)
    this.shelfGraphic.drawRect(bx, by, barW, barH)

    // Filled portion
    const fillW = barW * Math.max(0, this.shelfFill)
    if (fillW > 0.5) {
      // Color interpolation: medicine green-ish → danger red as it empties
      const r1 = (medColor >> 16) & 0xFF
      const g1 = (medColor >> 8) & 0xFF
      const b1 = medColor & 0xFF
      const r2 = (dangerColor >> 16) & 0xFF
      const g2 = (dangerColor >> 8) & 0xFF
      const b2 = dangerColor & 0xFF
      const t = 1 - this.shelfFill // 0=full, 1=empty
      const r = Math.round(r1 + (r2 - r1) * t)
      const g = Math.round(g1 + (g2 - g1) * t)
      const b = Math.round(b1 + (b2 - b1) * t)
      const fillColor = (r << 16) | (g << 8) | b

      this.shelfGraphic.beginFill(fillColor, 0.6 + this.shelfFill * 0.3)
      this.shelfGraphic.drawRect(bx, by, fillW, barH)
      this.shelfGraphic.endFill()
    }
  }

  // ── Heartbeat line: thin and understated ──
  private drawHeartbeat(medColor: number, dangerColor: number) {
    this.heartbeatLine.clear()
    if (this.heartbeatHistory.length < 3 || (this.shelfPos.x === 0 && this.shelfPos.y === 0)) return

    const lx = this.shelfPos.x - 30
    const ly = this.shelfPos.y + 10
    const lw = 60
    const step = lw / 30

    this.heartbeatLine.lineStyle(0.8, medColor, 0.35)
    for (let i = 0; i < this.heartbeatHistory.length; i++) {
      const x = lx + i * step
      const beat = this.heartbeatHistory[i]
      const y = ly - (beat ? 5 * Math.sin((i / this.heartbeatHistory.length) * Math.PI) : 0)
      if (i === 0) this.heartbeatLine.moveTo(x, y)
      else this.heartbeatLine.lineTo(x, y)
      if (beat === 0) {
        this.heartbeatLine.lineStyle(0.8, dangerColor, 0.45)
        this.heartbeatLine.drawCircle(x, ly, 1.5)
        this.heartbeatLine.lineStyle(0.8, medColor, 0.35)
      }
    }
  }

  private spawnMedicinePulse() {
    if (this.supplyPath.length < 2) return
    const g = new PIXI.Graphics()
    this.container.addChild(g)
    // Slower speed, sparser feel
    this.medicinePulses.push({
      graphic: g,
      progress: 0,
      speed: 0.001 + Math.random() * 0.0008,
      alive: true,
    })
  }

  private spawnMissedBeatGhost() {
    if (this.supplyPath.length < 1) return
    const g = new PIXI.Graphics()
    g.x = this.supplyPath[0].x
    g.y = this.supplyPath[0].y
    this.container.addChild(g)
    this.missedGhosts.push({ graphic: g, age: 0, lifetime: 0.5 })
  }

  private refillShelf() {
    this.shelfTargetFill = Math.min(1, this.shelfTargetFill + 0.15)
  }

  setVisible(visible: boolean) {
    this.container.visible = visible
  }

  clear() {
    this.pulses.forEach(p => p.graphic.destroy())
    this.pulses = []
    this.medicinePulses.forEach(mp => mp.graphic.destroy())
    this.medicinePulses = []
    this.missedGhosts.forEach(g => g.graphic.destroy())
    this.missedGhosts = []
    this.pathGraphic.clear()
    this.shelfGraphic.clear()
    this.heartbeatLine.clear()
    this.shelfFill = 1.0
    this.shelfTargetFill = 1.0
    this.heartbeatHistory = []
  }

  dispose() {
    this.clear()
    this.container.destroy({ children: true })
  }
}
