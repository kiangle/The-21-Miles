import * as PIXI from 'pixi.js'
import Matter from 'matter-js'
import type { SceneRecipe } from '../SceneRecipe'
import type { ActiveScene, SceneCtx } from '../SceneRecipeController'
import { drawTruckMiniature } from '../../renderers/primitives/MiniatureFactory'

/**
 * FreightScene — Joseph's world.
 *
 * Convoys of trucks flowing Mombasa → Nairobi through a walled corridor.
 * Bottleneck gate at 40% along the corridor.
 * Convoy burst emission pattern.
 * Depot glow at Mombasa, destination glow at Nairobi.
 */

interface TruckBody {
  body: Matter.Body
  age: number
  prevAngle: number
}

export class FreightScene implements ActiveScene {
  readonly id: string
  private recipe: SceneRecipe
  private ctx: SceneCtx
  private container: PIXI.Container
  private corridorGfx: PIXI.Graphics
  private actorGfx: PIXI.Graphics
  private bloomGfx: PIXI.Graphics
  private bodies: TruckBody[] = []
  private corridorWalls: Matter.Body[] = []
  private elapsed = 0
  private lastBurstTime = 0
  private burstCount = 0

  constructor(recipe: SceneRecipe, ctx: SceneCtx) {
    this.id = recipe.id
    this.recipe = recipe
    this.ctx = ctx

    this.container = new PIXI.Container()
    ctx.app.stage.addChild(this.container)

    this.corridorGfx = new PIXI.Graphics()
    this.actorGfx = new PIXI.Graphics()
    this.bloomGfx = new PIXI.Graphics()
    this.container.addChild(this.corridorGfx)
    this.container.addChild(this.bloomGfx)
    this.container.addChild(this.actorGfx)

    this.setupCorridor()
    this.drawCorridor()
  }

  private get anchors() { return this.ctx.anchors }
  private get engine() { return this.ctx.matterEngine }

  private getPath(): { x: number; y: number }[] {
    const a = this.anchors
    if (!a.mombasa || !a.nairobi) return []
    const mid = a.corridorMid || {
      x: (a.mombasa.x + a.nairobi.x) / 2,
      y: (a.mombasa.y + a.nairobi.y) / 2,
    }
    return [a.mombasa, mid, a.nairobi]
  }

