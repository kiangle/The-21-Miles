import * as PIXI from 'pixi.js'
import Matter from 'matter-js'
import { COLORS } from '../../app/config/constants'

/**
 * FlowBandRenderer — Shipping lens. PHYSICS-FIRST.
 *
 * Human question: Where did the ships go?
 *
 * What you SEE:
 * - Bodies piling up behind the chokepoint wall (queueing)
 * - Dense cluster upstream, sparse downstream (bunching)
 * - Bodies peeling off to reroute path when constricted
 * - Trail afterimages showing flow direction
 * - Density bloom where bodies cluster
 *
 * Matter.js DRIVES the visuals. Bodies collide at the chokepoint,
 * bunch behind walls, spill through or reroute around Africa.
 * Pixi just renders what Matter produces.
 */

interface VesselBody {
  body: Matter.Body
  trail: { x: number; y: number }[]
  waypointIdx: number
  isReroute: boolean
}

export class FlowBandRenderer {
  private container: PIXI.Container
  private gfx: PIXI.Graphics
  private densityGfx: PIXI.Graphics
  private pathGfx: PIXI.Graphics

  private engine: Matter.Engine
  private vessels: VesselBody[] = []
  private chokepointWalls: Matter.Body[] = []
  private gapWidth = 30

  // Paths
  private mainPath: { x: number; y: number }[] = []
  private reroutePath: { x: number; y: number }[] = []
  private otherPaths: { x: number; y: number; color: number; width: number }[][] = []

  private chokepointPos: { x: number; y: number } | null = null
  private portPos: { x: number; y: number } | null = null

  private pressure = 0.5
  private perspective: 'nurse' | 'driver' | null = null
  private constricted = false

  // Constants
  private readonly VESSEL_COUNT = 80
  private readonly TRAIL_LEN = 6
  private readonly FLOW_STRENGTH = 0.000035
  private readonly REROUTE_FRACTION = 0.35

  constructor(parent: PIXI.Container, engine: Matter.Engine) {
    this.container = new PIXI.Container()
    parent.addChild(this.container)
    this.engine = engine

    // Background path lines (dim guides)
    this.pathGfx = new PIXI.Graphics()
    this.container.addChild(this.pathGfx)

    // Density bloom layer (behind bodies)
    this.densityGfx = new PIXI.Graphics()
    this.container.addChild(this.densityGfx)

    // Body + trail layer
    this.gfx = new PIXI.Graphics()
    this.container.addChild(this.gfx)
  }

  /**
   * Setup: main shipping lane, reroute around Cape, and optional extra paths.
   * Creates chokepoint walls and spawns vessel bodies.
   */
  setAnchors(chokepoint: { x: number; y: number }, port: { x: number; y: number }) {
    this.chokepointPos = chokepoint
    this.portPos = port
  }

  addBand(
    path: { x: number; y: number }[],
    _particleCount: number,
    color: string,
    width: number,
    isReroute: boolean,
  ) {
    const hexColor = PIXI.utils.string2hex(color)
    if (isReroute) {
      this.reroutePath = path
    } else if (this.mainPath.length === 0) {
      this.mainPath = path
    } else {
      this.otherPaths.push(path.map(p => ({ ...p, color: hexColor, width })))
    }
  }

  /** Call after all addBand + setAnchors. Creates Matter bodies. */
  initPhysics() {
    if (!this.chokepointPos || this.mainPath.length < 2) return

    const cp = this.chokepointPos

    // Chokepoint: two static walls with a gap between them
    const wallLen = 60
    const wallThick = 6
    const halfGap = this.gapWidth / 2

    const wallTop = Matter.Bodies.rectangle(
      cp.x, cp.y - halfGap - wallLen / 2,
      wallThick, wallLen,
      { isStatic: true, label: 'choke_wall', collisionFilter: { category: 0x0008, mask: 0x0004 } },
    )
    const wallBot = Matter.Bodies.rectangle(
      cp.x, cp.y + halfGap + wallLen / 2,
      wallThick, wallLen,
      { isStatic: true, label: 'choke_wall', collisionFilter: { category: 0x0008, mask: 0x0004 } },
    )
    Matter.Composite.add(this.engine.world, [wallTop, wallBot])
    this.chokepointWalls = [wallTop, wallBot]

    // Spawn vessel bodies upstream of chokepoint
    for (let i = 0; i < this.VESSEL_COUNT; i++) {
      const startPt = this.mainPath[0]
      const radius = 1.8 + Math.random() * 1.5
      const body = Matter.Bodies.circle(
        startPt.x + (Math.random() - 0.5) * 120,
        startPt.y + (Math.random() - 0.5) * 80,
        radius,
        {
          density: 0.0006,
          frictionAir: 0.03 + Math.random() * 0.02,
          restitution: 0.25,
          friction: 0.08,
          label: 'vessel',
          collisionFilter: { category: 0x0004, mask: 0x0004 | 0x0008 },
        },
      )
      Matter.Composite.add(this.engine.world, body)
      this.vessels.push({
        body,
        trail: [],
        waypointIdx: 0,
        isReroute: false,
      })
    }
  }

