import * as PIXI from 'pixi.js'
import Matter from 'matter-js'
import { COLORS } from '../../app/config/constants'

/**
 * MarginRenderer — Food lens. PHYSICS-FIRST.
 *
 * Human question: Why is my month shrinking?
 *
 * What you SEE:
 * - Food bodies flowing from port → market → household sinks
 * - Bodies split at junctions, pulled by competing attractors
 * - Under pressure: fewer bodies, some sinks starve (visibly empty)
 * - Thinning: body count drops, gaps grow in distribution
 * - Households with fewer bodies nearby glow dimmer / shift orange
 * - The uneven distribution IS the visual — not icons, not symbols
 *
 * Matter.js bodies + competing attractor forces.
 * Pixi renders body positions with node density halos.
 */

const HOUSEHOLD_HEX = PIXI.utils.string2hex(COLORS.household)
const STRESS_HEX = PIXI.utils.string2hex(COLORS.importStress)

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return (r << 16) | (g << 8) | bl
}

interface FoodBody {
  body: Matter.Body
  waypointIdx: number
  sinkIdx: number // which sink this body is heading to (-1 = not assigned)
}

interface SinkNode {
  x: number
  y: number
  label: string
  isHousehold: boolean
  nearbyCount: number // how many bodies are close (computed each frame)
}

interface FlowPath {
  path: { x: number; y: number }[]
  isTerminal: boolean
}

export class MarginRenderer {
  private container: PIXI.Container
  private bodyGfx: PIXI.Graphics
  private pathGfx: PIXI.Graphics
  private nodeGfx: PIXI.Graphics
  private densityGfx: PIXI.Graphics

  private engine: Matter.Engine
  private bodies: FoodBody[] = []
  private sinks: SinkNode[] = []
  private flows: FlowPath[] = []

  // Spawn point (first flow's start)
  private spawnPoint: { x: number; y: number } | null = null
  private spawnTimer = 0
  private spawnInterval = 0.4

  private erosion = 0
  private pressure = 0.5
  private perspective: 'nurse' | 'driver' | null = null

  // Legacy compat
  private bands: { from: { x: number; y: number }; to: { x: number; y: number }; phase: number }[] = []

  private readonly MAX_BODIES = 60
  private readonly ATTRACT_STRENGTH = 0.000025
  private readonly SINK_RADIUS = 30 // proximity to count as "near" a sink

  constructor(parent: PIXI.Container, engine: Matter.Engine) {
    this.container = new PIXI.Container()
    parent.addChild(this.container)
    this.container.visible = false
    this.engine = engine

    this.pathGfx = new PIXI.Graphics()
    this.container.addChild(this.pathGfx)

    this.densityGfx = new PIXI.Graphics()
    this.container.addChild(this.densityGfx)

    this.nodeGfx = new PIXI.Graphics()
    this.container.addChild(this.nodeGfx)

    this.bodyGfx = new PIXI.Graphics()
    this.container.addChild(this.bodyGfx)
  }

  setErosion(pct: number) {
    this.erosion = Math.max(0, Math.min(1, pct / 100))
  }

  setPressure(p: number) {
    this.pressure = Math.max(0, Math.min(1.5, p))
  }

  setPerspective(role: 'nurse' | 'driver' | null) {
    this.perspective = role
  }

  addDistributionFlow(path: { x: number; y: number }[], _particleCount: number, isTerminal = false) {
    this.flows.push({ path, isTerminal })
    if (!this.spawnPoint && path.length > 0) {
      this.spawnPoint = path[0]
    }
  }

  addMarketNode(x: number, y: number, label: string) {
    const isHousehold = /home|household/i.test(label)
    this.sinks.push({ x, y, label, isHousehold, nearbyCount: 0 })
  }

  addBand(from: { x: number; y: number }, to: { x: number; y: number }) {
    this.bands.push({ from, to, phase: Math.random() * Math.PI * 2 })
  }

  /** Call after all flows and sinks are added. Spawns initial bodies. */
  initPhysics() {
    if (!this.spawnPoint) return

    // Spawn initial food bodies
    const initialCount = Math.floor(this.MAX_BODIES * 0.6)
    for (let i = 0; i < initialCount; i++) {
      this.spawnFoodBody()
    }
  }

