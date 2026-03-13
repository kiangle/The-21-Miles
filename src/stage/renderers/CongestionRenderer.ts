import * as PIXI from 'pixi.js'
import Matter from 'matter-js'
import { COLORS } from '../../app/config/constants'

/**
 * CongestionRenderer — Freight lens. PHYSICS-FIRST.
 *
 * Human question: Why is the corridor slowing?
 *
 * What you SEE:
 * - Bodies flowing through a walled corridor (Mombasa → Nairobi)
 * - Bottleneck narrows: bodies physically pile up, cluster, push
 * - Convoy clusters emerge from collision + friction differences
 * - Irregular spacing — some clumps, some gaps
 * - Corridor drag: bodies near walls move slower (friction)
 * - Depot accumulation: bodies cluster at source before release
 *
 * Matter.js corridor walls + body collisions produce the patterns.
 * Pixi renders body positions with velocity-based intensity.
 */

interface FreightBody {
  body: Matter.Body
  waypointIdx: number
}

export class CongestionRenderer {
  private container: PIXI.Container
  private bodyGfx: PIXI.Graphics
  private corridorGfx: PIXI.Graphics
  private densityGfx: PIXI.Graphics

  private engine: Matter.Engine
  private bodies: FreightBody[] = []
  private corridorWalls: Matter.Body[] = []

  private corridorPath: { x: number; y: number }[] = []
  private corridorWidth = 22
  private bottleneckPos = 0.4 // fraction along corridor where bottleneck is
  private bottleneckWidth = 8 // narrowest point

  private pressure = 0.5
  private perspective: 'nurse' | 'driver' | null = null

  private readonly BODY_COUNT = 50
  private readonly FLOW_STRENGTH = 0.00003
  private readonly WALL_SEGMENTS = 8

  constructor(parent: PIXI.Container, engine: Matter.Engine) {
    this.container = new PIXI.Container()
    parent.addChild(this.container)
    this.container.visible = false
    this.engine = engine

    this.corridorGfx = new PIXI.Graphics()
    this.container.addChild(this.corridorGfx)

    this.densityGfx = new PIXI.Graphics()
    this.container.addChild(this.densityGfx)

    this.bodyGfx = new PIXI.Graphics()
    this.container.addChild(this.bodyGfx)
  }

  /**
   * Set corridor path and build physics walls + bodies.
   */
  setCorridor(path: { x: number; y: number }[]) {
    this.corridorPath = path
    this.buildCorridorWalls()
    this.spawnFreightBodies()
  }

  private buildCorridorWalls() {
    // Remove old walls
    for (const w of this.corridorWalls) {
      Matter.Composite.remove(this.engine.world, w)
    }
    this.corridorWalls = []

    if (this.corridorPath.length < 2) return

    // Build wall segments along each side of the corridor
    const path = this.corridorPath
    const totalLen = this.pathLength(path)
    const segLen = totalLen / this.WALL_SEGMENTS

    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < this.WALL_SEGMENTS; i++) {
        const t = (i + 0.5) / this.WALL_SEGMENTS
        const pt = this.samplePath(path, t)
        const ptNext = this.samplePath(path, Math.min(1, t + 0.01))
        const dx = ptNext.x - pt.x
        const dy = ptNext.y - pt.y
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len < 0.1) continue

        // Normal perpendicular to path direction
        const nx = -dy / len
        const ny = dx / len

        // Corridor width varies: narrows at bottleneck
        const distToBottleneck = Math.abs(t - this.bottleneckPos)
        const narrowFactor = Math.max(0, 1 - distToBottleneck * 4)
        const localWidth = this.corridorWidth - narrowFactor * (this.corridorWidth - this.bottleneckWidth) * this.pressure

        const wx = pt.x + nx * side * localWidth / 2
        const wy = pt.y + ny * side * localWidth / 2
        const angle = Math.atan2(dy, dx)

