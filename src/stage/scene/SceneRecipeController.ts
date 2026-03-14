import * as PIXI from 'pixi.js'
import Matter from 'matter-js'
import gsap from 'gsap'
import type { SceneRecipe } from './SceneRecipe'
import { SplitFutureRenderer } from '../renderers/SplitFutureRenderer'

/**
 * SceneRecipeController — the single authority on what is alive.
 *
 * Only one recipe scene exists at a time.
 * On every recipe change: dispose old, create new.
 * No old motion survives.
 *
 * Compare mode: creates a second scene instance with altered pressure,
 * splits the screen with SplitFutureRenderer masks/divider/labels.
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
  private altScene: ActiveScene | null = null
  private altEngine: Matter.Engine | null = null
  private splitRenderer: SplitFutureRenderer | null = null
  private comparing = false
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

    // Tear down compare mode if active
    this.disableCompare()

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

  /**
   * Enable compare mode: split the screen, show current scene on left
   * and an altered-pressure version on right.
   */
  enableCompare(recipe: SceneRecipe, ctx: SceneCtx, altPressure: number) {
    if (this.comparing) return

    const w = ctx.app.screen.width
    const h = ctx.app.screen.height

    // Create split renderer (divider + labels + masks)
    this.splitRenderer = new SplitFutureRenderer(ctx.app.stage, w, h)
    this.splitRenderer.setVisible(true)
    this.splitRenderer.setSplit(1)

    // Mask the current scene to the left half
    const activeContainer = (this.active as any)?.container as PIXI.Container | undefined
    if (activeContainer) {
      const leftMask = this.splitRenderer.getLeftMask()
      ctx.app.stage.addChild(leftMask)
      activeContainer.mask = leftMask
    }

    // Create a separate Matter engine for the alt scene
    this.altEngine = Matter.Engine.create({
      gravity: { x: 0, y: 0 },
      enableSleeping: true,
      positionIterations: 8,
      constraintIterations: 4,
    })

    // Create alt recipe with modified pressure
    const altRecipe: SceneRecipe = { ...recipe, pressure: altPressure, id: recipe.id + '_alt' }
    const altCtx: SceneCtx = {
      app: ctx.app,
      matterEngine: this.altEngine,
      anchors: ctx.anchors,
    }
    this.altScene = this.factory(altRecipe, altCtx)

    // Mask the alt scene to the right half
    const altContainer = (this.altScene as any)?.container as PIXI.Container | undefined
    if (altContainer && this.splitRenderer) {
      const rightMask = this.splitRenderer.getRightMask()
      ctx.app.stage.addChild(rightMask)
      altContainer.mask = rightMask
    }

    this.comparing = true
  }

  /** Disable compare mode and clean up the alt scene. */
  disableCompare() {
    if (!this.comparing) return

    // Remove mask from active scene
    const activeContainer = (this.active as any)?.container as PIXI.Container | undefined
    if (activeContainer) {
      activeContainer.mask = null
    }

    // Dispose alt scene
    if (this.altScene) {
      this.altScene.dispose()
      this.altScene = null
    }

    // Clear alt engine
    if (this.altEngine) {
      Matter.Engine.clear(this.altEngine)
      this.altEngine = null
    }

    // Dispose split renderer
    if (this.splitRenderer) {
      this.splitRenderer.dispose()
      this.splitRenderer = null
    }

    this.comparing = false
  }

  /** Whether compare mode is active. */
  isComparing(): boolean {
    return this.comparing
  }

  /** Update the active scene (and alt scene in compare mode). */
  update(dt: number) {
    this.active?.update(dt)
    if (this.comparing) {
      if (this.altEngine) {
        Matter.Engine.update(this.altEngine, dt * 1000)
      }
      this.altScene?.update(dt)
      this.splitRenderer?.update()
    }
  }

  /** Resize the active scene. */
  resize() {
    this.active?.resize()
    this.altScene?.resize()
  }

  /** Hard reset — dispose active scene and clear Matter bodies. */
  reset(ctx?: SceneCtx) {
    this.disableCompare()
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
