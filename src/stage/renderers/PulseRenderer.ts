import * as PIXI from 'pixi.js'
import Matter from 'matter-js'
import { COLORS } from '../../app/config/constants'
import {
  drawMedicineMiniature, drawTrail, drawLaneField,
  drawNodeGlow,
} from './primitives/MiniatureFactory'

/**
 * PulseRenderer — Medicine lens. PHYSICS + MINIATURES.
 *
 * Human question: Why is the clinic running short?
 *
 * What you SEE:
 * - One sparse, critical supply lifeline
 * - Medicine packet miniatures only occasionally (cadence-driven)
 * - Primary signal is TIMING and ABSENCE
 * - Missed beats: ghost pulse / empty rhythm gap
 * - Shelf depletion linked to failed arrivals
 * - Fragile, sparse — not busy, not crowded
 */

interface MedicineBody {
  body: Matter.Body
  waypointIdx: number
  trail: { x: number; y: number }[]
  prevAngle: number
  spawnTime: number
}

interface GhostPulse {
  x: number
  y: number
  age: number
  maxAge: number
}

export class PulseRenderer {
  private container: PIXI.Container
  private pathGfx: PIXI.Graphics
  private ghostGfx: PIXI.Graphics
  private actorGfx: PIXI.Graphics
  private shelfGfx: PIXI.Graphics
  private heartbeatGfx: PIXI.Graphics

  private engine: Matter.Engine
  private bodies: MedicineBody[] = []
  private guideWalls: Matter.Body[] = []
  private ghosts: GhostPulse[] = []

  private supplyPath: { x: number; y: number }[] = []
  private channelWidth = 10

  private cadenceTimer = 0
  private cadenceInterval = 2.0
  private heartbeatHistory: (0 | 1)[] = []

  private shelfPos = { x: 0, y: 0 }
  private shelfFill = 1.0
  private shelfTargetFill = 1.0

  private pulsePoints: { x: number; y: number; phase: number }[] = []
  private supplyLevel = 1.0
  private pressure = 0.5
  private perspective: 'nurse' | 'driver' | null = null

  private readonly MAX_BODIES = 12
  private readonly FLOW_STRENGTH = 0.000025
  private readonly CHANNEL_SEGMENTS = 6
  private readonly TRAIL_LEN = 5

  constructor(parent: PIXI.Container, engine: Matter.Engine) {
    this.container = new PIXI.Container()
    parent.addChild(this.container)
    this.container.visible = false
    this.engine = engine

    this.pathGfx = new PIXI.Graphics()
    this.container.addChild(this.pathGfx)
    this.ghostGfx = new PIXI.Graphics()
    this.container.addChild(this.ghostGfx)
    this.actorGfx = new PIXI.Graphics()
    this.container.addChild(this.actorGfx)
    this.shelfGfx = new PIXI.Graphics()
    this.container.addChild(this.shelfGfx)
    this.heartbeatGfx = new PIXI.Graphics()
    this.container.addChild(this.heartbeatGfx)
  }

  setSupplyLevel(pct: number) { this.supplyLevel = Math.max(0, Math.min(1, pct / 100)) }

  setSupplyPath(path: { x: number; y: number }[]) {
    this.supplyPath = path
    this.buildGuideWalls()
  }

  setShelfPosition(pos: { x: number; y: number }) { this.shelfPos = pos }

  addPulsePoint(x: number, y: number) {
    this.pulsePoints.push({ x, y, phase: Math.random() * Math.PI * 2 })
  }

  setPressure(p: number) { this.pressure = Math.max(0, Math.min(1.5, p)) }
  setPerspective(role: 'nurse' | 'driver' | null) { this.perspective = role }

  private buildGuideWalls() {
    for (const w of this.guideWalls) Matter.Composite.remove(this.engine.world, w)
    this.guideWalls = []
    const path = this.supplyPath
    if (path.length < 2) return

    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < this.CHANNEL_SEGMENTS; i++) {
        const t = (i + 0.5) / this.CHANNEL_SEGMENTS
        const pt = this.samplePath(t)
        const ptNext = this.samplePath(Math.min(1, t + 0.02))
        const dx = ptNext.x - pt.x
        const dy = ptNext.y - pt.y
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len < 0.1) continue
        const nx = -dy / len
        const ny = dx / len
        const halfW = this.channelWidth / 2
        const segLen = this.pathLength() / this.CHANNEL_SEGMENTS

