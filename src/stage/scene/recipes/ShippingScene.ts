import * as PIXI from 'pixi.js'
import Matter from 'matter-js'
import type { SceneRecipe } from '../SceneRecipe'
import type { ActiveScene, SceneCtx } from '../SceneRecipeController'
import { drawShipMiniature, drawWake, drawNodeGlow, drawQueueBloom, drawLaneField } from '../../renderers/primitives/MiniatureFactory'

/**
 * ShippingScene — the Indian Ocean arterial view.
 *
 * 15-20 vessel bodies flowing from Hormuz through the Gulf, Arabian Sea,
 * Indian Ocean to Mombasa. Chokepoint walls at Hormuz. Cape reroute path
 * activates based on pressure. Queue bloom at chokepoint when constricted.
 */

interface VesselBody {
  body: Matter.Body
  age: number
  prevAngle: number
  wake: { x: number; y: number }[]
  rerouted: boolean
}

export class ShippingScene implements ActiveScene {
  readonly id: string
  private recipe: SceneRecipe
  private ctx: SceneCtx
  container: PIXI.Container
  private routeGfx: PIXI.Graphics
  private actorGfx: PIXI.Graphics
  private bloomGfx: PIXI.Graphics
  private bodies: VesselBody[] = []
  private chokeWalls: Matter.Body[] = []
  private elapsed = 0
  private lastEmitTime = 0

  constructor(recipe: SceneRecipe, ctx: SceneCtx) {
    this.id = recipe.id
    this.recipe = recipe
    this.ctx = ctx

    this.container = new PIXI.Container()
    ctx.app.stage.addChild(this.container)

    this.routeGfx = new PIXI.Graphics()
    this.actorGfx = new PIXI.Graphics()
    this.bloomGfx = new PIXI.Graphics()
    this.container.addChild(this.routeGfx)
    this.container.addChild(this.bloomGfx)
    this.container.addChild(this.actorGfx)

    this.setupChokepoint()
    this.drawRoute()
  }

  private get anchors() { return this.ctx.anchors }
  private get engine() { return this.ctx.matterEngine }

  /** Main shipping route: Hormuz → Gulf → Arabian → Socotra → Indian Ocean → Mombasa */
  private getMainPath(): { x: number; y: number }[] {
    const a = this.anchors
    const ids = ['hormuz', 'route_gulf', 'route_arabian', 'route_socotra', 'route_indian1', 'route_indian2', 'route_approach', 'mombasa']
    const pts: { x: number; y: number }[] = []
    for (const id of ids) {
      if (a[id]) pts.push(a[id])
    }
    return pts
  }

  /** Cape reroute: from babElMandeb exit, down East Africa, around Cape, back up */
  private getCapePath(): { x: number; y: number }[] {
    const a = this.anchors
    const ids = ['cape_start', 'cape_south1', 'cape_south2', 'cape_tip', 'cape_north1', 'cape_north2', 'cape_approach', 'mombasa']
    const pts: { x: number; y: number }[] = []
    for (const id of ids) {
      if (a[id]) pts.push(a[id])
    }
    return pts
  }

  private setupChokepoint() {
    const hormuz = this.anchors.hormuz
    if (!hormuz) return

    // Chokepoint gap narrows with pressure
    const gapWidth = 30 * (1 - this.recipe.pressure)
    const wallLen = 40

    for (const side of [-1, 1]) {
      const wall = Matter.Bodies.rectangle(
        hormuz.x + side * (gapWidth / 2 + 10),
        hormuz.y,
        8, wallLen,
        { isStatic: true, label: 'choke_wall' },
      )
      Matter.Composite.add(this.engine.world, wall)
      this.chokeWalls.push(wall)
    }
  }

  private drawRoute() {
    this.routeGfx.clear()

    // Main route lane field
    const mainPath = this.getMainPath()
    if (mainPath.length >= 2) {
      drawLaneField(this.routeGfx, mainPath, 0x72b7ff, 0.35, 2)
    }

    // Cape reroute — only visible when pressure > 0.4
    if (this.recipe.pressure > 0.4) {
      const capePath = this.getCapePath()
      if (capePath.length >= 2) {
        const capeAlpha = Math.min(1, (this.recipe.pressure - 0.4) * 1.5)
        drawLaneField(this.routeGfx, capePath, 0xd4763c, 0.2 * capeAlpha, 1.5)
      }
    }

    // Port glow at Hormuz
    const hormuz = this.anchors.hormuz
    if (hormuz) {
      drawNodeGlow(this.routeGfx, hormuz.x, hormuz.y, 25, 0xff5c40, 0.8)
    }

    // Port glow at Mombasa
    const mombasa = this.anchors.mombasa
    if (mombasa) {
      drawNodeGlow(this.routeGfx, mombasa.x, mombasa.y, 20, 0xc8a96e, 0.6)
    }
  }