  setPressure(p: number) {
    this.pressure = Math.max(0, Math.min(1.5, p))
  }

  setPerspective(role: 'nurse' | 'driver' | null) {
    this.perspective = role
  }

  setConstricted(constricted: boolean) {
    if (this.constricted === constricted) return
    this.constricted = constricted

    // Narrow or widen the chokepoint gap
    if (this.chokepointPos && this.chokepointWalls.length === 2) {
      const cp = this.chokepointPos
      const wallLen = 60
      const newGap = constricted ? Math.max(3, 30 - this.pressure * 20) : 30
      this.gapWidth = newGap
      const halfGap = newGap / 2

      Matter.Body.setPosition(this.chokepointWalls[0], { x: cp.x, y: cp.y - halfGap - wallLen / 2 })
      Matter.Body.setPosition(this.chokepointWalls[1], { x: cp.x, y: cp.y + halfGap + wallLen / 2 })
    }
  }

  update(delta: number) {
    const dt = delta
    const shippingHex = PIXI.utils.string2hex(COLORS.shipping)
    const rerouteHex = PIXI.utils.string2hex(COLORS.importStress)

    // ── Update chokepoint gap dynamically with pressure ──
    if (this.constricted && this.chokepointPos && this.chokepointWalls.length === 2) {
      const cp = this.chokepointPos
      const wallLen = 60
      const targetGap = Math.max(3, 30 - this.pressure * 22)
      this.gapWidth += (targetGap - this.gapWidth) * 0.05
      const halfGap = this.gapWidth / 2
      Matter.Body.setPosition(this.chokepointWalls[0], { x: cp.x, y: cp.y - halfGap - wallLen / 2 })
      Matter.Body.setPosition(this.chokepointWalls[1], { x: cp.x, y: cp.y + halfGap + wallLen / 2 })
    }

    // ── Apply forces to each vessel body ──
    const reroute = this.reroutePath
    const main = this.mainPath
    const hasReroute = this.constricted && reroute.length >= 2

    for (const v of this.vessels) {
      const bx = v.body.position.x
      const by = v.body.position.y
      const path = v.isReroute ? reroute : main
      if (path.length < 2) continue

      // Determine if this vessel should reroute
      if (hasReroute && !v.isReroute && this.chokepointPos) {
        const distToChoke = Math.sqrt((bx - this.chokepointPos.x) ** 2 + (by - this.chokepointPos.y) ** 2)
        // Bodies close to chokepoint with high pressure may peel off
        if (distToChoke < 60 && Math.random() < this.REROUTE_FRACTION * this.pressure * dt * 0.5) {
          v.isReroute = true
          v.waypointIdx = 0
        }
      }

      // Find current waypoint target
      const wp = path[Math.min(v.waypointIdx, path.length - 1)]
      const dx = wp.x - bx
      const dy = wp.y - by
      const dist = Math.sqrt(dx * dx + dy * dy)

      // Advance waypoint when close enough
      if (dist < 20 && v.waypointIdx < path.length - 1) {
        v.waypointIdx++
      }

      // Recycle at end of path
      if (v.waypointIdx >= path.length - 1 && dist < 25) {
        const start = main[0]
        Matter.Body.setPosition(v.body, {
          x: start.x + (Math.random() - 0.5) * 80,
          y: start.y + (Math.random() - 0.5) * 60,
        })
        Matter.Body.setVelocity(v.body, { x: 0, y: 0 })
        v.waypointIdx = 0
        v.isReroute = false
        v.trail = []
        continue
      }

      // Apply waypoint attraction force
      if (dist > 3) {
        const strength = this.FLOW_STRENGTH * (v.isReroute ? 0.7 : 1.0)
        Matter.Body.applyForce(v.body, v.body.position, {
          x: (dx / dist) * strength,
          y: (dy / dist) * strength,
        })
      }

      // Trail
      v.trail.push({ x: bx, y: by })
      if (v.trail.length > this.TRAIL_LEN) v.trail.shift()
    }

    // ── RENDER ──
    this.gfx.clear()
    this.densityGfx.clear()
    this.pathGfx.clear()

    // Draw background path lines (dim guides showing the routes)
    this.drawPathGuide(this.pathGfx, main, shippingHex, 0.08, 2)
    if (reroute.length >= 2) {
      const rerouteAlpha = this.constricted ? Math.min(0.12, this.pressure * 0.1) : 0.02
      this.drawPathGuide(this.pathGfx, reroute, rerouteHex, rerouteAlpha, 1.5)
    }
    for (const op of this.otherPaths) {
      if (op.length >= 2) {
        this.drawPathGuide(this.pathGfx, op, op[0].color, 0.06, op[0].width * 0.5)
      }
    }

    // ── Density bloom: compute local density and draw glow ──
    if (this.chokepointPos && this.constricted) {
      this.drawDensityBloom(this.densityGfx, shippingHex)
    }

    // ── Draw vessel bodies: position from Matter, visual from Pixi ──
    for (const v of this.vessels) {
      const bx = v.body.position.x
      const by = v.body.position.y
      const rad = (v.body as any).circleRadius || 2.5
      const speed = Math.sqrt(v.body.velocity.x ** 2 + v.body.velocity.y ** 2)
      const color = v.isReroute ? rerouteHex : shippingHex

      // Trail afterimage
      if (v.trail.length >= 2) {
        for (let i = 0; i < v.trail.length - 1; i++) {
          const t = (i + 1) / v.trail.length
          const trailAlpha = t * 0.25
          this.gfx.lineStyle(rad * t, color, trailAlpha)
          this.gfx.moveTo(v.trail[i].x, v.trail[i].y)
          this.gfx.lineTo(v.trail[i + 1].x, v.trail[i + 1].y)
        }
      }

      // Velocity-based bloom: fast-moving bodies glow less, bunched bodies glow more
      const bunchGlow = Math.max(0, 0.15 - speed * 0.03)
      if (bunchGlow > 0.02) {
        this.gfx.lineStyle(0)
        this.gfx.beginFill(color, bunchGlow)
        this.gfx.drawCircle(bx, by, rad * 3)
        this.gfx.endFill()
      }

      // Core body
      const bodyAlpha = 0.5 + Math.min(0.45, (1 / (speed + 0.5)) * 0.3)
      this.gfx.lineStyle(0)
      this.gfx.beginFill(color, bodyAlpha)
      this.gfx.drawCircle(bx, by, rad)
      this.gfx.endFill()
    }

    // ── Chokepoint stress glow ──
    if (this.chokepointPos && this.constricted) {
      const cp = this.chokepointPos
      const time = Date.now() * 0.001
      const pulse = 0.5 + 0.3 * Math.sin(time * 2)
      const layers = 5
      for (let i = layers; i >= 0; i--) {
        const r = (4 + i * 4) * (1 + this.pressure * 0.3)
        const a = 0.03 * pulse * (layers - i + 1) * this.pressure
        this.gfx.beginFill(0xFF4444, Math.min(0.15, a))
        this.gfx.drawCircle(cp.x, cp.y, r)
        this.gfx.endFill()
      }
    }

    // Port destination glow
    if (this.portPos) {
      this.gfx.beginFill(PIXI.utils.string2hex(COLORS.household), 0.08)
      this.gfx.drawCircle(this.portPos.x, this.portPos.y, 10)
      this.gfx.endFill()
      this.gfx.beginFill(PIXI.utils.string2hex(COLORS.household), 0.3)
      this.gfx.drawCircle(this.portPos.x, this.portPos.y, 4)
      this.gfx.endFill()
    }

    // Perspective emphasis
    this.container.alpha = this.perspective === 'nurse' ? 0.5 : 1.0
  }

