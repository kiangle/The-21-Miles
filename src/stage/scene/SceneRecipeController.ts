import * as PIXI from 'pixi.js'
import Matter from 'matter-js'
import type { SceneRecipe } from './SceneRecipe'

/**
 * SceneRecipeController — the single authority on what is alive.
 *
 * Only one recipe scene exists at a time.
 * On every recipe change: dispose old, create new.
 * No old motion survives.
 */

export interface ActiveScene {
  id: string
  update(dt: number): void
  resize(): void
  dispose(): void
}

export type SceneCtx = {
  app: PIXI.Application
  matterEngine: Matter.Engine
  anchors: Record<string, { x: number; y: number }>
}

/** Factory type for creating scenes from recipes. */
export type SceneFactory = (recipe: SceneRecipe, ctx: SceneCtx) => ActiveScene | null

export class SceneRecipeController {
  private active: ActiveScene | null = null
  private factory: SceneFactory

  constructor(factory: SceneFactory) {
    this.factory = factory
  }

  /** Get active recipe id. */
  getActiveId(): string | null {
    return this.active?.id ?? null
  }

  /**
   * Apply a new recipe. This is the HARD RESET point.
   *
   * 1. Dispose the current scene completely
   * 2. Clear dynamic Matter bodies
   * 3. Create the new scene
   */
  apply(recipe: SceneRecipe, ctx: SceneCtx) {
    if (this.active?.id === recipe.id) return
    this.reset(ctx)
    this.active = this.factory(recipe, ctx)
  }

  /** Update the active scene. */
  update(dt: number) {
    this.active?.update(dt)
  }

  /** Resize the active scene. */
  resize() {
    this.active?.resize()
  }

  /** Hard reset — dispose active scene and clear Matter bodies. */
  reset(ctx?: SceneCtx) {
    if (this.active) {
      this.active.dispose()
      this.active = null
    }
    if (ctx) {
      // Clear all non-static bodies from the engine
      const allBodies = Matter.Composite.allBodies(ctx.matterEngine.world)
      const dynamicBodies = allBodies.filter(b => !b.isStatic)
      if (dynamicBodies.length > 0) {
        Matter.Composite.remove(ctx.matterEngine.world, dynamicBodies)
      }
    }
  }

  dispose(ctx?: SceneCtx) {
    this.reset(ctx)
  }
}