  private emitVessel() {
    const mainPath = this.getMainPath()
    if (mainPath.length < 2) return

    const start = mainPath[0]
    // Decide if rerouted (based on pressure)
    const rerouted = this.recipe.pressure > 0.4 && Math.random() < this.recipe.pressure * 0.6
    const radius = 3.5 + Math.random() * 1.5

    const body = Matter.Bodies.circle(
      start.x + (Math.random() - 0.5) * 12,
      start.y + (Math.random() - 0.5) * 12,
      radius,
      {
        density: 0.004,
        frictionAir: 0.012,
        restitution: 0.2,
        friction: 0.08,
        label: 'vessel',
        collisionFilter: { category: 0x0002, mask: 0x000A },
      },
    )
    Matter.Composite.add(this.engine.world, body)
    this.bodies.push({ body, age: 0, prevAngle: 0, wake: [], rerouted })
  }

  /** Get next waypoint for a vessel along its route path */
  private getNextWaypoint(vessel: VesselBody): { x: number; y: number } | null {
    const path = vessel.rerouted ? this.getCapePath() : this.getMainPath()
    if (path.length < 2) return null

    const pos = vessel.body.position
    let closestIdx = 0
    let closestDist = Infinity

    for (let i = 0; i < path.length; i++) {
      const dx = path[i].x - pos.x
      const dy = path[i].y - pos.y
      const dist = dx * dx + dy * dy
      if (dist < closestDist) {
        closestDist = dist
        closestIdx = i
      }
    }

    // Target the next waypoint after the closest
    const targetIdx = Math.min(closestIdx + 1, path.length - 1)
    return path[targetIdx]
  }

  update(dt: number) {
    this.elapsed += dt
    Matter.Engine.update(this.engine, dt * 1000)

    // Emit vessels — steady flow up to 18
    const emitInterval = 0.8 + (1 - this.recipe.pressure) * 1.5
    if (this.elapsed - this.lastEmitTime > emitInterval && this.bodies.length < 18) {
      this.emitVessel()
      this.lastEmitTime = this.elapsed
    }

    // Steer vessels along waypoints
    for (const v of this.bodies) {
      v.age += dt
      const target = this.getNextWaypoint(v)
      if (target) {
        const dx = target.x - v.body.position.x
        const dy = target.y - v.body.position.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 1) {
          const strength = 0.000035 * (0.5 + this.recipe.pressure)
          Matter.Body.applyForce(v.body, v.body.position, {
            x: (dx / dist) * strength,
            y: (dy / dist) * strength,
          })
        }
      }

      // Track angle for miniature rotation
      const vx = v.body.velocity.x
      const vy = v.body.velocity.y
      if (Math.abs(vx) + Math.abs(vy) > 0.1) {
        v.prevAngle = Math.atan2(vy, vx)
      }

      // Update wake trail (last 8 positions)
      v.wake.push({ x: v.body.position.x, y: v.body.position.y })
      if (v.wake.length > 8) v.wake.shift()
    }

    // Remove arrived vessels
    const mombasa = this.anchors.mombasa
    this.bodies = this.bodies.filter(v => {
      if (mombasa) {
        const dx = mombasa.x - v.body.position.x
        const dy = mombasa.y - v.body.position.y
        if (Math.sqrt(dx * dx + dy * dy) < 15 || v.age > 30) {
          Matter.Composite.remove(this.engine.world, v.body)
          return false
        }
      }
      return true
    })

    // Draw
    this.actorGfx.clear()
    this.bloomGfx.clear()

    // Queue bloom at chokepoint when pressure high
    const hormuz = this.anchors.hormuz
    if (hormuz && this.recipe.pressure > 0.3) {
      drawQueueBloom(this.bloomGfx, hormuz.x, hormuz.y, this.recipe.pressure, 0xff5c40)
    }

    for (const v of this.bodies) {
      const bx = v.body.position.x
      const by = v.body.position.y
      const speed = Math.sqrt(v.body.velocity.x ** 2 + v.body.velocity.y ** 2)

      // Wake trail
      if (v.wake.length >= 2) {
        drawWake(this.actorGfx, v.wake, v.rerouted ? 0xd4763c : 0xb9d7ff, 0.3, 1)
      }

      // Stressed halo when slow near chokepoint
      if (speed < 0.4 && this.recipe.pressure > 0.3 && hormuz) {
        const dh = Math.sqrt((bx - hormuz.x) ** 2 + (by - hormuz.y) ** 2)
        if (dh < 80) {
          this.bloomGfx.beginFill(0xff5c40, 0.1)
          this.bloomGfx.drawCircle(bx, by, 10)
          this.bloomGfx.endFill()
        }
      }

      // Ship miniature
      const tint = v.rerouted ? 0.7 : 0.9
      drawShipMiniature(this.actorGfx, bx, by, v.prevAngle, 1.2, tint)
    }
  }

  resize() {
    this.drawRoute()
  }

  dispose() {
    for (const v of this.bodies) {
      Matter.Composite.remove(this.engine.world, v.body)
    }
    this.bodies = []
    for (const w of this.chokeWalls) {
      Matter.Composite.remove(this.engine.world, w)
    }
    this.chokeWalls = []
    this.container.destroy({ children: true })
  }
}
