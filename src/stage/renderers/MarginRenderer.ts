import * as PIXI from 'pixi.js'
import Matter from 'matter-js'
import { COLORS } from '../../app/config/constants'
import {
  drawFoodMiniature, drawTrail, drawLaneField,
  drawNodeGlow, drawDensityBloom,
} from './primitives/MiniatureFactory'

/**
 * MarginRenderer — Food lens. PHYSICS + MINIATURES.
 *
 * Human question: Why is my month shrinking?
 *
 * What you SEE:
 * - Branching distribution system (port → market → households)
 * - Food crate/parcel miniatures moving through branches
 * - Market node and household sink nodes as warm glows
 * - Some branches visibly starving first (fewer crates, dimmer glow)
 * - Terminal flow widths thinning under pressure
 * - Warmer color shift toward stress
 *
 * 10–18 visible food crates. Sink competition is physics-emergent.
 */

const HOUSEHOLD_HEX = PIXI.utils.string2hex(COLORS.household)
const STRESS_HEX = PIXI.utils.string2hex(COLORS.importStress)

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t)
}

interface FoodBody {
  body: Matter.Body
  waypointIdx: number
  sinkIdx: number
  trail: { x: number; y: number }[]
  prevAngle: number
}

interface SinkNode {
  x: number
  y: number
  label: string
  isHousehold: boolean
  nearbyCount: number
  demandWeight: number
}

interface FlowPath {
  path: { x: number; y: number }[]
  isTerminal: boolean
}

export class MarginRenderer {
  private container: PIXI.Container
  private pathGfx: PIXI.Graphics
  private densityGfx: PIXI.Graphics
  private nodeGfx: PIXI.Graphics
  private actorGfx: PIXI.Graphics

  private engine: Matter.Engine
  private bodies: FoodBody[] = []
  private sinks: SinkNode[] = []
  private flows: FlowPath[] = []

  private spawnPoint: { x: number; y: number } | null = null
  private spawnTimer = 0
  private spawnInterval = 0.5

  private erosion = 0
  private pressure = 0.5
  private perspective: 'nurse' | 'driver' | null = null

  // Legacy compat
  private bands: { from: { x: number; y: number }; to: { x: number; y: number }; phase: number }[] = []