  private spawnFoodBody() {
    if (this.bodies.length >= this.MAX_BODIES || !this.spawnPoint) return

    // Under pressure, spawn fewer
    const spawnChance = Math.max(0.2, 1 - this.pressure * 0.5)
    if (Math.random() > spawnChance) return

    const sp = this.spawnPoint
    const radius = 1.2 + Math.random() * 1.3
    const body = Matter.Bodies.circle(
      sp.x + (Math.random() - 0.5) * 20,
      sp.y + (Math.random() - 0.5) * 20,
      radius,
      {
        density: 0.0004,
        frictionAir: 0.025 + Math.random() * 0.015,
        restitution: 0.15,
        friction: 0.05,
        label: 'food',
        collisionFilter: { category: 0x0004, mask: 0x0004 | 0x0008 },
      },
    )
    Matter.Composite.add(this.engine.world, body)

    // Assign to a random sink (weighted — households more likely)
    let sinkIdx = -1
    if (this.sinks.length > 0) {
      // Under pressure: some bodies get no sink assignment (they wander and thin)
      if (Math.random() > this.pressure * 0.3) {
        const weights = this.sinks.map(s => s.isHousehold ? 2 : 1)
        const total = weights.reduce((a, b) => a + b, 0)
        let r = Math.random() * total
        for (let i = 0; i < weights.length; i++) {
          r -= weights[i]
          if (r <= 0) { sinkIdx = i; break }
        }
      }
    }

    this.bodies.push({ body, waypointIdx: 0, sinkIdx })
  }

  update(delta: number) {
    const dt = delta
    const time = Date.now() * 0.001
    const pressureT = Math.min(this.pressure / 1.5, 1)

    // ── Spawn timer ──
    this.spawnTimer += dt
    const adjInterval = this.spawnInterval * (1 + this.pressure * 1.5)
    if (this.spawnTimer >= adjInterval && this.bodies.length < this.MAX_BODIES) {
      this.spawnTimer = 0
      this.spawnFoodBody()
    }

    // ── Reset sink counts ──
    for (const sink of this.sinks) sink.nearbyCount = 0

    // ── Apply forces: attract bodies toward their assigned sink ──
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const fb = this.bodies[i]

      // First, flow through path waypoints (non-terminal flows)
      // Then attract toward assigned sink
      let target: { x: number; y: number } | null = null

      if (fb.sinkIdx >= 0 && fb.sinkIdx < this.sinks.length) {
        target = this.sinks[fb.sinkIdx]
      } else if (this.sinks.length > 0) {
        // Unassigned bodies drift toward nearest sink weakly
        let nearest = 0
        let nearestDist = Infinity
        for (let s = 0; s < this.sinks.length; s++) {
          const d = Math.sqrt((fb.body.position.x - this.sinks[s].x) ** 2 + (fb.body.position.y - this.sinks[s].y) ** 2)
          if (d < nearestDist) { nearestDist = d; nearest = s }
        }
        target = this.sinks[nearest]
      }

      if (target) {
        const dx = target.x - fb.body.position.x
        const dy = target.y - fb.body.position.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        // Count bodies near sinks
        if (dist < this.SINK_RADIUS) {
          for (let s = 0; s < this.sinks.length; s++) {
            const sd = Math.sqrt((fb.body.position.x - this.sinks[s].x) ** 2 + (fb.body.position.y - this.sinks[s].y) ** 2)
            if (sd < this.SINK_RADIUS) this.sinks[s].nearbyCount++
          }
        }

        // Recycle if very close to sink for too long
        if (dist < 8) {
          Matter.Composite.remove(this.engine.world, fb.body)
          this.bodies.splice(i, 1)
          continue
        }

        // Attract toward sink
        if (dist > 3) {
          const str = this.ATTRACT_STRENGTH * (1 - this.pressure * 0.3)
          Matter.Body.applyForce(fb.body, fb.body.position, {
            x: (dx / dist) * str,
            y: (dy / dist) * str,
          })
        }
      }
    }

    // ── RENDER ──
    this.pathGfx.clear()
    this.densityGfx.clear()
    this.nodeGfx.clear()
    this.bodyGfx.clear()

    // Draw flow path guides (dim lines showing distribution routes)
    for (const flow of this.flows) {
      const path = flow.path
      if (path.length < 2) continue
      const lineColor = lerpColor(HOUSEHOLD_HEX, STRESS_HEX, pressureT)
      const alpha = flow.isTerminal ? 0.05 : 0.08
      const width = flow.isTerminal ? 0.8 : 1.2

      this.pathGfx.lineStyle(width * 2.5, lineColor, alpha * 0.4)
      this.pathGfx.moveTo(path[0].x, path[0].y)
      for (let j = 1; j < path.length; j++) this.pathGfx.lineTo(path[j].x, path[j].y)

      this.pathGfx.lineStyle(width, lineColor, alpha)
      this.pathGfx.moveTo(path[0].x, path[0].y)
      for (let j = 1; j < path.length; j++) this.pathGfx.lineTo(path[j].x, path[j].y)
    }