  private setupCorridor() {
    const path = this.getPath()
    if (path.length < 2) return

    // Pressure drives corridor and bottleneck widths
    const corridorWidth = 32 * (1 - this.recipe.pressure * 0.3)
    const bottleneckWidth = 40 * (1 - this.recipe.pressure * 0.6)
    const bottleneckPos = 0.4

    for (let i = 0; i < path.length - 1; i++) {
      const p0 = path[i]
      const p1 = path[i + 1]
      const dx = p1.x - p0.x
      const dy = p1.y - p0.y
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len < 1) continue
      const nx = -dy / len
      const ny = dx / len
      const mx = (p0.x + p1.x) / 2
      const my = (p0.y + p1.y) / 2
      const angle = Math.atan2(dy, dx)

      // Segment width narrows at bottleneck
      const segT = (i + 0.5) / (path.length - 1)
      const isBottleneck = Math.abs(segT - bottleneckPos) < 0.15
      const width = isBottleneck ? bottleneckWidth : corridorWidth

      for (const side of [-1, 1]) {
        const wall = Matter.Bodies.rectangle(
          mx + nx * side * width / 2,
          my + ny * side * width / 2,
          len, 7,
          { isStatic: true, angle, label: 'corridor_wall' },
        )
        Matter.Composite.add(this.engine.world, wall)
        this.corridorWalls.push(wall)
      }
    }
  }

  private drawCorridor() {
    const path = this.getPath()
    if (path.length < 2) return

    this.corridorGfx.clear()
    // Corridor outline
    this.corridorGfx.lineStyle(1.5, 0xE8B94A, 0.2)
    this.corridorGfx.moveTo(path[0].x, path[0].y)
    for (let i = 1; i < path.length; i++) {
      this.corridorGfx.lineTo(path[i].x, path[i].y)
    }

    // Depot glow at Mombasa
    const start = path[0]
    for (let i = 3; i >= 0; i--) {
      this.corridorGfx.beginFill(0xE8B94A, 0.02 * (4 - i))
      this.corridorGfx.drawCircle(start.x, start.y, 15 + i * 6)
      this.corridorGfx.endFill()
    }

    // Destination glow at Nairobi
    const end = path[path.length - 1]
    for (let i = 3; i >= 0; i--) {
      this.corridorGfx.beginFill(0xC8A96E, 0.015 * (4 - i))
      this.corridorGfx.drawCircle(end.x, end.y, 12 + i * 5)
      this.corridorGfx.endFill()
    }
  }

  private emitTruck() {
    const path = this.getPath()
    if (path.length < 1) return

    const start = path[0]
    const radius = 3.0 + Math.random() * 1.5
    const body = Matter.Bodies.circle(
      start.x + (Math.random() - 0.5) * 8,
      start.y + (Math.random() - 0.5) * 8,
      radius,
      {
        density: 0.005,
        frictionAir: 0.015,
        restitution: 0.3,
        friction: 0.1,
        label: 'truck',
        collisionFilter: { category: 0x0004, mask: 0x0008 },
      },
    )
    Matter.Composite.add(this.engine.world, body)
    this.bodies.push({ body, age: 0, prevAngle: 0 })
  }

  update(dt: number) {
    this.elapsed += dt
    Matter.Engine.update(this.engine, dt * 1000)

    // Convoy burst emission
    const burstCooldown = 1.5 + this.recipe.pressure * 4
    if (this.elapsed - this.lastBurstTime > burstCooldown && this.bodies.length < 16) {
      if (this.burstCount < 3 + Math.floor(Math.random() * 3)) {
        this.emitTruck()
        this.burstCount++
        this.lastBurstTime = this.elapsed - burstCooldown + 0.3 // Quick follow-up
      } else {
        this.burstCount = 0
        this.lastBurstTime = this.elapsed
      }
    }

    // Flow force toward Nairobi
    const path = this.getPath()
    if (path.length >= 2) {
      const end = path[path.length - 1]
      for (const tb of this.bodies) {
        tb.age += dt
        const dx = end.x - tb.body.position.x
        const dy = end.y - tb.body.position.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 1) {
          const f = 0.00003 * (0.5 + this.recipe.pressure)
          Matter.Body.applyForce(tb.body, tb.body.position, {
            x: (dx / dist) * f,
            y: (dy / dist) * f,
          })
        }
        // Track angle for miniature rotation
        const vx = tb.body.velocity.x
        const vy = tb.body.velocity.y
        if (Math.abs(vx) + Math.abs(vy) > 0.1) {
          tb.prevAngle = Math.atan2(vy, vx)
        }
      }
    }

    // Remove arrived bodies
    const end = path.length > 0 ? path[path.length - 1] : null
    this.bodies = this.bodies.filter(tb => {
      if (end) {
        const dx = end.x - tb.body.position.x
        const dy = end.y - tb.body.position.y
        if (Math.sqrt(dx * dx + dy * dy) < 12 || tb.age > 20) {
          Matter.Composite.remove(this.engine.world, tb.body)
          return false
        }
      }
      return true
    })

    // Draw actors
    this.actorGfx.clear()
    this.bloomGfx.clear()

    for (const tb of this.bodies) {
      const bx = tb.body.position.x
      const by = tb.body.position.y
      const speed = Math.sqrt(tb.body.velocity.x ** 2 + tb.body.velocity.y ** 2)

      // Stressed truck halo when slow near bottleneck
      if (speed < 0.5 && this.recipe.pressure > 0.3) {
        this.bloomGfx.beginFill(0xD4763C, 0.08)
        this.bloomGfx.drawCircle(bx, by, 8)
        this.bloomGfx.endFill()
      }

      drawTruckMiniature(this.actorGfx, bx, by, tb.prevAngle, 1.1, 0.85)
    }
  }

  resize() {
    this.drawCorridor()
  }

  dispose() {
    for (const tb of this.bodies) {
      Matter.Composite.remove(this.engine.world, tb.body)
    }
    this.bodies = []
    for (const w of this.corridorWalls) {
      Matter.Composite.remove(this.engine.world, w)
    }
    this.corridorWalls = []
    this.container.destroy({ children: true })
  }
}
