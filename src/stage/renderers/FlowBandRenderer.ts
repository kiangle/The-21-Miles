import * as PIXI from 'pixi.js'
import Matter from 'matter-js'
import { COLORS } from '../../app/config/constants'
import {
  drawShipMiniature, drawWake, drawLaneField,
  drawQueueBloom, drawNodeGlow, drawDensityBloom,
} from './primitives/MiniatureFactory'
import { TextureAtlas } from './primitives/TextureAtlas'
import { ActorPool } from './primitives/ActorPool'
import { RouteRenderer } from './primitives/RouteRenderer'
import { WakeTrailSystem } from './primitives/WakeTrailSystem'

/**
 * FlowBandRenderer — Shipping lens (OFFSHORE CAUSE LAYER).
 *
 * Human question: Where did the ships go?
 *
 * Shipping is background cause in the Nairobi scene.
 * Freight is the main hero. Shipping is the upstream explanation.
 *
 * What you SEE:
 * - A readable lane toward Mombasa (not scattered dots in ocean)
 * - Ship miniatures riding constrained maritime lanes
 * - Ships queue behind chokepoint funnel walls
 * - Visible constrained inflow — not open-space drift
 * - Reroute peel-off around Africa when pressure rises
 * - Wake trails behind each ship
 * - Lane field glow beneath the flow
 * - Downstream thinning: fewer ships past chokepoint
 *
 * 12–18 visible ship miniatures.
 * The lane field + queue bloom are primary.
 * Ships make the system concrete.
 */

interface VesselBody {
  body: Matter.Body
  trail: { x: number; y: number }[]
  waypointIdx: number
  isReroute: boolean
  prevAngle: number
}

export class FlowBandRenderer {
  private container: PIXI.Container
  private laneGfx: PIXI.Graphics
  private densityGfx: PIXI.Graphics
  private actorGfx: PIXI.Graphics
  private bloomGfx: PIXI.Graphics

  private engine: Matter.Engine
  private vessels: VesselBody[] = []
  private chokepointWalls: Matter.Body[] = []
  private gapWidth = 35

  private mainPath: { x: number; y: number }[] = []
  private reroutePath: { x: number; y: number }[] = []
  private otherPaths: { path: { x: number; y: number }[]; color: number; width: number }[] = []

  private chokepointPos: { x: number; y: number } | null = null
  private portPos: { x: number; y: number } | null = null

  private pressure = 0.5
  private perspective: 'nurse' | 'driver' | null = null
  private constricted = false

  private readonly VESSEL_COUNT = 14
  private readonly TRAIL_LEN = 10
  private readonly FLOW_STRENGTH = 0.000038
  private readonly REROUTE_FRACTION = 0.35

  // ── New rendering primitives (graceful fallback to MiniatureFactory) ──
  private atlas: TextureAtlas | null = null
  private actorPool: ActorPool | null = null
  private routeRenderer: RouteRenderer | null = null
  private wakeSystem: WakeTrailSystem | null = null
  private useNewRendering = false

  constructor(parent: PIXI.Container, engine: Matter.Engine) {
    this.container = new PIXI.Container()
    parent.addChild(this.container)
    this.engine = engine

    this.laneGfx = new PIXI.Graphics()
    this.container.addChild(this.laneGfx)
    this.densityGfx = new PIXI.Graphics()
    this.container.addChild(this.densityGfx)
    this.bloomGfx = new PIXI.Graphics()
    this.container.addChild(this.bloomGfx)
    this.actorGfx = new PIXI.Graphics()
    this.container.addChild(this.actorGfx)
  }