    // ── Sink nodes: density-based halos ──
    for (const sink of this.sinks) {
      // Saturation = how many bodies are near this sink
      const saturation = Math.min(1, sink.nearbyCount / 6)
      const starving = saturation < 0.3
      const color = lerpColor(HOUSEHOLD_HEX, STRESS_HEX, starving ? 0.7 : pressureT * 0.3)

      // Density halo — bigger and brighter with more bodies
      const outerR = sink.isHousehold ? 12 : 18
      const haloAlpha = 0.05 + saturation * 0.15

      this.nodeGfx.beginFill(color, haloAlpha * 0.5)
      this.nodeGfx.drawCircle(sink.x, sink.y, outerR * (0.5 + saturation * 0.5))
      this.nodeGfx.endFill()

      this.nodeGfx.beginFill(color, haloAlpha)
      this.nodeGfx.drawCircle(sink.x, sink.y, outerR * 0.4 * (0.5 + saturation * 0.5))
      this.nodeGfx.endFill()

      // Starvation warning — pulsing when starving
      if (starving && this.pressure > 0.3) {
        const warn = 0.15 * (1 - saturation) * (0.5 + 0.5 * Math.sin(time * 3))
        this.nodeGfx.lineStyle(0.8, STRESS_HEX, warn)
        this.nodeGfx.drawCircle(sink.x, sink.y, outerR + 3 + Math.sin(time * 2) * 2)
        this.nodeGfx.lineStyle(0)
      }
    }

    // ── Density field: show where bodies cluster ──
    this.drawDensityField(this.densityGfx, pressureT)

    // ── Draw food bodies ──
    for (const fb of this.bodies) {
      const bx = fb.body.position.x
      const by = fb.body.position.y
      const rad = (fb.body as any).circleRadius || 1.5
      const speed = Math.sqrt(fb.body.velocity.x ** 2 + fb.body.velocity.y ** 2)
      const color = lerpColor(HOUSEHOLD_HEX, STRESS_HEX, pressureT)

      // Slow bodies glow (arriving/stuck near sinks)
      const slowGlow = Math.max(0, 0.1 - speed * 0.03)
      if (slowGlow > 0.02) {
        this.bodyGfx.beginFill(color, slowGlow)
        this.bodyGfx.drawCircle(bx, by, rad * 2.5)
        this.bodyGfx.endFill()
      }

      // Core body
      const alpha = 0.45 + Math.min(0.4, 0.2 / (speed + 0.3))
      this.bodyGfx.beginFill(color, alpha)
      this.bodyGfx.drawCircle(bx, by, rad)
      this.bodyGfx.endFill()
    }

    // Perspective alpha
    this.container.alpha = this.perspective === 'nurse' ? 0.9 : 0.8
  }

  private drawDensityField(g: PIXI.Graphics, pressureT: number) {
    const cellSize = 20
    const density: Map<string, number> = new Map()

    for (const fb of this.bodies) {
      const cx = Math.floor(fb.body.position.x / cellSize)
      const cy = Math.floor(fb.body.position.y / cellSize)
      const key = `${cx},${cy}`
      density.set(key, (density.get(key) || 0) + 1)
    }

    const color = lerpColor(HOUSEHOLD_HEX, STRESS_HEX, pressureT)
    for (const [key, count] of density) {
      if (count < 2) continue
      const [cx, cy] = key.split(',').map(Number)
      const x = (cx + 0.5) * cellSize
      const y = (cy + 0.5) * cellSize
      const intensity = Math.min(1, count / 6)
      g.beginFill(color, intensity * 0.05)
      g.drawCircle(x, y, cellSize)
      g.endFill()
    }
  }

  setVisible(visible: boolean) {
    this.container.visible = visible
  }

  clear() {
    for (const fb of this.bodies) {
      Matter.Composite.remove(this.engine.world, fb.body)
    }
    this.bodies = []
    this.sinks = []
    this.flows = []
    this.bodyGfx.clear()
    this.pathGfx.clear()
    this.nodeGfx.clear()
    this.densityGfx.clear()
  }

  dispose() {
    this.clear()
    this.bodyGfx.destroy()
    this.container.destroy({ children: true })
  }
}
