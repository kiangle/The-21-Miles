import * as PIXI from 'pixi.js'

/**
 * ActorPool — sprite-based actor pool using pre-rendered textures.
 *
 * Pre-allocates a fixed array of PIXI.Sprite instances.
 * Activate/deactivate toggles visibility — zero per-frame allocation.
 * Optional glow overlay per actor (additive blended, separate container).
 */

export interface ActorConfig {
  texture: PIXI.Texture
  glowTexture?: PIXI.Texture
  anchorX?: number
  anchorY?: number
  scale?: number
}

interface PoolSlot {
  sprite: PIXI.Sprite
  glowSprite: PIXI.Sprite | null
  active: boolean
  externalId: string | null
}

export class ActorPool {
  private container: PIXI.Container
  private glowContainer: PIXI.Container
  private pool: PoolSlot[] = []
  private idMap: Map<string, number> = new Map()
  private config: ActorConfig

  constructor(parent: PIXI.Container, capacity: number, config: ActorConfig) {
    this.config = config

    this.glowContainer = new PIXI.Container()
    parent.addChild(this.glowContainer)

    this.container = new PIXI.Container()
    parent.addChild(this.container)

    const ax = config.anchorX ?? 0.5
    const ay = config.anchorY ?? 0.5
    const baseScale = config.scale ?? 1

    for (let i = 0; i < capacity; i++) {
      const sprite = new PIXI.Sprite(config.texture)
      sprite.anchor.set(ax, ay)
      sprite.scale.set(baseScale)
      sprite.visible = false
      this.container.addChild(sprite)

      let glowSprite: PIXI.Sprite | null = null
      if (config.glowTexture) {
        glowSprite = new PIXI.Sprite(config.glowTexture)
        glowSprite.anchor.set(0.5, 0.5)
        glowSprite.scale.set(baseScale * 1.5)
        glowSprite.alpha = 0.5
        glowSprite.blendMode = PIXI.BLEND_MODES.ADD
        glowSprite.visible = false
        this.glowContainer.addChild(glowSprite)
      }

      this.pool.push({ sprite, glowSprite, active: false, externalId: null })
    }
  }

  /**
   * Activate a sprite by external ID. Returns pool index or -1 if full.
   */
  activate(id: string, x: number, y: number, rotation: number, alpha = 1): number {
    // Already active?
    const existing = this.idMap.get(id)
    if (existing !== undefined) {
      this.updateActor(id, x, y, rotation, alpha)
      return existing
    }

    // Find free slot
    for (let i = 0; i < this.pool.length; i++) {
      const slot = this.pool[i]
      if (!slot.active) {
        slot.active = true
        slot.externalId = id
        slot.sprite.visible = true
        slot.sprite.position.set(x, y)
        slot.sprite.rotation = rotation
        slot.sprite.alpha = alpha
        if (slot.glowSprite) {
          slot.glowSprite.visible = true
          slot.glowSprite.position.set(x, y)
          slot.glowSprite.alpha = alpha * 0.5
        }
        this.idMap.set(id, i)
        return i
      }
    }
    return -1 // Pool exhausted
  }

  /**
   * Update position/rotation/alpha/scale of an active actor.
   */
  updateActor(id: string, x: number, y: number, rotation: number, alpha = 1, scale?: number) {
    const idx = this.idMap.get(id)
    if (idx === undefined) return

    const slot = this.pool[idx]
    slot.sprite.position.set(x, y)
    slot.sprite.rotation = rotation
    slot.sprite.alpha = alpha
    if (scale !== undefined) {
      slot.sprite.scale.set(scale)
    }
    if (slot.glowSprite) {
      slot.glowSprite.position.set(x, y)
      slot.glowSprite.alpha = alpha * 0.5
      if (scale !== undefined) {
        slot.glowSprite.scale.set(scale * 1.5)
      }
    }
  }

  /**
   * Deactivate a single actor by ID.
   */
  deactivate(id: string) {
    const idx = this.idMap.get(id)
    if (idx === undefined) return

    const slot = this.pool[idx]
    slot.active = false
    slot.externalId = null
    slot.sprite.visible = false
    if (slot.glowSprite) slot.glowSprite.visible = false
    this.idMap.delete(id)
  }

  /**
   * Deactivate all actors.
   */
  deactivateAll() {
    for (const slot of this.pool) {
      slot.active = false
      slot.externalId = null
      slot.sprite.visible = false
      if (slot.glowSprite) slot.glowSprite.visible = false
    }
    this.idMap.clear()
  }

  getActiveCount(): number {
    return this.idMap.size
  }

  dispose() {
    this.deactivateAll()
    this.container.destroy({ children: true })
    this.glowContainer.destroy({ children: true })
  }
}
