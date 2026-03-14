import * as PIXI from 'pixi.js'
import Matter from 'matter-js'
import gsap from 'gsap'
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
   * Apply a new recipe with cross-fade transition.
   *
   * Old scene fades out over 1s then disposes.
   * New scene fades in over 0.8s.
   */
  apply(recipe: SceneRecipe, ctx: SceneCtx) {
    if (this.active?.id === recipe.id) return

    // Fade out the old scene instead of instant dispose
    if (this.active) {
      const dying = this.active
      const container = (dying as any).container as PIXI.Container | undefined
      if (container) {
        gsap.to(container, {
          alpha: 0,
          duration: 1.0,
          ease: 'power2.in',
          onComplete: () => {
            dying.dispose()
          },
        })
      } else {
        dying.dispose()
      }
    }
    this.active = null

    // Clear dynamic Matter bodies for the new scene
    const allBodies = Matter.Composite.allBodies(ctx.matterEngine.world)
    const dynamicBodies = allBodies.filter(b => !b.isStatic)
    if (dynamicBodies.length > 0) {
      Matter.Composite.remove(ctx.matterEngine.world, dynamicBodies)
    }

    this.active = this.factory(recipe, ctx)

    // Fade in the new scene
    if (this.active) {
      const container = (this.active as any).container as PIXI.Container | undefined
      if (container) {
        container.alpha = 0
        gsap.to(container, {
          alpha: 1,
          duration: 0.8,
          ease: 'power2.out',
          delay: 0.3,
        })
      }
    }
  }

  /**
   * Force-apply: rebuild the scene even if the recipe ID hasn't changed.
   * Used when projected anchors move but the recipe stays the same.
   */
  forceApply(recipe: SceneRecipe, ctx: SceneCtx) {
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
