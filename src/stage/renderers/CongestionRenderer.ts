import * as PIXI from 'pixi.js'
import Matter from 'matter-js'
import { COLORS } from '../../app/config/constants'
import {
  drawTruckMiniature, drawTrail, drawLaneField,
  drawQueueBloom, drawNodeGlow, drawDensityBloom,
} from './primitives/MiniatureFactory'

/**
 * CongestionRenderer — Freight lens. PHYSICS + MINIATURES.
 *
 * Human question: Why is the corridor slowing?
 *
 * What you SEE:
 * - Dominant inland corridor (Mombasa → Nairobi)
 * - Miniature trucks moving in convoy bursts
 * - Depot queue at Mombasa (trucks accumulate before release)
 * - Bottleneck gate on corridor (trucks pile up)
 * - Irregular spacing under pressure
 * - Corridor drag: trucks slow near bottleneck
 * - Faint exhaust/motion streaks
 *
 * 10–18 visible trucks. Convoy burst emission.
 * Corridor band + bottleneck buildup are primary.
 */

interface FreightBody {
  body: Matter.Body
  waypointIdx: number
  trail: { x: number; y: number }[]
  prevAngle: number
  groupId: number
}

// Convoy burst emission config
interface ConvoyBurst {
  count: number
  spacing: number  // seconds between trucks in burst
  timer: number
  emitted: number
}

export class CongestionRenderer {
  private container: PIXI.Container
  private corridorGfx: PIXI.Graphics
  private densityGfx: PIXI.Graphics
  private bloomGfx: PIXI.Graphics
  private actorGfx: PIXI.Graphics

  private engine: Matter.Engine
  private bodies: FreightBody[] = []
  private corridorWalls: Matter.Body[] = []

  private corridorPath: { x: number; y: number }[] = []
  private corridorWidth = 22
  private bottleneckPos = 0.4
  private bottleneckWidth = 8

  // Convoy burst emission
  private currentBurst: ConvoyBurst | null = null
  private burstCooldown = 0
  private groupCounter = 0

  private pressure = 0.5
  private perspective: 'nurse' | 'driver' | null = null
  private attractorTarget: { x: number; y: number } | null = null

  private readonly MAX_BODIES = 16
  private readonly FLOW_STRENGTH = 0.00003
  private readonly WALL_SEGMENTS = 8
  private readonly TRAIL_LEN = 5

  constructor(parent: PIXI.Container, engine: Matter.Engine) {
    this.container = new PIXI.Container()
    parent.addChild(this.container)
    this.container.visible = false
    this.engine = engine

    this.corridorGfx = new PIXI.Graphics()
    this.container.addChild(this.corridorGfx)
    this.densityGfx = new PIXI.Graphics()
    this.container.addChild(this.densityGfx)
    this.bloomGfx = new PIXI.Graphics()
    this.container.addChild(this.bloomGfx)
    this.actorGfx = new PIXI.Graphics()
    this.container.addChild(this.actorGfx)
  }

  setCorridor(path: { x: number; y: number }[]) {
    this.corridorPath = path
    this.buildCorridorWalls()
    this.spawnInitialBodies()
  }

  setAttractor(target: { x: number; y: number }) {
    this.attractorTarget = target
  }

  spawn(_x: number, _y: number) { /* compat — bodies via burst emission */ }

