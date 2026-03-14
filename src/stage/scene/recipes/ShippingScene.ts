import * as PIXI from 'pixi.js'
import Matter from 'matter-js'
import type { SceneRecipe } from '../SceneRecipe'
import type { ActiveScene, SceneCtx } from '../SceneRecipeController'
import { TextureAtlas } from '../../renderers/primitives/TextureAtlas'
import { ActorPool } from '../../renderers/primitives/ActorPool'
import { RouteRenderer } from '../../renderers/primitives/RouteRenderer'
import { WakeTrailSystem } from '../../renderers/primitives/WakeTrailSystem'

/**
 * ShippingScene — the offshore cause layer as a scene recipe.
 *
 * Ships flowing along maritime lanes toward Mombasa.
 * Chokepoint funnel walls with narrowing gap under pressure.
 * Reroute path around Africa when constricted.
 * Wake trails behind each vessel.
 * Animated dashed route lines with traveling pulse dots.
 *
 * Rendering: TextureAtlas + ActorPool + RouteRenderer + WakeTrailSystem.
 * 12–18 visible ship sprites. Lane glow + queue bloom are primary.
 */

interface VesselBody {
  body: Matter.Body
  waypointIdx: number
  isReroute: boolean
  prevAngle: number
}

export class ShippingScene implements ActiveScene {
  readonly id: string
  private recipe: SceneRecipe
  private ctx: SceneCtx
  private container: PIXI.Container
  private laneGfx: PIXI.Graphics
  private bloomGfx: PIXI.Graphics

  private vessels: VesselBody[] = []
  private chokepointWalls: Matter.Body[] = []
  private gapWidth = 35

  private mainPath: { x: number; y: number }[] = []
  private reroutePath: { x: number; y: number }[] = []

  private atlas: TextureAtlas
  private actorPool: ActorPool
  private routeRenderer: RouteRenderer
  private wakeSystem: WakeTrailSystem

  private elapsed = 0

  private readonly VESSEL_COUNT = 14
  private readonly FLOW_STRENGTH = 0.000038
  private readonly REROUTE_FRACTION = 0.35

  constructor(recipe: SceneRecipe, ctx: SceneCtx) {
    this.id = recipe.id
    this.recipe = recipe
    this.ctx = ctx

    this.container = new PIXI.Container()
    ctx.app.stage.addChild(this.container)

    this.laneGfx = new PIXI.Graphics()
    this.container.addChild(this.laneGfx)
    this.bloomGfx = new PIXI.Graphics()
    this.container.addChild(this.bloomGfx)

    // TextureAtlas — no try/catch, let errors surface
    this.atlas = TextureAtlas.get(ctx.app.renderer)

    // Route overlay — animated dashed lines
    this.routeRenderer = new RouteRenderer(this.container)

    // Wake particle system
    this.wakeSystem = new WakeTrailSystem(
      this.container, this.atlas.tex('wake_particle'), 400,
    )

    // Ship sprite pool
    this.actorPool = new ActorPool(this.container, this.VESSEL_COUNT + 4, {
      texture: this.atlas.tex('ship'),
      glowTexture: this.atlas.tex('ship_glow'),
      scale: 0.5,
    })

    this.buildPaths()
    this.setupPhysics()
    this.drawLanes()
  }

  private get anchors() { return this.ctx.anchors }
  private get engine() { return this.ctx.matterEngine }
  private get pressure() { return this.recipe.pressure }
  private get constricted() { return this.pressure > 0.3 }

