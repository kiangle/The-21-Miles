import * as PIXI from 'pixi.js'
import Matter from 'matter-js'
import { COLORS } from '../../app/config/constants'

/**
 * PulseRenderer — Medicine lens. PHYSICS-FIRST.
 *
 * Human question: Why is the clinic running short?
 *
 * What you SEE:
 * - Medicine bodies flowing along a narrow guided channel
 * - Regular cadence spacing when healthy; gaps appear under pressure
 * - Missed beats = visible empty stretches in the body chain
 * - Bodies arriving at clinic feed the shelf; shelf depletes when gaps appear
 * - Sparse, fragile: fewer bodies = more fragile feel
 * - Under pressure: bodies slow, spacing becomes irregular, some never arrive
 *
 * Matter.js bodies in a guide channel. Cadence timer spawns bodies.
 * Pixi renders body chain with gap detection, shelf bar, heartbeat line.
 * The physical spacing of bodies IS the visual.
 */

interface MedicineBody {
  body: Matter.Body
  waypointIdx: number
  spawnTime: number
}

export class PulseRenderer {
  private container: PIXI.Container
  private bodyGfx: PIXI.Graphics
  private pathGfx: PIXI.Graphics
  private shelfGfx: PIXI.Graphics
  private heartbeatGfx: PIXI.Graphics
  private gapGfx: PIXI.Graphics

  private engine: Matter.Engine
  private bodies: MedicineBody[] = []
  private guideWalls: Matter.Body[] = []

  // Supply path
  private supplyPath: { x: number; y: number }[] = []
  private channelWidth = 10

  // Cadence
  private cadenceTimer = 0
  private cadenceInterval = 1.5
  private heartbeatHistory: (0 | 1)[] = []

  // Shelf
  private shelfPos = { x: 0, y: 0 }
  private shelfFill = 1.0
  private shelfTargetFill = 1.0

  // Pulse points (clinic + distribution)
  private pulsePoints: { x: number; y: number; phase: number }[] = []

  private supplyLevel = 1.0
  private pressure = 0.5
  private perspective: 'nurse' | 'driver' | null = null

  private readonly MAX_BODIES = 25
  private readonly FLOW_STRENGTH = 0.000025
  private readonly CHANNEL_SEGMENTS = 6

  constructor(parent: PIXI.Container, engine: Matter.Engine) {
    this.container = new PIXI.Container()
    parent.addChild(this.container)
    this.container.visible = false
    this.engine = engine

    this.pathGfx = new PIXI.Graphics()
    this.container.addChild(this.pathGfx)

    this.gapGfx = new PIXI.Graphics()
    this.container.addChild(this.gapGfx)

    this.bodyGfx = new PIXI.Graphics()
    this.container.addChild(this.bodyGfx)

    this.shelfGfx = new PIXI.Graphics()
    this.container.addChild(this.shelfGfx)

    this.heartbeatGfx = new PIXI.Graphics()
    this.container.addChild(this.heartbeatGfx)
  }

  setSupplyLevel(pct: number) {
    this.supplyLevel = Math.max(0, Math.min(1, pct / 100))
  }

  setSupplyPath(path: { x: number; y: number }[]) {
    this.supplyPath = path
    this.buildGuideWalls()
  }

  setShelfPosition(pos: { x: number; y: number }) {
    this.shelfPos = pos
  }

  addPulsePoint(x: number, y: number) {
    this.pulsePoints.push({ x, y, phase: Math.random() * Math.PI * 2 })
  }

  setPressure(p: number) {
    this.pressure = Math.max(0, Math.min(1.5, p))
  }

  setPerspective(role: 'nurse' | 'driver' | null) {
    this.perspective = role
  }