  private buildCorridorWalls() {
    for (const w of this.corridorWalls) Matter.Composite.remove(this.engine.world, w)
    this.corridorWalls = []
    if (this.corridorPath.length < 2) return

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

        const nx = -dy / len
        const ny = dx / len
        const distToB = Math.abs(t - this.bottleneckPos)
        const narrowF = Math.max(0, 1 - distToB * 4)
        const localW = this.corridorWidth - narrowF * (this.corridorWidth - this.bottleneckWidth) * this.pressure

        const wall = Matter.Bodies.rectangle(
          pt.x + nx * side * localW / 2,
          pt.y + ny * side * localW / 2,
          segLen * 1.2, 4,
          {
            isStatic: true, angle: Math.atan2(dy, dx),
            label: 'corridor_wall',
            collisionFilter: { category: 0x0008, mask: 0x0004 },
          },
        )
        Matter.Composite.add(this.engine.world, wall)
        this.corridorWalls.push(wall)
      }
    }
  }

  private spawnInitialBodies() {
    if (this.corridorPath.length < 2) return
    // Spawn a few initial trucks
    for (let i = 0; i < 6; i++) {
      this.spawnTruck(Math.random() * 0.8)
    }
  }

  private spawnTruck(progressAlongPath: number) {
    if (this.bodies.length >= this.MAX_BODIES || this.corridorPath.length < 2) return
    const pt = this.samplePath(this.corridorPath, progressAlongPath)
    const radius = 2.0 + Math.random() * 1.5
    const body = Matter.Bodies.circle(
      pt.x + (Math.random() - 0.5) * 6,
      pt.y + (Math.random() - 0.5) * 6,
      radius,
      {
        density: 0.0005 + Math.random() * 0.0004,
        frictionAir: 0.025 + Math.random() * 0.02,
        restitution: 0.2,
        friction: 0.12 + Math.random() * 0.08,
        label: 'freight',
        collisionFilter: { category: 0x0004, mask: 0x0004 | 0x0008 },
      },
    )
    Matter.Composite.add(this.engine.world, body)
    const waypointIdx = Math.max(0, Math.floor(progressAlongPath * (this.corridorPath.length - 1)))
    this.bodies.push({
      body, waypointIdx, trail: [], prevAngle: 0, groupId: this.groupCounter,
    })
  }

  setPressure(p: number) {
    const old = this.pressure
    this.pressure = Math.max(0, Math.min(1.5, p))
    if (Math.abs(old - this.pressure) > 0.15 && this.corridorPath.length >= 2) {
      this.buildCorridorWalls()
    }
  }

  setPerspective(role: 'nurse' | 'driver' | null) { this.perspective = role }

  update(delta: number) {
    const dt = delta
    const freightHex = PIXI.utils.string2hex(COLORS.freight)
    const path = this.corridorPath
    if (path.length < 2) return

    // ── Convoy burst emission ──
    this.burstCooldown -= dt
    if (!this.currentBurst && this.burstCooldown <= 0 && this.bodies.length < this.MAX_BODIES) {
      this.groupCounter++
      this.currentBurst = {
        count: 3 + Math.floor(Math.random() * 3), // 3-5 trucks
        spacing: 0.3 + this.pressure * 0.4, // slower spacing under pressure
        timer: 0,
        emitted: 0,
      }
    }
    if (this.currentBurst) {
      this.currentBurst.timer += dt
      if (this.currentBurst.timer >= this.currentBurst.spacing) {
        this.currentBurst.timer = 0
        this.spawnTruck(0.02 + Math.random() * 0.05) // near start
        this.currentBurst.emitted++
        if (this.currentBurst.emitted >= this.currentBurst.count) {
          this.currentBurst = null
          this.burstCooldown = 2 + this.pressure * 3 // longer pause under pressure
        }
      }
    }

    // ── Apply flow forces ──
    const lastIdx = path.length - 1
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const fb = this.bodies[i]
      const target = path[Math.min(fb.waypointIdx, lastIdx)]
      const dx = target.x - fb.body.position.x
      const dy = target.y - fb.body.position.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < 15 && fb.waypointIdx < lastIdx) fb.waypointIdx++

      // Recycle
      if (fb.waypointIdx >= lastIdx && dist < 20) {
        Matter.Composite.remove(this.engine.world, fb.body)
        this.bodies.splice(i, 1)
        continue
      }

      if (dist > 2) {
        const flowStr = this.FLOW_STRENGTH * (1 - this.pressure * 0.4)
        Matter.Body.applyForce(fb.body, fb.body.position, {
          x: (dx / dist) * flowStr, y: (dy / dist) * flowStr,
        })
      }

      // Trail
      fb.trail.push({ x: fb.body.position.x, y: fb.body.position.y })
      if (fb.trail.length > this.TRAIL_LEN) fb.trail.shift()

      // Smooth angle
      const vx = fb.body.velocity.x
      const vy = fb.body.velocity.y
      if (Math.abs(vx) > 0.05 || Math.abs(vy) > 0.05) {
        const tgt = Math.atan2(vy, vx)
        fb.prevAngle += (tgt - fb.prevAngle) * 0.12
      }
    }

    // ── RENDER ──
    this.corridorGfx.clear()
    this.densityGfx.clear()
    this.bloomGfx.clear()
    this.actorGfx.clear()

    // Corridor lane field
    drawLaneField(this.corridorGfx, path, freightHex, 0.12, 5)

    // Corridor edge lines (showing walls)
    this.drawCorridorEdges(this.corridorGfx, freightHex)

    // Density bloom along corridor
    const positions = this.bodies.map(fb => fb.body.position)
    drawDensityBloom(this.densityGfx, positions, 20, freightHex, 2)

    // Bottleneck bloom
    if (this.pressure > 0.3) {
      const bpt = this.samplePath(path, this.bottleneckPos)
      drawQueueBloom(this.bloomGfx, bpt.x, bpt.y, this.pressure * 0.7, freightHex)
    }

    // Depot glow at Mombasa
    if (this.attractorTarget) {
      drawNodeGlow(this.bloomGfx, this.attractorTarget.x, this.attractorTarget.y, 16, freightHex, 0.6 + this.pressure * 0.3)
    }

    // Truck miniatures + trails
    for (const fb of this.bodies) {
      const bx = fb.body.position.x
      const by = fb.body.position.y
      const speed = Math.sqrt(fb.body.velocity.x ** 2 + fb.body.velocity.y ** 2)

      // Motion trail (exhaust streaks)
      if (fb.trail.length >= 2) {
        const trailAlpha = Math.min(0.25, speed * 0.06)
        drawTrail(this.actorGfx, fb.trail, freightHex, trailAlpha, 1.0)
      }

      // Truck miniature
      const scale = 0.7 + ((fb.body as any).circleRadius || 2.5) * 0.08
      const alpha = 0.5 + Math.min(0.45, 0.25 / (speed + 0.3))
      drawTruckMiniature(this.actorGfx, bx, by, fb.prevAngle, scale, alpha)
    }

    this.container.alpha = this.perspective === 'driver' ? 1.0 : 0.75
  }

  private drawCorridorEdges(g: PIXI.Graphics, color: number) {
    const path = this.corridorPath
    if (path.length < 2) return

    for (let side = -1; side <= 1; side += 2) {
      g.lineStyle(0.8, color, 0.08)
      let started = false
      for (let i = 0; i <= 20; i++) {
        const t = i / 20
        const pt = this.samplePath(path, t)
        const ptN = this.samplePath(path, Math.min(1, t + 0.01))
        const dx = ptN.x - pt.x
        const dy = ptN.y - pt.y
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len < 0.01) continue
        const nx = -dy / len
        const ny = dx / len
        const distToB = Math.abs(t - this.bottleneckPos)
        const narrowF = Math.max(0, 1 - distToB * 4)
        const localW = this.corridorWidth - narrowF * (this.corridorWidth - this.bottleneckWidth) * this.pressure

        const wx = pt.x + nx * side * localW / 2
        const wy = pt.y + ny * side * localW / 2
        if (!started) { g.moveTo(wx, wy); started = true }
        else g.lineTo(wx, wy)
      }
    }
  }

  // ── Path utilities ──

  private pathLength(path: { x: number; y: number }[]): number {
    let len = 0
    for (let i = 1; i < path.length; i++) {
      len += Math.sqrt((path[i].x - path[i - 1].x) ** 2 + (path[i].y - path[i - 1].y) ** 2)
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
    for (const fb of this.bodies) Matter.Composite.remove(this.engine.world, fb.body)
    this.bodies = []
    for (const w of this.corridorWalls) Matter.Composite.remove(this.engine.world, w)
    this.corridorWalls = []
    this.corridorGfx.clear()
    this.densityGfx.clear()
    this.bloomGfx.clear()
    this.actorGfx.clear()
  }

  dispose() {
    this.clear()
    this.container.destroy({ children: true })
  }
}