  private buildPaths() {
    const a = this.anchors
    // Main path: chokepoint → Mombasa port
    const chokepoint = a.chokepoint || a.hormuz || { x: 200, y: 180 }
    const port = a.mombasa || a.port || { x: 500, y: 350 }
    const mid = a.seaMid || {
      x: (chokepoint.x + port.x) / 2 + 40,
      y: (chokepoint.y + port.y) / 2,
    }
    this.mainPath = [chokepoint, mid, port]

    // Reroute: around Africa (longer arc)
    const rerouteMid1 = {
      x: chokepoint.x - 80,
      y: chokepoint.y + 100,
    }
    const rerouteMid2 = {
      x: port.x - 60,
      y: port.y + 80,
    }
    this.reroutePath = [chokepoint, rerouteMid1, rerouteMid2, port]
  }

  private setupPhysics() {
    if (this.mainPath.length < 2) return

    const cp = this.mainPath[0] // chokepoint is start of main path
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

    // Spawn vessels spread along the main path
    for (let i = 0; i < this.VESSEL_COUNT; i++) {
      const t = Math.random()
      const path = this.mainPath
      const segIdx = Math.min(Math.floor(t * (path.length - 1)), path.length - 2)
      const lt = t * (path.length - 1) - segIdx
      const spawnX = path[segIdx].x + (path[segIdx + 1].x - path[segIdx].x) * lt + (Math.random() - 0.5) * 25
      const spawnY = path[segIdx].y + (path[segIdx + 1].y - path[segIdx].y) * lt + (Math.random() - 0.5) * 18

      const radius = 3.5 + Math.random() * 1.5
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
        body, waypointIdx: Math.max(0, segIdx),
        isReroute: false, prevAngle: 0,
      })
    }
  }

  private drawLanes() {
    this.laneGfx.clear()
    const main = this.mainPath
    if (main.length < 2) return

    // Main lane glow (3-layer)
    const color = 0x5B9BD5
    this.laneGfx.lineStyle(20, color, 0.04)
    this.laneGfx.moveTo(main[0].x, main[0].y)
    for (let i = 1; i < main.length; i++) this.laneGfx.lineTo(main[i].x, main[i].y)

    this.laneGfx.lineStyle(10, color, 0.1)
    this.laneGfx.moveTo(main[0].x, main[0].y)
    for (let i = 1; i < main.length; i++) this.laneGfx.lineTo(main[i].x, main[i].y)

    this.laneGfx.lineStyle(3, color, 0.2)
    this.laneGfx.moveTo(main[0].x, main[0].y)
    for (let i = 1; i < main.length; i++) this.laneGfx.lineTo(main[i].x, main[i].y)

    // Port glow at Mombasa
    const port = main[main.length - 1]
    for (let i = 3; i >= 0; i--) {
      this.laneGfx.beginFill(0xE8C874, 0.02 * (4 - i))
      this.laneGfx.drawCircle(port.x, port.y, 18 + i * 6)
      this.laneGfx.endFill()
    }
  }

  update(dt: number) {
    this.elapsed += dt
    Matter.Engine.update(this.engine, dt * 1000)

    const main = this.mainPath
    const reroute = this.reroutePath
    const hasReroute = this.constricted && reroute.length >= 2

    // Update chokepoint gap — visible narrowing
    if (this.chokepointWalls.length === 2) {
      const cp = main[0]
      const wallLen = 70
      const targetGap = this.constricted ? Math.max(4, 35 - this.pressure * 25) : 35
      this.gapWidth += (targetGap - this.gapWidth) * 0.05
      const halfGap = this.gapWidth / 2
      Matter.Body.setPosition(this.chokepointWalls[0], { x: cp.x, y: cp.y - halfGap - wallLen / 2 })
      Matter.Body.setPosition(this.chokepointWalls[1], { x: cp.x, y: cp.y + halfGap + wallLen / 2 })
    }

    // Apply forces + reroute decisions
    for (const v of this.vessels) {
      const bx = v.body.position.x
      const by = v.body.position.y
      const path = v.isReroute ? reroute : main
      if (path.length < 2) continue

      // Reroute decision near chokepoint
      if (hasReroute && !v.isReroute) {
        const cp = main[0]
        const distToChoke = Math.sqrt((bx - cp.x) ** 2 + (by - cp.y) ** 2)
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
        continue
      }

      if (dist > 3) {
        const str = this.FLOW_STRENGTH * (v.isReroute ? 0.7 : 1.0)
        Matter.Body.applyForce(v.body, v.body.position, {
          x: (dx / dist) * str, y: (dy / dist) * str,
        })
      }

      // Smooth angle
      const vx = v.body.velocity.x
      const vy = v.body.velocity.y
      if (Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1) {
        const target = Math.atan2(vy, vx)
        v.prevAngle += (target - v.prevAngle) * 0.15
      }
    }

    // ── RENDER ──
    this.bloomGfx.clear()

    // Animated dashed route lines
    this.routeRenderer.clearRoutes()
    if (main.length >= 2) {
      this.routeRenderer.addRoute({
        path: main, color: 0x5B9BD5, width: 1.5,
        speed: 0.8, alpha: 0.35, pulseEnabled: true,
      })
    }
    if (hasReroute) {
      this.routeRenderer.addRoute({
        path: reroute, color: 0xD4763C, width: 1.2,
        speed: 0.6, alpha: 0.2 * this.pressure, pulseEnabled: true,
      })
    }
    this.routeRenderer.update(dt)

    // Ship sprites + wake particles
    for (let i = 0; i < this.vessels.length; i++) {
      const v = this.vessels[i]
      const bx = v.body.position.x
      const by = v.body.position.y
      const speed = Math.sqrt(v.body.velocity.x ** 2 + v.body.velocity.y ** 2)
      const scale = 0.5 * (1.0 + ((v.body as any).circleRadius || 3.5) * 0.06)
      const alpha = 0.6 + Math.min(0.35, 0.3 / (speed + 0.4))
      const color = v.isReroute ? 0xD4763C : 0x5B9BD5

      const id = `v${i}`
      this.actorPool.activate(id, bx, by, v.prevAngle, alpha)
      this.actorPool.updateActor(id, bx, by, v.prevAngle, alpha, scale)

      // Wake particles behind moving ships
      if (speed > 0.3) {
        this.wakeSystem.emit(bx, by, v.body.velocity.x, v.body.velocity.y, color, 1)
      }
    }

    this.wakeSystem.update(dt)

    // Chokepoint stress glow — pulsing when constricted
    if (this.constricted && main.length > 0) {
      const cp = main[0]
      const pulse = 0.5 + 0.4 * Math.sin(this.elapsed * 4)
      for (let i = 5; i >= 0; i--) {
        const r = (5 + i * 5) * (1 + this.pressure * 0.4)
        const a = 0.03 * pulse * (6 - i) * this.pressure
        this.bloomGfx.beginFill(0xFF4444, Math.min(0.15, a))
        this.bloomGfx.drawCircle(cp.x, cp.y, r)
        this.bloomGfx.endFill()
      }
    }

    // Queue bloom at chokepoint
    if (this.constricted && this.pressure > 0.15 && main.length > 0) {
      const cp = main[0]
      const layers = 8
      for (let i = layers; i >= 0; i--) {
        const r = (8 + i * 6) * this.pressure
        const a = 0.02 * (layers - i + 1) * this.pressure
        this.bloomGfx.beginFill(0xFF4444, Math.min(0.15, a))
        this.bloomGfx.drawCircle(cp.x, cp.y, r)
        this.bloomGfx.endFill()
      }
    }
  }

  resize() {
    this.drawLanes()
  }

  dispose() {
    for (const v of this.vessels) {
      Matter.Composite.remove(this.engine.world, v.body)
    }
    this.vessels = []
    for (const w of this.chokepointWalls) {
      Matter.Composite.remove(this.engine.world, w)
    }
    this.chokepointWalls = []
    this.actorPool.dispose()
    this.wakeSystem.dispose()
    this.routeRenderer.dispose()
    this.container.destroy({ children: true })
  }
}
