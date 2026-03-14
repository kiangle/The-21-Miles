import * as PIXI from 'pixi.js'
import Matter from 'matter-js'
import type { SceneRecipe } from '../SceneRecipe'
import type { ActiveScene, SceneCtx } from '../SceneRecipeController'
import { TextureAtlas } from '../../renderers/primitives/TextureAtlas'
import { ActorPool } from '../../renderers/primitives/ActorPool'

/**
 * MedicineScene — Amara's world.
 *
 * Calm cadence of medicine bodies flowing Mombasa → Hospital.
 * Shelf bar showing supply level.
 * Heartbeat rhythm tied to delivery cadence.
 * No unrelated actors. No freight convoys. No ships.
 *
 * When pressure is low (day1): steady rhythm, shelf full.
 * When pressure rises (week1): missed beats, shelf depleting.
 *
 * Rendering: TextureAtlas + ActorPool.
 * No MiniatureFactory fallback — TextureAtlas is the only code path.
 */

interface MedicineBody {
  body: Matter.Body
  age: number
}

export class MedicineScene implements ActiveScene {
  readonly id: string
  private recipe: SceneRecipe
  private ctx: SceneCtx
  private container: PIXI.Container
  private pathGfx: PIXI.Graphics
  private actorGfx: PIXI.Graphics
  private shelfGfx: PIXI.Graphics
  private heartbeatGfx: PIXI.Graphics
  private bodies: MedicineBody[] = []
  private guideWalls: Matter.Body[] = []
  private elapsed = 0
  private lastEmitTime = 0
  private shelfLevel: number

  private atlas: TextureAtlas
  private actorPool: ActorPool

  constructor(recipe: SceneRecipe, ctx: SceneCtx) {
    this.id = recipe.id
    this.recipe = recipe
    this.ctx = ctx
    this.shelfLevel = recipe.shelfLevel ?? 1.0

    this.container = new PIXI.Container()
    ctx.app.stage.addChild(this.container)

    this.pathGfx = new PIXI.Graphics()
    this.actorGfx = new PIXI.Graphics()
    this.shelfGfx = new PIXI.Graphics()
    this.heartbeatGfx = new PIXI.Graphics()
    this.container.addChild(this.pathGfx)
    this.container.addChild(this.actorGfx)
    this.container.addChild(this.shelfGfx)
    this.container.addChild(this.heartbeatGfx)

    // TextureAtlas — no try/catch, let errors surface
    this.atlas = TextureAtlas.get(ctx.app.renderer)
    this.actorPool = new ActorPool(this.container, 14, {
      texture: this.atlas.tex('medicine'),
      glowTexture: this.atlas.tex('medicine_glow'),
      scale: 0.5,
    })

    this.setupPhysics()
    this.drawPath()
  }

  private get anchors() { return this.ctx.anchors }
  private get engine() { return this.ctx.matterEngine }

  private getPath(): { x: number; y: number }[] {
    const a = this.anchors
    if (!a.mombasa || !a.hospital) return []
    const mid = a.corridorMid || {
      x: (a.mombasa.x + (a.hospital || a.nairobi).x) / 2,
      y: (a.mombasa.y + (a.hospital || a.nairobi).y) / 2,
    }
    return [a.mombasa, mid, a.hospital || a.nairobi]
  }