  private drawPathGuide(g: PIXI.Graphics, path: { x: number; y: number }[], color: number, alpha: number, width: number) {
    if (path.length < 2) return
    // Outer glow
    g.lineStyle(width * 3, color, alpha * 0.3)
    g.moveTo(path[0].x, path[0].y)
    for (let i = 1; i < path.length; i++) g.lineTo(path[i].x, path[i].y)
    // Core
    g.lineStyle(width, color, alpha)
    g.moveTo(path[0].x, path[0].y)
    for (let i = 1; i < path.length; i++) g.lineTo(path[i].x, path[i].y)
  }

  /**
   * Draw density bloom: where bodies cluster, glow brighter.
   * Uses a grid sampling approach for O(n) performance.
   */
  private drawDensityBloom(g: PIXI.Graphics, color: number) {
    const cellSize = 25
    const density: Map<string, number> = new Map()

    for (const v of this.vessels) {
      const cx = Math.floor(v.body.position.x / cellSize)
      const cy = Math.floor(v.body.position.y / cellSize)
      const key = `${cx},${cy}`
      density.set(key, (density.get(key) || 0) + 1)
    }

    for (const [key, count] of density) {
      if (count < 3) continue // only show where bodies actually bunch
      const [cx, cy] = key.split(',').map(Number)
      const x = (cx + 0.5) * cellSize
      const y = (cy + 0.5) * cellSize
      const intensity = Math.min(1, count / 8)
      // Soft bloom
      g.beginFill(color, intensity * 0.06)
      g.drawCircle(x, y, cellSize * 1.2)
      g.endFill()
      g.beginFill(color, intensity * 0.12)
      g.drawCircle(x, y, cellSize * 0.6)
      g.endFill()
    }
  }

  setVisible(visible: boolean) {
    this.container.visible = visible
  }

  clear() {
    for (const v of this.vessels) {
      Matter.Composite.remove(this.engine.world, v.body)
    }
    this.vessels = []
    for (const w of this.chokepointWalls) {
      Matter.Composite.remove(this.engine.world, w)
    }
    this.chokepointWalls = []
    this.gfx.clear()
    this.densityGfx.clear()
    this.pathGfx.clear()
  }

  dispose() {
    this.clear()
    this.container.destroy({ children: true })
  }
}