  private readonly MAX_BODIES = 16
  private readonly ATTRACT_STRENGTH = 0.000025
  private readonly SINK_RADIUS = 30
  private readonly TRAIL_LEN = 4

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
    this.actorGfx = new PIXI.Graphics()
    this.container.addChild(this.actorGfx)
  }

  setErosion(pct: number) { this.erosion = Math.max(0, Math.min(1, pct / 100)) }
  setPressure(p: number) { this.pressure = Math.max(0, Math.min(1.5, p)) }
  setPerspective(role: 'nurse' | 'driver' | null) { this.perspective = role }

  addDistributionFlow(path: { x: number; y: number }[], _particleCount: number, isTerminal = false) {
    this.flows.push({ path, isTerminal })
    if (!this.spawnPoint && path.length > 0) this.spawnPoint = path[0]
  }

  addMarketNode(x: number, y: number, label: string) {
    const isHousehold = /home|household/i.test(label)
    this.sinks.push({ x, y, label, isHousehold, nearbyCount: 0, demandWeight: isHousehold ? 2 : 1 })
  }

  addBand(from: { x: number; y: number }, to: { x: number; y: number }) {
    this.bands.push({ from, to, phase: Math.random() * Math.PI * 2 })
  }

  initPhysics() {
    if (!this.spawnPoint) return
    // Spawn initial food crates
    for (let i = 0; i < 8; i++) this.spawnFoodBody()
  }

  private spawnFoodBody() {
    if (this.bodies.length >= this.MAX_BODIES || !this.spawnPoint) return
    const spawnChance = Math.max(0.3, 1 - this.pressure * 0.4)
    if (Math.random() > spawnChance) return

    const sp = this.spawnPoint
    const radius = 1.5 + Math.random() * 1.0
    const body = Matter.Bodies.circle(
      sp.x + (Math.random() - 0.5) * 15,
      sp.y + (Math.random() - 0.5) * 15,
      radius,
      {
        density: 0.0004, frictionAir: 0.025 + Math.random() * 0.015,
        restitution: 0.15, friction: 0.05,
        label: 'food',
        collisionFilter: { category: 0x0004, mask: 0x0004 | 0x0008 },
      },
    )
    Matter.Composite.add(this.engine.world, body)

    // Weighted sink assignment
    let sinkIdx = -1
    if (this.sinks.length > 0 && Math.random() > this.pressure * 0.3) {
      const weights = this.sinks.map(s => s.demandWeight)
      const total = weights.reduce((a, b) => a + b, 0)
      let r = Math.random() * total
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i]
        if (r <= 0) { sinkIdx = i; break }
      }
    }

    this.bodies.push({ body, waypointIdx: 0, sinkIdx, trail: [], prevAngle: 0 })
  }

  update(delta: number) {
    const dt = delta
    const time = Date.now() * 0.001
    const pressureT = Math.min(this.pressure / 1.5, 1)

    // ── Spawn timer ──
    this.spawnTimer += dt
    const adjInterval = this.spawnInterval * (1 + this.pressure * 1.5)
    if (this.spawnTimer >= adjInterval) {
      this.spawnTimer = 0
      this.spawnFoodBody()
    }

    // ── Reset sink counts ──
    for (const sink of this.sinks) sink.nearbyCount = 0

    // ── Apply sink attractor forces ──
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const fb = this.bodies[i]
      let target: { x: number; y: number } | null = null

      if (fb.sinkIdx >= 0 && fb.sinkIdx < this.sinks.length) {
        target = this.sinks[fb.sinkIdx]
      } else if (this.sinks.length > 0) {
        let nearest = 0, nearestDist = Infinity
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

        if (dist < this.SINK_RADIUS) {
          for (let s = 0; s < this.sinks.length; s++) {
            const sd = Math.sqrt((fb.body.position.x - this.sinks[s].x) ** 2 + (fb.body.position.y - this.sinks[s].y) ** 2)
            if (sd < this.SINK_RADIUS) this.sinks[s].nearbyCount++
          }
        }

        // Recycle close to sink
        if (dist < 8) {
          Matter.Composite.remove(this.engine.world, fb.body)
          this.bodies.splice(i, 1)
          continue
        }

        if (dist > 3) {
          const str = this.ATTRACT_STRENGTH * (1 - this.pressure * 0.3)
          Matter.Body.applyForce(fb.body, fb.body.position, {
            x: (dx / dist) * str, y: (dy / dist) * str,
          })
        }
      }

      // Trail
      fb.trail.push({ x: fb.body.position.x, y: fb.body.position.y })
      if (fb.trail.length > this.TRAIL_LEN) fb.trail.shift()

      // Angle
      const vx = fb.body.velocity.x
      const vy = fb.body.velocity.y
      if (Math.abs(vx) > 0.05 || Math.abs(vy) > 0.05) {
        fb.prevAngle += (Math.atan2(vy, vx) - fb.prevAngle) * 0.1
      }
    }

    // ── RENDER ──
    this.pathGfx.clear()
    this.densityGfx.clear()
    this.nodeGfx.clear()
    this.actorGfx.clear()

    // Flow path guides
    for (const flow of this.flows) {
      const path = flow.path
      if (path.length < 2) continue
      const lineColor = lerpColor(HOUSEHOLD_HEX, STRESS_HEX, pressureT)
      const alpha = flow.isTerminal ? 0.06 : 0.1
      const width = flow.isTerminal ? 1.5 : 2.5
      drawLaneField(this.pathGfx, path, lineColor, alpha, width)
    }

    // Density bloom
    const positions = this.bodies.map(fb => fb.body.position)
    const densColor = lerpColor(HOUSEHOLD_HEX, STRESS_HEX, pressureT)
    drawDensityBloom(this.densityGfx, positions, 18, densColor, 2)

    // Sink nodes: density-based halos
    for (const sink of this.sinks) {
      const saturation = Math.min(1, sink.nearbyCount / 4)
      const starving = saturation < 0.3
      const color = lerpColor(HOUSEHOLD_HEX, STRESS_HEX, starving ? 0.7 : pressureT * 0.3)
      const outerR = sink.isHousehold ? 12 : 18
      const intensity = 0.3 + saturation * 0.6

      drawNodeGlow(this.nodeGfx, sink.x, sink.y, outerR, color, intensity)

      // Starvation warning
      if (starving && this.pressure > 0.3) {
        const warn = 0.15 * (1 - saturation) * (0.5 + 0.5 * Math.sin(time * 3))
        this.nodeGfx.lineStyle(0.8, STRESS_HEX, warn)
        this.nodeGfx.drawCircle(sink.x, sink.y, outerR + 3 + Math.sin(time * 2) * 2)
        this.nodeGfx.lineStyle(0)
      }
    }

    // Food crate miniatures + trails
    for (const fb of this.bodies) {
      const bx = fb.body.position.x
      const by = fb.body.position.y
      const speed = Math.sqrt(fb.body.velocity.x ** 2 + fb.body.velocity.y ** 2)
      const color = lerpColor(HOUSEHOLD_HEX, STRESS_HEX, pressureT)

      if (fb.trail.length >= 2) {
        drawTrail(this.actorGfx, fb.trail, color, Math.min(0.2, speed * 0.05), 0.7)
      }

      const alpha = 0.5 + Math.min(0.4, 0.2 / (speed + 0.3))
      drawFoodMiniature(this.actorGfx, bx, by, fb.prevAngle, 0.65, alpha)
    }

    this.container.alpha = this.perspective === 'nurse' ? 0.9 : 0.8
  }

  setVisible(visible: boolean) { this.container.visible = visible }

  clear() {
    for (const fb of this.bodies) Matter.Composite.remove(this.engine.world, fb.body)
    this.bodies = []
    this.sinks = []
    this.flows = []
    this.pathGfx.clear()
    this.densityGfx.clear()
    this.nodeGfx.clear()
    this.actorGfx.clear()
  }

  dispose() {
    this.clear()
    this.container.destroy({ children: true })
  }
}