  /**
   * Initialize texture-based rendering. Call after constructor with app.renderer.
   * If this is never called or fails, falls back to MiniatureFactory drawing.
   */
  initAtlas(renderer: PIXI.IRenderer) {
    try {
      this.atlas = TextureAtlas.get(renderer)
      this.wakeSystem = new WakeTrailSystem(
        this.container, this.atlas.tex('wake_particle'), 300,
      )
      this.routeRenderer = new RouteRenderer(this.container)
      this.actorPool = new ActorPool(this.container, this.VESSEL_COUNT + 4, {
        texture: this.atlas.tex('ship'),
        glowTexture: this.atlas.tex('ship_glow'),
        scale: 0.5,
      })
      this.useNewRendering = true
    } catch (_e) {
      this.useNewRendering = false
    }
  }

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
      this.otherPaths.push({ path, color: hexColor, width })
    }
  }

  initPhysics() {
    if (!this.chokepointPos || this.mainPath.length < 2) return

    const cp = this.chokepointPos
    const wallLen = 70
    const wallThick = 7
    const halfGap = this.gapWidth / 2

    // Chokepoint funnel walls
    const wallTop = Matter.Bodies.rectangle(
      cp.x, cp.y - halfGap - wallLen / 2, wallThick, wallLen,
      { isStatic: true, label: 'choke_wall', collisionFilter: { category: 0x0008, mask: 0x0004 } },
    )
    const wallBot = Matter.Bodies.rectangle(
      cp.x, cp.y + halfGap + wallLen / 2, wallThick, wallLen,
      { isStatic: true, label: 'choke_wall', collisionFilter: { category: 0x0008, mask: 0x0004 } },
    )
    Matter.Composite.add(this.engine.world, [wallTop, wallBot])
    this.chokepointWalls = [wallTop, wallBot]

    // Spawn vessel bodies spread along the main path
    for (let i = 0; i < this.VESSEL_COUNT; i++) {
      const t = Math.random()
      const segIdx = Math.min(Math.floor(t * (this.mainPath.length - 1)), this.mainPath.length - 2)
      const lt = t * (this.mainPath.length - 1) - segIdx
      const spawnX = this.mainPath[segIdx].x + (this.mainPath[segIdx + 1].x - this.mainPath[segIdx].x) * lt + (Math.random() - 0.5) * 25
      const spawnY = this.mainPath[segIdx].y + (this.mainPath[segIdx + 1].y - this.mainPath[segIdx].y) * lt + (Math.random() - 0.5) * 18

      const radius = 3.5 + Math.random() * 1.5  // bigger collision body
      const body = Matter.Bodies.circle(spawnX, spawnY, radius, {
        density: 0.0006,
        frictionAir: 0.03 + Math.random() * 0.015,
        restitution: 0.25,
        friction: 0.08,
        label: 'vessel',
        collisionFilter: { category: 0x0004, mask: 0x0004 | 0x0008 },
      })
      Matter.Composite.add(this.engine.world, body)
      this.vessels.push({
        body, trail: [], waypointIdx: Math.max(0, segIdx),
        isReroute: false, prevAngle: 0,
      })
    }
  }

  setPressure(p: number) { this.pressure = Math.max(0, Math.min(1.5, p)) }
  setPerspective(role: 'nurse' | 'driver' | null) { this.perspective = role }

  setConstricted(constricted: boolean) {
    if (this.constricted === constricted) return
    this.constricted = constricted
  }

  update(_delta: number) {
    const shippingHex = PIXI.utils.string2hex(COLORS.shipping)
    const rerouteHex = PIXI.utils.string2hex(COLORS.importStress)
    const dt = _delta

    // ── Update chokepoint gap — VISIBLE narrowing ──
    if (this.chokepointPos && this.chokepointWalls.length === 2) {
      const cp = this.chokepointPos
      const wallLen = 70
      const targetGap = this.constricted ? Math.max(4, 35 - this.pressure * 25) : 35
      this.gapWidth += (targetGap - this.gapWidth) * 0.05
      const halfGap = this.gapWidth / 2
      Matter.Body.setPosition(this.chokepointWalls[0], { x: cp.x, y: cp.y - halfGap - wallLen / 2 })
      Matter.Body.setPosition(this.chokepointWalls[1], { x: cp.x, y: cp.y + halfGap + wallLen / 2 })
    }

    // ── Apply forces ──
    const reroute = this.reroutePath
    const main = this.mainPath
    const hasReroute = this.constricted && reroute.length >= 2

    for (const v of this.vessels) {
      const bx = v.body.position.x
      const by = v.body.position.y
      const path = v.isReroute ? reroute : main
      if (path.length < 2) continue

      // Reroute decision near chokepoint
      if (hasReroute && !v.isReroute && this.chokepointPos) {
        const distToChoke = Math.sqrt((bx - this.chokepointPos.x) ** 2 + (by - this.chokepointPos.y) ** 2)
        if (distToChoke < 70 && Math.random() < this.REROUTE_FRACTION * this.pressure * dt * 0.5) {
          v.isReroute = true
          v.waypointIdx = 0
        }
      }

      const wp = path[Math.min(v.waypointIdx, path.length - 1)]
      const dx = wp.x - bx
      const dy = wp.y - by
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < 22 && v.waypointIdx < path.length - 1) v.waypointIdx++

      // Recycle at end of path
      if (v.waypointIdx >= path.length - 1 && dist < 30) {
        const start = main[0]
        Matter.Body.setPosition(v.body, {
          x: start.x + (Math.random() - 0.5) * 70,
          y: start.y + (Math.random() - 0.5) * 50,
        })
        Matter.Body.setVelocity(v.body, { x: 0, y: 0 })
        v.waypointIdx = 0
        v.isReroute = false
        v.trail = []
        continue
      }

      if (dist > 3) {
        const str = this.FLOW_STRENGTH * (v.isReroute ? 0.7 : 1.0)
        Matter.Body.applyForce(v.body, v.body.position, {
          x: (dx / dist) * str, y: (dy / dist) * str,
        })
      }

      // Trail
      v.trail.push({ x: bx, y: by })
      if (v.trail.length > this.TRAIL_LEN) v.trail.shift()

      // Smooth angle
      const vx = v.body.velocity.x
      const vy = v.body.velocity.y
      if (Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1) {
        const target = Math.atan2(vy, vx)
        v.prevAngle += (target - v.prevAngle) * 0.15
      }
    }

    // ── RENDER ──
    this.laneGfx.clear()
    this.densityGfx.clear()
    this.bloomGfx.clear()
    this.actorGfx.clear()

    // Lane fields — STRONG, READABLE shipping lanes
    drawLaneField(this.laneGfx, main, shippingHex, 0.14, 5)
    if (reroute.length >= 2) {
      const a = this.constricted ? Math.min(0.2, this.pressure * 0.15) : 0.03
      drawLaneField(this.laneGfx, reroute, rerouteHex, a, 4)
    }
    for (const op of this.otherPaths) {
      drawLaneField(this.laneGfx, op.path, op.color, 0.08, op.width * 0.8)
    }

    // Density bloom where ships cluster
    const positions = this.vessels.map(v => v.body.position)
    drawDensityBloom(this.densityGfx, positions, 30, shippingHex, 2)

    // Queue bloom at chokepoint — BIG when constricted
    if (this.chokepointPos && this.constricted && this.pressure > 0.15) {
      drawQueueBloom(this.bloomGfx, this.chokepointPos.x, this.chokepointPos.y, this.pressure, 0xFF4444)
    }

    // Port glow at Mombasa — bigger, warmer
    if (this.portPos) {
      drawNodeGlow(this.actorGfx, this.portPos.x, this.portPos.y, 20, PIXI.utils.string2hex(COLORS.household), 0.9)
    }

    // Ship miniatures + wakes — sprite-based or fallback
    if (this.useNewRendering && this.actorPool && this.wakeSystem) {
      // Route overlay (animated dashed lines along main/reroute paths)
      if (this.routeRenderer) {
        this.routeRenderer.clearRoutes()
        if (main.length >= 2) {
          this.routeRenderer.addRoute({
            path: main, color: shippingHex, width: 1.5,
            speed: 0.8, alpha: 0.3, pulseEnabled: true,
          })
        }
        if (reroute.length >= 2 && this.constricted) {
          this.routeRenderer.addRoute({
            path: reroute, color: rerouteHex, width: 1.2,
            speed: 0.6, alpha: 0.2 * this.pressure, pulseEnabled: true,
          })
        }
        this.routeRenderer.update(dt)
      }

      // Sprite-based ships + particle wakes
      for (let vi = 0; vi < this.vessels.length; vi++) {
        const v = this.vessels[vi]
        const bx = v.body.position.x
        const by = v.body.position.y
        const color = v.isReroute ? rerouteHex : shippingHex
        const speed = Math.sqrt(v.body.velocity.x ** 2 + v.body.velocity.y ** 2)
        const scale = 0.5 * (1.0 + ((v.body as any).circleRadius || 3.5) * 0.06)
        const alpha = 0.6 + Math.min(0.35, 0.3 / (speed + 0.4))

        const id = `v${vi}`
        this.actorPool.activate(id, bx, by, v.prevAngle, alpha)
        this.actorPool.updateActor(id, bx, by, v.prevAngle, alpha, scale)

        // Particle wake behind moving ships
        if (speed > 0.3) {
          this.wakeSystem.emit(bx, by, v.body.velocity.x, v.body.velocity.y, color, 1)
        }
      }

      this.wakeSystem.update(dt)
    } else {
      // Fallback: original MiniatureFactory drawing
      for (const v of this.vessels) {
        const bx = v.body.position.x
        const by = v.body.position.y
        const color = v.isReroute ? rerouteHex : shippingHex
        const speed = Math.sqrt(v.body.velocity.x ** 2 + v.body.velocity.y ** 2)

        if (v.trail.length >= 2) {
          const wakeAlpha = Math.min(0.35, speed * 0.1)
          drawWake(this.actorGfx, v.trail, color, wakeAlpha, 1.5)
        }

        const scale = 1.0 + ((v.body as any).circleRadius || 3.5) * 0.06
        const alpha = 0.6 + Math.min(0.35, 0.3 / (speed + 0.4))
        drawShipMiniature(this.actorGfx, bx, by, v.prevAngle, scale, alpha)
      }
    }

    // Chokepoint stress glow — bigger, pulsing
    if (this.chokepointPos && this.constricted) {
      const cp = this.chokepointPos
      const time = Date.now() * 0.001
      const pulse = 0.5 + 0.4 * Math.sin(time * 2)
      for (let i = 5; i >= 0; i--) {
        const r = (5 + i * 5) * (1 + this.pressure * 0.4)
        const a = 0.03 * pulse * (6 - i) * this.pressure
        this.bloomGfx.beginFill(0xFF4444, Math.min(0.15, a))
        this.bloomGfx.drawCircle(cp.x, cp.y, r)
        this.bloomGfx.endFill()
      }
    }
  }

  setVisible(visible: boolean) { this.container.visible = visible }
  setAlpha(alpha: number) { this.container.alpha = alpha }

  clear() {
    for (const v of this.vessels) Matter.Composite.remove(this.engine.world, v.body)
    this.vessels = []
    for (const w of this.chokepointWalls) Matter.Composite.remove(this.engine.world, w)
    this.chokepointWalls = []
    this.laneGfx.clear()
    this.densityGfx.clear()
    this.bloomGfx.clear()
    this.actorGfx.clear()
    if (this.actorPool) this.actorPool.deactivateAll()
    if (this.wakeSystem) this.wakeSystem.clear()
    if (this.routeRenderer) this.routeRenderer.clearRoutes()
  }

  /** Hard reset — alias for clear(). Used by SceneRecipeController. */
  reset() { this.clear() }

  dispose() {
    this.clear()
    if (this.actorPool) { this.actorPool.dispose(); this.actorPool = null }
    if (this.wakeSystem) { this.wakeSystem.dispose(); this.wakeSystem = null }
    if (this.routeRenderer) { this.routeRenderer.dispose(); this.routeRenderer = null }
    this.useNewRendering = false
    this.container.destroy({ children: true })
  }
}