        const wall = Matter.Bodies.rectangle(
          pt.x + nx * side * halfW, pt.y + ny * side * halfW,
          segLen * 1.3, 3,
          {
            isStatic: true, angle: Math.atan2(dy, dx), label: 'medicine_guide',
            collisionFilter: { category: 0x0008, mask: 0x0004 },
          },
        )
        Matter.Composite.add(this.engine.world, wall)
        this.guideWalls.push(wall)
      }
    }
  }

  private spawnMedicineBody() {
    if (this.supplyPath.length < 2 || this.bodies.length >= this.MAX_BODIES) return
    const start = this.supplyPath[0]
    const body = Matter.Bodies.circle(
      start.x + (Math.random() - 0.5) * 4,
      start.y + (Math.random() - 0.5) * 4,
      2.2,
      {
        density: 0.0004, frictionAir: 0.035, restitution: 0.15, friction: 0.05,
        label: 'medicine',
        collisionFilter: { category: 0x0004, mask: 0x0004 | 0x0008 },
      },
    )
    Matter.Composite.add(this.engine.world, body)
    this.bodies.push({ body, waypointIdx: 1, trail: [], prevAngle: 0, spawnTime: Date.now() })
  }

  update(delta: number) {
    const dt = delta
    const time = Date.now() * 0.001
    const medHex = PIXI.utils.string2hex(COLORS.medicine)
    const dangerHex = 0xCC3366
    if (this.supplyPath.length < 2) return

    // ── Cadence ──
    this.cadenceTimer += dt
    const adjustedInterval = this.cadenceInterval * (1 + this.pressure * 0.8)
    const skipBeat = this.pressure > 0.5 && Math.random() < this.pressure * 0.25

    if (this.cadenceTimer >= adjustedInterval) {
      this.cadenceTimer = 0
      if (!skipBeat) {
        this.spawnMedicineBody()
        this.heartbeatHistory.push(1)
      } else {
        const start = this.supplyPath[0]
        this.ghosts.push({ x: start.x, y: start.y, age: 0, maxAge: 1.2 })
        this.heartbeatHistory.push(0)
      }
      if (this.heartbeatHistory.length > 30) this.heartbeatHistory.shift()
    }

    // ── Flow forces ──
    const path = this.supplyPath
    const lastIdx = path.length - 1
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const mb = this.bodies[i]
      const target = path[Math.min(mb.waypointIdx, lastIdx)]
      const dx = target.x - mb.body.position.x
      const dy = target.y - mb.body.position.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < 12 && mb.waypointIdx < lastIdx) mb.waypointIdx++

      if (mb.waypointIdx >= lastIdx && dist < 15) {
        Matter.Composite.remove(this.engine.world, mb.body)
        this.bodies.splice(i, 1)
        this.shelfTargetFill = Math.min(1, this.shelfTargetFill + 0.15)
        continue
      }

      if (dist > 2) {
        const str = this.FLOW_STRENGTH * (1 - this.pressure * 0.35)
        Matter.Body.applyForce(mb.body, mb.body.position, { x: (dx / dist) * str, y: (dy / dist) * str })
      }

      mb.trail.push({ x: mb.body.position.x, y: mb.body.position.y })
      if (mb.trail.length > this.TRAIL_LEN) mb.trail.shift()

      const vx = mb.body.velocity.x
      const vy = mb.body.velocity.y
      if (Math.abs(vx) > 0.05 || Math.abs(vy) > 0.05) {
        mb.prevAngle += (Math.atan2(vy, vx) - mb.prevAngle) * 0.12
      }
    }

    // ── Ghosts ──
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      this.ghosts[i].age += dt
      if (this.ghosts[i].age >= this.ghosts[i].maxAge) this.ghosts.splice(i, 1)
    }

    // ── Shelf depletion ──
    this.shelfTargetFill = Math.max(0, this.shelfTargetFill - dt * 0.015 * this.pressure)
    this.shelfFill += (this.shelfTargetFill - this.shelfFill) * 0.05

    // ── RENDER ──
    this.pathGfx.clear()
    this.ghostGfx.clear()
    this.actorGfx.clear()

    // Supply lifeline
    drawLaneField(this.pathGfx, this.supplyPath, medHex, 0.08, 2)

    // Ghost pulses
    for (const ghost of this.ghosts) {
      const t = ghost.age / ghost.maxAge
      const r = 8 + t * 20
      const a = 0.2 * (1 - t)
      this.ghostGfx.lineStyle(1.5 * (1 - t), dangerHex, a)
      this.ghostGfx.drawCircle(ghost.x, ghost.y, r)
      this.ghostGfx.lineStyle(0)
      this.ghostGfx.beginFill(dangerHex, a * 0.3)
      this.ghostGfx.drawCircle(ghost.x, ghost.y, r * 0.5)
      this.ghostGfx.endFill()
    }

    // Medicine miniatures
    for (const mb of this.bodies) {
      const bx = mb.body.position.x
      const by = mb.body.position.y
      const speed = Math.sqrt(mb.body.velocity.x ** 2 + mb.body.velocity.y ** 2)

      if (mb.trail.length >= 2) drawTrail(this.actorGfx, mb.trail, medHex, Math.min(0.2, speed * 0.05), 0.8)

      const pulse = 0.7 + 0.2 * Math.sin(time * 2 + mb.spawnTime * 0.001)
      drawMedicineMiniature(this.actorGfx, bx, by, mb.prevAngle, 0.7, pulse)
    }

    // Pulse points
    for (const pp of this.pulsePoints) {
      const wave = Math.sin(time * 1.5 + pp.phase)
      drawNodeGlow(this.actorGfx, pp.x, pp.y, 10 * this.supplyLevel, medHex, 0.4 * this.supplyLevel * (0.5 + 0.5 * Math.abs(wave)))
      if (this.supplyLevel < 0.7) {
        const wa = (1 - this.supplyLevel) * 0.2 * (0.5 + 0.5 * Math.sin(time * 2.5 + pp.phase))
        this.actorGfx.lineStyle(0.8, dangerHex, wa)
        this.actorGfx.drawCircle(pp.x, pp.y, 12 * (0.5 + 0.5 * wave))
        this.actorGfx.lineStyle(0)
      }
    }

    this.drawShelfBar(medHex, dangerHex)
    this.drawHeartbeat(medHex, dangerHex)
    this.container.alpha = this.perspective === 'nurse' ? 1.0 : 0.7
  }

  private drawShelfBar(medColor: number, dangerColor: number) {
    this.shelfGfx.clear()
    if (this.shelfPos.x === 0 && this.shelfPos.y === 0) return
    const barW = 50, barH = 4
    const bx = this.shelfPos.x - barW / 2
    const by = this.shelfPos.y - 15
    this.shelfGfx.lineStyle(0.5, medColor, 0.2)
    this.shelfGfx.drawRect(bx, by, barW, barH)
    this.shelfGfx.lineStyle(0)
    const fillW = barW * Math.max(0, this.shelfFill)
    if (fillW > 0.5) {
      const t = 1 - this.shelfFill
      const r1 = (medColor >> 16) & 0xFF, g1 = (medColor >> 8) & 0xFF, b1 = medColor & 0xFF
      const r2 = (dangerColor >> 16) & 0xFF, g2 = (dangerColor >> 8) & 0xFF, b2 = dangerColor & 0xFF
      const fillColor = (Math.round(r1 + (r2 - r1) * t) << 16) | (Math.round(g1 + (g2 - g1) * t) << 8) | Math.round(b1 + (b2 - b1) * t)
      this.shelfGfx.beginFill(fillColor, 0.5 + this.shelfFill * 0.3)
      this.shelfGfx.drawRect(bx, by, fillW, barH)
      this.shelfGfx.endFill()
    }
  }

  private drawHeartbeat(medColor: number, dangerColor: number) {
    this.heartbeatGfx.clear()
    if (this.heartbeatHistory.length < 3 || (this.shelfPos.x === 0 && this.shelfPos.y === 0)) return
    const lx = this.shelfPos.x - 30, ly = this.shelfPos.y + 10, step = 60 / 30
    this.heartbeatGfx.lineStyle(0.8, medColor, 0.3)
    for (let i = 0; i < this.heartbeatHistory.length; i++) {
      const x = lx + i * step
      const beat = this.heartbeatHistory[i]
      const y = ly - (beat ? 5 * Math.sin((i / this.heartbeatHistory.length) * Math.PI) : 0)
      if (i === 0) this.heartbeatGfx.moveTo(x, y)
      else this.heartbeatGfx.lineTo(x, y)
      if (beat === 0) {
        this.heartbeatGfx.lineStyle(0.8, dangerColor, 0.4)
        this.heartbeatGfx.drawCircle(x, ly, 1.5)
        this.heartbeatGfx.lineStyle(0.8, medColor, 0.3)
      }
    }
  }

  private pathLength(): number {
    let len = 0
    for (let i = 1; i < this.supplyPath.length; i++) {
      len += Math.sqrt((this.supplyPath[i].x - this.supplyPath[i - 1].x) ** 2 + (this.supplyPath[i].y - this.supplyPath[i - 1].y) ** 2)
    }
    return len
  }

  private samplePath(t: number): { x: number; y: number } {
    const path = this.supplyPath
    if (path.length < 2) return path[0] || { x: 0, y: 0 }
    const totalLen = this.pathLength()
    let target = t * totalLen
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i - 1].x
      const dy = path[i].y - path[i - 1].y
      const segLen = Math.sqrt(dx * dx + dy * dy)
      if (target <= segLen || i === path.length - 1) {
        const lt = segLen > 0 ? Math.min(1, target / segLen) : 0
        return { x: path[i - 1].x + dx * lt, y: path[i - 1].y + dy * lt }
      }
      target -= segLen
    }
    return path[path.length - 1]
  }

  setVisible(visible: boolean) { this.container.visible = visible }
  setAlpha(alpha: number) { this.container.alpha = alpha }

  clear() {
    for (const mb of this.bodies) Matter.Composite.remove(this.engine.world, mb.body)
    this.bodies = []
    for (const w of this.guideWalls) Matter.Composite.remove(this.engine.world, w)
    this.guideWalls = []
    this.ghosts = []
    this.pathGfx.clear()
    this.ghostGfx.clear()
    this.actorGfx.clear()
    this.shelfGfx.clear()
    this.heartbeatGfx.clear()
    this.shelfFill = 1.0
    this.shelfTargetFill = 1.0
    this.heartbeatHistory = []
  }

  dispose() {
    this.clear()
    this.container.destroy({ children: true })
  }
}