        const wall = Matter.Bodies.rectangle(wx, wy, segLen * 1.2, 4, {
          isStatic: true,
          angle,
          label: 'corridor_wall',
          collisionFilter: { category: 0x0008, mask: 0x0004 },
        })
        Matter.Composite.add(this.engine.world, wall)
        this.corridorWalls.push(wall)
      }
    }
  }

  private spawnFreightBodies() {
    // Remove old bodies
    for (const fb of this.bodies) {
      Matter.Composite.remove(this.engine.world, fb.body)
    }
    this.bodies = []

    if (this.corridorPath.length < 2) return

    for (let i = 0; i < this.BODY_COUNT; i++) {
      const t = Math.random()
      const pt = this.samplePath(this.corridorPath, t)
      // Varying sizes = irregular spacing naturally
      const radius = 1.5 + Math.random() * 2.0
      const body = Matter.Bodies.circle(
        pt.x + (Math.random() - 0.5) * 8,
        pt.y + (Math.random() - 0.5) * 8,
        radius,
        {
          density: 0.0005 + Math.random() * 0.0005,
          frictionAir: 0.02 + Math.random() * 0.03,
          restitution: 0.2,
          friction: 0.1 + Math.random() * 0.1,
          label: 'freight',
          collisionFilter: { category: 0x0004, mask: 0x0004 | 0x0008 },
        },
      )
      Matter.Composite.add(this.engine.world, body)
      const waypointIdx = Math.max(0, Math.floor(t * (this.corridorPath.length - 1)))
      this.bodies.push({ body, waypointIdx })
    }
  }

  setAttractor(_target: { x: number; y: number }) {
    // Legacy API compat — no-op, flow is now physics-driven
  }

  spawn(_x: number, _y: number) {
    // Legacy API compat — bodies are spawned by setCorridor
  }

  setPressure(p: number) {
    const old = this.pressure
    this.pressure = Math.max(0, Math.min(1.5, p))
    // Rebuild walls when pressure changes significantly (bottleneck narrows)
    if (Math.abs(old - this.pressure) > 0.15 && this.corridorPath.length >= 2) {
      this.buildCorridorWalls()
    }
  }

  setPerspective(role: 'nurse' | 'driver' | null) {
    this.perspective = role
  }

  update(delta: number) {
    const freightHex = PIXI.utils.string2hex(COLORS.freight)
    const path = this.corridorPath

    if (path.length < 2) return

    // ── Apply flow forces: attract bodies toward next waypoint ──
    const lastIdx = path.length - 1
    for (const fb of this.bodies) {
      const target = path[Math.min(fb.waypointIdx, lastIdx)]
      const dx = target.x - fb.body.position.x
      const dy = target.y - fb.body.position.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      // Advance waypoint
      if (dist < 15 && fb.waypointIdx < lastIdx) {
        fb.waypointIdx++
      }

      // Recycle at end
      if (fb.waypointIdx >= lastIdx && dist < 20) {
        const start = path[0]
        Matter.Body.setPosition(fb.body, {
          x: start.x + (Math.random() - 0.5) * 15,
          y: start.y + (Math.random() - 0.5) * 15,
        })
        Matter.Body.setVelocity(fb.body, { x: 0, y: 0 })
        fb.waypointIdx = 0
        continue
      }

      // Attract toward waypoint — slower under pressure
      if (dist > 2) {
        const flowStr = this.FLOW_STRENGTH * (1 - this.pressure * 0.4)
        Matter.Body.applyForce(fb.body, fb.body.position, {
          x: (dx / dist) * flowStr,
          y: (dy / dist) * flowStr,
        })
      }
    }

    // ── RENDER ──
    this.corridorGfx.clear()
    this.densityGfx.clear()
    this.bodyGfx.clear()

    // Draw corridor guide (dim background showing the path + walls)
    this.drawCorridorGuide(this.corridorGfx, freightHex)

    // Density field along corridor
    this.drawDensityField(this.densityGfx, freightHex)

    // Draw freight bodies
    for (const fb of this.bodies) {
      const bx = fb.body.position.x
      const by = fb.body.position.y
      const rad = (fb.body as any).circleRadius || 2
      const speed = Math.sqrt(fb.body.velocity.x ** 2 + fb.body.velocity.y ** 2)

      // Slow/stuck bodies glow brighter (pileup indicator)
      const stuckGlow = Math.max(0, 0.2 - speed * 0.05)
      if (stuckGlow > 0.03) {
        this.bodyGfx.beginFill(freightHex, stuckGlow)
        this.bodyGfx.drawCircle(bx, by, rad * 2.5)
        this.bodyGfx.endFill()
      }

      // Core body: alpha tied to velocity (slower = more visible = "stuck")
      const alpha = 0.4 + Math.min(0.5, 0.3 / (speed + 0.3))
      this.bodyGfx.beginFill(freightHex, alpha)
      this.bodyGfx.drawCircle(bx, by, rad)
      this.bodyGfx.endFill()

      // Contact/pressure glow when colliding
      if (speed > 2) {
        this.bodyGfx.lineStyle(0.5, 0xFFFFFF, Math.min(0.2, speed * 0.03))
        this.bodyGfx.drawCircle(bx, by, rad + 0.5)
        this.bodyGfx.lineStyle(0)
      }
    }

    // Driver perspective: full alpha. Other: 0.75.
    this.container.alpha = this.perspective === 'driver' ? 1.0 : 0.75
  }

  private drawCorridorGuide(g: PIXI.Graphics, color: number) {
    const path = this.corridorPath
    if (path.length < 2) return

    // Draw corridor edges as dim lines
    for (let side = -1; side <= 1; side += 2) {
      g.lineStyle(1, color, 0.06)
      let started = false
      for (let i = 0; i <= 20; i++) {
        const t = i / 20
        const pt = this.samplePath(path, t)
        const ptNext = this.samplePath(path, Math.min(1, t + 0.01))
        const dx = ptNext.x - pt.x
        const dy = ptNext.y - pt.y
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len < 0.01) continue
        const nx = -dy / len
        const ny = dx / len

        const distToBottleneck = Math.abs(t - this.bottleneckPos)
        const narrowFactor = Math.max(0, 1 - distToBottleneck * 4)
        const localWidth = this.corridorWidth - narrowFactor * (this.corridorWidth - this.bottleneckWidth) * this.pressure

        const wx = pt.x + nx * side * localWidth / 2
        const wy = pt.y + ny * side * localWidth / 2

        if (!started) { g.moveTo(wx, wy); started = true }
        else g.lineTo(wx, wy)
      }
    }

    // Center flow line (very dim)
    g.lineStyle(0.5, color, 0.04)
    g.moveTo(path[0].x, path[0].y)
    for (let i = 1; i < path.length; i++) g.lineTo(path[i].x, path[i].y)
  }

  private drawDensityField(g: PIXI.Graphics, color: number) {
    // Sample density along corridor using bins
    const path = this.corridorPath
    if (path.length < 2) return
    const bins = 15
    const counts: number[] = new Array(bins).fill(0)
    const totalLen = this.pathLength(path)

    for (const fb of this.bodies) {
      // Project body onto corridor to find which bin
      const t = this.projectOntoPath(path, fb.body.position)
      const bin = Math.min(bins - 1, Math.floor(t * bins))
      counts[bin]++
    }

    for (let i = 0; i < bins; i++) {
      if (counts[i] < 2) continue
      const t = (i + 0.5) / bins
      const pt = this.samplePath(path, t)
      const intensity = Math.min(1, counts[i] / 8)
      // Wider, dimmer bloom for high density
      g.beginFill(color, intensity * 0.08)
      g.drawCircle(pt.x, pt.y, 12 + intensity * 10)
      g.endFill()
    }
  }

  // ── Path utilities ──

  private pathLength(path: { x: number; y: number }[]): number {
    let len = 0
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i - 1].x
      const dy = path[i].y - path[i - 1].y
      len += Math.sqrt(dx * dx + dy * dy)
    }
    return len
  }

  private samplePath(path: { x: number; y: number }[], t: number): { x: number; y: number } {
    if (path.length < 2) return path[0] || { x: 0, y: 0 }
    const totalLen = this.pathLength(path)
    let target = t * totalLen
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i - 1].x
      const dy = path[i].y - path[i - 1].y
      const segLen = Math.sqrt(dx * dx + dy * dy)
      if (target <= segLen || i === path.length - 1) {
        const lt = segLen > 0 ? target / segLen : 0
        return {
          x: path[i - 1].x + dx * Math.min(1, lt),
          y: path[i - 1].y + dy * Math.min(1, lt),
        }
      }
      target -= segLen
    }
    return path[path.length - 1]
  }

  private projectOntoPath(path: { x: number; y: number }[], pos: { x: number; y: number }): number {
    const totalLen = this.pathLength(path)
    if (totalLen === 0) return 0
    let bestT = 0
    let bestDist = Infinity
    let accumulated = 0

    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i - 1].x
      const dy = path[i].y - path[i - 1].y
      const segLen = Math.sqrt(dx * dx + dy * dy)
      if (segLen < 0.01) { accumulated += segLen; continue }

      // Project pos onto segment
      const t = Math.max(0, Math.min(1,
        ((pos.x - path[i - 1].x) * dx + (pos.y - path[i - 1].y) * dy) / (segLen * segLen),
      ))
      const projX = path[i - 1].x + dx * t
      const projY = path[i - 1].y + dy * t
      const d = Math.sqrt((pos.x - projX) ** 2 + (pos.y - projY) ** 2)
      if (d < bestDist) {
        bestDist = d
        bestT = (accumulated + t * segLen) / totalLen
      }
      accumulated += segLen
    }
    return bestT
  }

  setVisible(visible: boolean) {
    this.container.visible = visible
  }

  clear() {
    for (const fb of this.bodies) {
      Matter.Composite.remove(this.engine.world, fb.body)
    }
    this.bodies = []
    for (const w of this.corridorWalls) {
      Matter.Composite.remove(this.engine.world, w)
    }
    this.corridorWalls = []
    this.bodyGfx.clear()
    this.corridorGfx.clear()
    this.densityGfx.clear()
  }

  dispose() {
    this.clear()
    this.container.destroy({ children: true })
  }
}