  private buildGuideWalls() {
    for (const w of this.guideWalls) {
      Matter.Composite.remove(this.engine.world, w)
    }
    this.guideWalls = []

    const path = this.supplyPath
    if (path.length < 2) return

    // Build narrow guide walls along the supply path
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
          pt.x + nx * side * halfW,
          pt.y + ny * side * halfW,
          segLen * 1.3, 3,
          {
            isStatic: true,
            angle: Math.atan2(dy, dx),
            label: 'medicine_guide',
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
    const radius = 2.0 + Math.random() * 0.5
    const body = Matter.Bodies.circle(
      start.x + (Math.random() - 0.5) * 4,
      start.y + (Math.random() - 0.5) * 4,
      radius,
      {
        density: 0.0004,
        frictionAir: 0.035,
        restitution: 0.15,
        friction: 0.05,
        label: 'medicine',
        collisionFilter: { category: 0x0004, mask: 0x0004 | 0x0008 },
      },
    )
    Matter.Composite.add(this.engine.world, body)
    this.bodies.push({ body, waypointIdx: 1, spawnTime: Date.now() })
  }

  update(delta: number) {
    const dt = delta
    const time = Date.now() * 0.001
    const medHex = PIXI.utils.string2hex(COLORS.medicine)
    const dangerHex = 0xCC3366

    if (this.supplyPath.length < 2) return

    // ── Cadence system: spawn bodies at intervals ──
    this.cadenceTimer += dt
    const adjustedInterval = this.cadenceInterval * (1 + this.pressure * 0.8)
    const skipBeat = this.pressure > 0.6 && Math.random() < this.pressure * 0.25

    if (this.cadenceTimer >= adjustedInterval) {
      this.cadenceTimer = 0
      if (!skipBeat) {
        this.spawnMedicineBody()
        this.heartbeatHistory.push(1)
      } else {
        this.heartbeatHistory.push(0)
      }
      if (this.heartbeatHistory.length > 30) this.heartbeatHistory.shift()
    }

    // ── Apply flow forces to medicine bodies ──
    const path = this.supplyPath
    const lastIdx = path.length - 1

    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const mb = this.bodies[i]
      const target = path[Math.min(mb.waypointIdx, lastIdx)]
      const dx = target.x - mb.body.position.x
      const dy = target.y - mb.body.position.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      // Advance waypoint
      if (dist < 12 && mb.waypointIdx < lastIdx) {
        mb.waypointIdx++
      }

      // Arrived at clinic: remove body, refill shelf
      if (mb.waypointIdx >= lastIdx && dist < 15) {
        Matter.Composite.remove(this.engine.world, mb.body)
        this.bodies.splice(i, 1)
        this.shelfTargetFill = Math.min(1, this.shelfTargetFill + 0.12)
        continue
      }

      // Flow force — weaker under pressure (drag)
      if (dist > 2) {
        const str = this.FLOW_STRENGTH * (1 - this.pressure * 0.35)
        Matter.Body.applyForce(mb.body, mb.body.position, {
          x: (dx / dist) * str,
          y: (dy / dist) * str,
        })
      }
    }

    // ── Shelf depletion ──
    this.shelfTargetFill = Math.max(0, this.shelfTargetFill - dt * 0.015 * this.pressure)
    this.shelfFill += (this.shelfTargetFill - this.shelfFill) * 0.05

    // ── RENDER ──
    this.pathGfx.clear()
    this.gapGfx.clear()
    this.bodyGfx.clear()

    // Supply path guide (thin, fragile line)
    this.drawSupplyPathGuide(this.pathGfx, medHex)

    // Detect and highlight gaps along the path
    this.drawGapHighlights(this.gapGfx, dangerHex)

    // Draw medicine bodies
    for (const mb of this.bodies) {
      const bx = mb.body.position.x
      const by = mb.body.position.y
      const rad = (mb.body as any).circleRadius || 2
      const speed = Math.sqrt(mb.body.velocity.x ** 2 + mb.body.velocity.y ** 2)

      // Soft glow halo
      const glowAlpha = 0.12 + Math.max(0, 0.08 - speed * 0.02)
      this.bodyGfx.beginFill(medHex, glowAlpha)
      this.bodyGfx.drawCircle(bx, by, rad * 2.5)
      this.bodyGfx.endFill()

      // Core body — pulsing subtle
      const pulse = 0.6 + 0.2 * Math.sin(time * 2 + mb.spawnTime * 0.001)
      this.bodyGfx.beginFill(medHex, pulse)
      this.bodyGfx.drawCircle(bx, by, rad)
      this.bodyGfx.endFill()
    }

    // Pulse points (clinic glow — tied to supply level)
    for (const pp of this.pulsePoints) {
      const wave = Math.sin(time * 1.5 + pp.phase)
      const r = 6 * (0.5 + 0.5 * wave) * this.supplyLevel
      const alpha = 0.15 * this.supplyLevel * (0.5 + 0.5 * Math.abs(wave))

      this.bodyGfx.beginFill(medHex, alpha)
      this.bodyGfx.drawCircle(pp.x, pp.y, r * 1.5)
      this.bodyGfx.endFill()

      this.bodyGfx.lineStyle(1 * this.supplyLevel, medHex, alpha * 2)
      this.bodyGfx.drawCircle(pp.x, pp.y, r)
      this.bodyGfx.lineStyle(0)

      // Warning halo when supply low
      if (this.supplyLevel < 0.7) {
        const wa = (1 - this.supplyLevel) * 0.25 * (0.5 + 0.5 * Math.sin(time * 2.5 + pp.phase))
        this.bodyGfx.lineStyle(0.8, dangerHex, wa)
        this.bodyGfx.drawCircle(pp.x, pp.y, r * 2.5)
        this.bodyGfx.lineStyle(0)
      }
    }

    // Shelf bar
    this.drawShelfBar(medHex, dangerHex)

    // Heartbeat line
    this.drawHeartbeat(medHex, dangerHex)

    // Nurse sees medicine vividly
    this.container.alpha = this.perspective === 'nurse' ? 1.0 : 0.7
  }

