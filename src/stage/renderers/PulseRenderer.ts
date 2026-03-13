import * as PIXI from 'pixi.js'
import Matter from 'matter-js'
import { COLORS } from '../../app/config/constants'
import {
  drawMedicineMiniature, drawTrail, drawLaneField,
  drawNodeGlow,
} from './primitives/MiniatureFactory'

/**
 * PulseRenderer — MEDICINE CONSEQUENCE LAYER.
 *
 * Human question: Why is the clinic running short?
 *
 * This scene answers: A distant chokepoint becomes a delayed clinic shelf.
 *
 * What you SEE:
 * - ONE sparse, critical supply lifeline (Mombasa → clinic)
 * - Medicine packet miniatures arriving OCCASIONALLY (cadence-driven)
 * - Primary signal is TIMING and ABSENCE — not bulk
 * - Missed beats: expanding ghost rings + danger glow
 * - Shelf bar depletes visibly when gaps appear
 * - Heartbeat rhythm monitor showing hits and misses
 * - Fragile, sparse — NOT busy, NOT crowded
 *
 * Visual rule: Medicine should feel like TIMING FAILURE, not bulk shortage.
 * The user sees: regular cadence breaking down into irregular, unreliable supply.
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
  private channelWidth = 14   // wider channel for bigger packets

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

  private readonly MAX_BODIES = 10
  private readonly FLOW_STRENGTH = 0.00003
  private readonly CHANNEL_SEGMENTS = 8
  private readonly TRAIL_LEN = 6

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
          segLen * 1.3, 4,
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
      start.x + (Math.random() - 0.5) * 5,
      start.y + (Math.random() - 0.5) * 5,
      3.0,  // bigger collision radius for bigger miniatures
      {
        density: 0.0005, frictionAir: 0.03, restitution: 0.15, friction: 0.05,
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

    // ── Cadence — timing is the core mechanic ──
    this.cadenceTimer += dt
    const adjustedInterval = this.cadenceInterval * (1 + this.pressure * 1.0)
    const skipBeat = this.pressure > 0.4 && Math.random() < this.pressure * 0.3

    if (this.cadenceTimer >= adjustedInterval) {
      this.cadenceTimer = 0
      if (!skipBeat) {
        this.spawnMedicineBody()
        this.heartbeatHistory.push(1)
      } else {
        // MISSED BEAT — this is the KEY visual event
        const start = this.supplyPath[0]
        this.ghosts.push({ x: start.x, y: start.y, age: 0, maxAge: 1.8 })
        this.heartbeatHistory.push(0)
        // Shelf depletes on missed beats
        this.shelfTargetFill = Math.max(0, this.shelfTargetFill - 0.08)
      }
      if (this.heartbeatHistory.length > 40) this.heartbeatHistory.shift()
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

      if (dist < 14 && mb.waypointIdx < lastIdx) mb.waypointIdx++

      if (mb.waypointIdx >= lastIdx && dist < 18) {
        Matter.Composite.remove(this.engine.world, mb.body)
        this.bodies.splice(i, 1)
        // Shelf refills on successful arrival
        this.shelfTargetFill = Math.min(1, this.shelfTargetFill + 0.12)
        continue
      }

      if (dist > 3) {
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

    // ── Shelf depletion — continuous drain under pressure ──
    this.shelfTargetFill = Math.max(0, this.shelfTargetFill - dt * 0.012 * this.pressure)
    this.shelfFill += (this.shelfTargetFill - this.shelfFill) * 0.06

    // ── RENDER ──
    this.pathGfx.clear()
    this.ghostGfx.clear()
    this.actorGfx.clear()

    // Supply lifeline — narrow, glowing, FRAGILE feeling
    drawLaneField(this.pathGfx, this.supplyPath, medHex, 0.12, 3)

    // Channel edge hints — narrow rails
    this.drawChannelEdges(this.pathGfx, medHex)

    // Ghost pulses — BIGGER, more dramatic missed-beat rings
    for (const ghost of this.ghosts) {
      const t = ghost.age / ghost.maxAge
      const r = 12 + t * 30       // bigger rings
      const a = 0.3 * (1 - t)     // stronger initial alpha
      // Outer ring
      this.ghostGfx.lineStyle(2 * (1 - t), dangerHex, a)
      this.ghostGfx.drawCircle(ghost.x, ghost.y, r)
      this.ghostGfx.lineStyle(0)
      // Inner danger fill
      this.ghostGfx.beginFill(dangerHex, a * 0.25)
      this.ghostGfx.drawCircle(ghost.x, ghost.y, r * 0.4)
      this.ghostGfx.endFill()
      // Cross mark at center — "missed"
      if (t < 0.5) {
        const crossA = a * 0.6
        this.ghostGfx.lineStyle(1.5, dangerHex, crossA)
        this.ghostGfx.moveTo(ghost.x - 4, ghost.y - 4)
        this.ghostGfx.lineTo(ghost.x + 4, ghost.y + 4)
        this.ghostGfx.moveTo(ghost.x + 4, ghost.y - 4)
        this.ghostGfx.lineTo(ghost.x - 4, ghost.y + 4)
        this.ghostGfx.lineStyle(0)
      }
    }

    // Medicine miniatures — BIGGER scale, clearly visible packets
    for (const mb of this.bodies) {
      const bx = mb.body.position.x
      const by = mb.body.position.y
      const speed = Math.sqrt(mb.body.velocity.x ** 2 + mb.body.velocity.y ** 2)

      if (mb.trail.length >= 2) drawTrail(this.actorGfx, mb.trail, medHex, Math.min(0.25, speed * 0.06), 1.0)

      const pulse = 0.75 + 0.2 * Math.sin(time * 2 + mb.spawnTime * 0.001)
      // Scale 1.0 base (was 0.7) — readable medicine packets
      drawMedicineMiniature(this.actorGfx, bx, by, mb.prevAngle, 1.0, pulse)
    }

    // Clinic/pulse point glows — bigger, more visible
    for (const pp of this.pulsePoints) {
      const wave = Math.sin(time * 1.5 + pp.phase)
      drawNodeGlow(this.actorGfx, pp.x, pp.y, 16 * this.supplyLevel, medHex, 0.5 * this.supplyLevel * (0.5 + 0.5 * Math.abs(wave)))

      // Danger halo when supply is low
      if (this.supplyLevel < 0.7) {
        const wa = (1 - this.supplyLevel) * 0.25 * (0.5 + 0.5 * Math.sin(time * 2.5 + pp.phase))
        this.actorGfx.lineStyle(1.2, dangerHex, wa)
        this.actorGfx.drawCircle(pp.x, pp.y, 16 * (0.5 + 0.5 * wave))
        this.actorGfx.lineStyle(0)
      }
    }

    // Shelf bar — BIGGER, CLEARER, central to the narrative
    this.drawShelfBar(medHex, dangerHex)

    // Heartbeat rhythm — BIGGER, more readable
    this.drawHeartbeat(medHex, dangerHex)
  }

  private drawChannelEdges(g: PIXI.Graphics, color: number) {
    const path = this.supplyPath
    if (path.length < 2) return
    const halfW = this.channelWidth / 2

    for (let side = -1; side <= 1; side += 2) {
      g.lineStyle(0.6, color, 0.08)
      let started = false
      for (let i = 0; i <= 16; i++) {
        const t = i / 16
        const pt = this.samplePath(t)
        const ptN = this.samplePath(Math.min(1, t + 0.02))
        const dx = ptN.x - pt.x
        const dy = ptN.y - pt.y
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len < 0.01) continue
        const nx = -dy / len
        const ny = dx / len
        const wx = pt.x + nx * side * halfW
        const wy = pt.y + ny * side * halfW
        if (!started) { g.moveTo(wx, wy); started = true }
        else g.lineTo(wx, wy)
      }
    }
    g.lineStyle(0)
  }

  private drawShelfBar(medColor: number, dangerColor: number) {
    this.shelfGfx.clear()
    if (this.shelfPos.x === 0 && this.shelfPos.y === 0) return

    // BIGGER shelf bar — 70px wide, 6px tall, clearly visible
    const barW = 70, barH = 6
    const bx = this.shelfPos.x - barW / 2
    const by = this.shelfPos.y - 18

    // Shelf label
    // Outline
    this.shelfGfx.lineStyle(1, medColor, 0.25)
    this.shelfGfx.drawRoundedRect(bx - 1, by - 1, barW + 2, barH + 2, 2)
    this.shelfGfx.lineStyle(0)

    // Background
    this.shelfGfx.beginFill(0x1a1220, 0.4)
    this.shelfGfx.drawRoundedRect(bx, by, barW, barH, 1)
    this.shelfGfx.endFill()

    // Fill — color shifts from medicine to danger as it empties
    const fillW = barW * Math.max(0, this.shelfFill)
    if (fillW > 1) {
      const t = 1 - this.shelfFill
      const r1 = (medColor >> 16) & 0xFF, g1 = (medColor >> 8) & 0xFF, b1 = medColor & 0xFF
      const r2 = (dangerColor >> 16) & 0xFF, g2 = (dangerColor >> 8) & 0xFF, b2 = dangerColor & 0xFF
      const fillColor = (Math.round(r1 + (r2 - r1) * t) << 16) | (Math.round(g1 + (g2 - g1) * t) << 8) | Math.round(b1 + (b2 - b1) * t)
      this.shelfGfx.beginFill(fillColor, 0.6 + this.shelfFill * 0.3)
      this.shelfGfx.drawRoundedRect(bx, by, fillW, barH, 1)
      this.shelfGfx.endFill()
    }

    // Critical warning — pulsing outline when shelf is low
    if (this.shelfFill < 0.35) {
      const time = Date.now() * 0.001
      const pulse = 0.3 + 0.3 * Math.sin(time * 3)
      this.shelfGfx.lineStyle(1.5, dangerColor, (1 - this.shelfFill) * pulse)
      this.shelfGfx.drawRoundedRect(bx - 2, by - 2, barW + 4, barH + 4, 3)
      this.shelfGfx.lineStyle(0)
    }
  }

  private drawHeartbeat(medColor: number, dangerColor: number) {
    this.heartbeatGfx.clear()
    if (this.heartbeatHistory.length < 3 || (this.shelfPos.x === 0 && this.shelfPos.y === 0)) return

    // BIGGER heartbeat — wider, taller, more readable
    const lx = this.shelfPos.x - 40
    const ly = this.shelfPos.y + 14
    const step = 80 / 40
    const beatH = 8

    this.heartbeatGfx.lineStyle(1.0, medColor, 0.35)
    for (let i = 0; i < this.heartbeatHistory.length; i++) {
      const x = lx + i * step
      const beat = this.heartbeatHistory[i]
      const y = ly - (beat ? beatH * Math.sin((i / this.heartbeatHistory.length) * Math.PI) : 0)
      if (i === 0) this.heartbeatGfx.moveTo(x, y)
      else this.heartbeatGfx.lineTo(x, y)

      // Missed beat marker — bigger, more visible
      if (beat === 0) {
        this.heartbeatGfx.lineStyle(0)
        this.heartbeatGfx.beginFill(dangerColor, 0.5)
        this.heartbeatGfx.drawCircle(x, ly, 2.5)
        this.heartbeatGfx.endFill()
        this.heartbeatGfx.lineStyle(1.0, medColor, 0.35)
      }
    }
    this.heartbeatGfx.lineStyle(0)
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