  private setupPhysics() {
    const path = this.getPath()
    if (path.length < 2) return

    // Guide walls along the path (thin channel)
    const channelWidth = 14
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

      for (const side of [-1, 1]) {
        const wall = Matter.Bodies.rectangle(
          mx + nx * side * channelWidth / 2,
          my + ny * side * channelWidth / 2,
          len, 3,
          { isStatic: true, angle, label: 'guide_wall' },
        )
        Matter.Composite.add(this.engine.world, wall)
        this.guideWalls.push(wall)
      }
    }
  }

  private drawPath() {
    const path = this.getPath()
    if (path.length < 2) return

    this.pathGfx.clear()
    // Ghost corridor line
    this.pathGfx.lineStyle(2, 0xC44B3F, 0.15)
    this.pathGfx.moveTo(path[0].x, path[0].y)
    for (let i = 1; i < path.length; i++) {
      this.pathGfx.lineTo(path[i].x, path[i].y)
    }
  }

  private emitMedicine() {
    const path = this.getPath()
    if (path.length < 1) return

    const start = path[0]
    const body = Matter.Bodies.circle(
      start.x + (Math.random() - 0.5) * 6,
      start.y + (Math.random() - 0.5) * 6,
      3.0,
      {
        density: 0.003,
        frictionAir: 0.02,
        restitution: 0.3,
        label: 'medicine',
        collisionFilter: { category: 0x0004, mask: 0x0008 },
      },
    )
    Matter.Composite.add(this.engine.world, body)
    this.bodies.push({ body, age: 0 })
  }

  private drawShelf() {
    const hospital = this.anchors.hospital || this.anchors.nairobi
    if (!hospital) return

    this.shelfGfx.clear()
    const sx = hospital.x - 35
    const sy = hospital.y + 20
    const barW = 70
    const barH = 6

    // Background
    this.shelfGfx.beginFill(0x222222, 0.5)
    this.shelfGfx.drawRoundedRect(sx, sy, barW, barH, 2)
    this.shelfGfx.endFill()

    // Fill
    const fillColor = this.shelfLevel > 0.5 ? 0x4A9B7F : this.shelfLevel > 0.25 ? 0xE8B94A : 0xC44B3F
    this.shelfGfx.beginFill(fillColor, 0.7)
    this.shelfGfx.drawRoundedRect(sx, sy, barW * this.shelfLevel, barH, 2)
    this.shelfGfx.endFill()

    // Critical pulse outline
    if (this.shelfLevel < 0.35) {
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 4)
      this.shelfGfx.lineStyle(1.5, 0xC44B3F, pulse * 0.6)
      this.shelfGfx.drawRoundedRect(sx - 1, sy - 1, barW + 2, barH + 2, 3)
      this.shelfGfx.lineStyle(0)
    }
  }

  private drawHeartbeat() {
    const hospital = this.anchors.hospital || this.anchors.nairobi
    if (!hospital) return

    this.heartbeatGfx.clear()
    const hx = hospital.x - 40
    const hy = hospital.y + 35
    const w = 80

    // Heartbeat line
    this.heartbeatGfx.lineStyle(1, 0xC44B3F, 0.4)
    this.heartbeatGfx.moveTo(hx, hy)
    for (let i = 0; i < 20; i++) {
      const t = i / 20
      const px = hx + t * w
      const beat = Math.sin(this.elapsed * 3 + t * 10) * (1 - this.recipe.pressure * 0.6)
      const spike = Math.abs(Math.sin(t * Math.PI * 4 + this.elapsed * 2)) > 0.9 ? 6 : 0
      this.heartbeatGfx.lineTo(px, hy + beat * 3 + spike * (1 - this.recipe.pressure * 0.5))
    }
  }

  update(dt: number) {
    this.elapsed += dt
    Matter.Engine.update(this.engine, dt * 1000)

    // Cadence-based emission
    const cadenceInterval = 1.5 * (1 + this.recipe.pressure * 1.5)
    const shouldSkip = this.recipe.pressure > 0.4 && Math.random() < this.recipe.pressure * 0.3
    if (this.elapsed - this.lastEmitTime > cadenceInterval && this.bodies.length < 10) {
      this.lastEmitTime = this.elapsed
      if (!shouldSkip) {
        this.emitMedicine()
        // Deliver to shelf
        this.shelfLevel = Math.min(1.0, this.shelfLevel + 0.05)
      }
    }

    // Flow force along path
    const path = this.getPath()
    if (path.length >= 2) {
      const end = path[path.length - 1]
      for (const mb of this.bodies) {
        mb.age += dt
        const dx = end.x - mb.body.position.x
        const dy = end.y - mb.body.position.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 1) {
          const f = 0.000035
          Matter.Body.applyForce(mb.body, mb.body.position, {
            x: (dx / dist) * f,
            y: (dy / dist) * f,
          })
        }
      }
    }

    // Remove bodies that reached destination
    const end = path.length > 0 ? path[path.length - 1] : null
    this.bodies = this.bodies.filter(mb => {
      if (end) {
        const dx = end.x - mb.body.position.x
        const dy = end.y - mb.body.position.y
        if (Math.sqrt(dx * dx + dy * dy) < 10 || mb.age > 15) {
          Matter.Composite.remove(this.engine.world, mb.body)
          return false
        }
      }
      return true
    })

    // Shelf depletion over time
    this.shelfLevel = Math.max(0, this.shelfLevel - dt * 0.02 * (1 + this.recipe.pressure))

    // Draw — TextureAtlas + ActorPool only
    this.actorGfx.clear()
    for (let i = 0; i < this.bodies.length; i++) {
      const mb = this.bodies[i]
      const bx = mb.body.position.x
      const by = mb.body.position.y
      const id = `m${i}`
      this.actorPool.activate(id, bx, by, mb.body.angle, 0.85)
      this.actorPool.updateActor(id, bx, by, mb.body.angle, 0.85, 0.5)
    }

    this.drawShelf()
    this.drawHeartbeat()
  }

  resize() {
    this.drawPath()
  }

  dispose() {
    // Remove all bodies
    for (const mb of this.bodies) {
      Matter.Composite.remove(this.engine.world, mb.body)
    }
    this.bodies = []
    for (const w of this.guideWalls) {
      Matter.Composite.remove(this.engine.world, w)
    }
    this.guideWalls = []
    this.actorPool.dispose()
    // Remove Pixi container
    this.container.destroy({ children: true })
  }
}