  private drawSupplyPathGuide(g: PIXI.Graphics, color: number) {
    const path = this.supplyPath
    if (path.length < 2) return

    // Outer glow
    g.lineStyle(3, color, 0.04)
    g.moveTo(path[0].x, path[0].y)
    for (let i = 1; i < path.length; i++) g.lineTo(path[i].x, path[i].y)

    // Core thin line
    g.lineStyle(1, color, 0.15)
    g.moveTo(path[0].x, path[0].y)
    for (let i = 1; i < path.length; i++) g.lineTo(path[i].x, path[i].y)
  }

  /**
   * Detect gaps: find stretches along the path where no bodies are close.
   * Render these as dim danger-colored zones — the "missed beats" you can see.
   */
  private drawGapHighlights(g: PIXI.Graphics, dangerColor: number) {
    const path = this.supplyPath
    if (path.length < 2 || this.bodies.length < 2) return

    const samples = 20
    for (let i = 0; i < samples; i++) {
      const t = (i + 0.5) / samples
      const pt = this.samplePath(t)

      // Find nearest medicine body
      let minDist = Infinity
      for (const mb of this.bodies) {
        const d = Math.sqrt((mb.body.position.x - pt.x) ** 2 + (mb.body.position.y - pt.y) ** 2)
        if (d < minDist) minDist = d
      }

      // If no body nearby → gap → danger zone
      if (minDist > 25) {
        const gapIntensity = Math.min(1, (minDist - 25) / 40)
        g.beginFill(dangerColor, gapIntensity * 0.06)
        g.drawCircle(pt.x, pt.y, 8)
        g.endFill()
      }
    }
  }

  private drawShelfBar(medColor: number, dangerColor: number) {
    this.shelfGfx.clear()
    if (this.shelfPos.x === 0 && this.shelfPos.y === 0) return

    const barW = 50
    const barH = 4
    const bx = this.shelfPos.x - barW / 2
    const by = this.shelfPos.y - 15

    this.shelfGfx.lineStyle(0.5, medColor, 0.2)
    this.shelfGfx.drawRect(bx, by, barW, barH)

    const fillW = barW * Math.max(0, this.shelfFill)
    if (fillW > 0.5) {
      const t = 1 - this.shelfFill
      const r1 = (medColor >> 16) & 0xFF, g1 = (medColor >> 8) & 0xFF, b1 = medColor & 0xFF
      const r2 = (dangerColor >> 16) & 0xFF, g2 = (dangerColor >> 8) & 0xFF, b2 = dangerColor & 0xFF
      const r = Math.round(r1 + (r2 - r1) * t)
      const g = Math.round(g1 + (g2 - g1) * t)
      const b = Math.round(b1 + (b2 - b1) * t)
      const fillColor = (r << 16) | (g << 8) | b

      this.shelfGfx.beginFill(fillColor, 0.5 + this.shelfFill * 0.3)
      this.shelfGfx.drawRect(bx, by, fillW, barH)
      this.shelfGfx.endFill()
    }
  }

  private drawHeartbeat(medColor: number, dangerColor: number) {
    this.heartbeatGfx.clear()
    if (this.heartbeatHistory.length < 3 || (this.shelfPos.x === 0 && this.shelfPos.y === 0)) return

    const lx = this.shelfPos.x - 30
    const ly = this.shelfPos.y + 10
    const lw = 60
    const step = lw / 30

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

  // ── Path utilities ──

  private pathLength(): number {
    let len = 0
    for (let i = 1; i < this.supplyPath.length; i++) {
      const dx = this.supplyPath[i].x - this.supplyPath[i - 1].x
      const dy = this.supplyPath[i].y - this.supplyPath[i - 1].y
      len += Math.sqrt(dx * dx + dy * dy)
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

  setVisible(visible: boolean) {
    this.container.visible = visible
  }

  clear() {
    for (const mb of this.bodies) {
      Matter.Composite.remove(this.engine.world, mb.body)
    }
    this.bodies = []
    for (const w of this.guideWalls) {
      Matter.Composite.remove(this.engine.world, w)
    }
    this.guideWalls = []
    this.bodyGfx.clear()
    this.pathGfx.clear()
    this.shelfGfx.clear()
    this.heartbeatGfx.clear()
    this.gapGfx.clear()
    this.shelfFill = 1.0
    this.shelfTargetFill = 1.0
    this.heartbeatHistory = []
  }

  dispose() {
    this.clear()
    this.container.destroy({ children: true })
  }
}
