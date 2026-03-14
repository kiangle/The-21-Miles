import Matter from 'matter-js'
import type { SceneRecipe } from './SceneRecipe'

/**
 * SceneRecipeController — enforces the Hard Reset Rule.
 *
 * On every recipe change:
 * 1. Tear down everything from the previous recipe
 * 2. Set up only what the new recipe requires
 * 3. No old motion survives unless intentionally carried forward
 *
 * This is the single authority on what is alive in the Pixi/Matter world.
 */

export interface RecipeRenderer {
  /** Unique identifier matching visibleLayers entries */
  layerId: string
  /** Show/hide the renderer container */
  setVisible(visible: boolean): void
  /** Set alpha for cross-fade */
  setAlpha(alpha: number): void
  /** Set physics pressure 0–1.5 */
  setPressure(pressure: number): void
  /** Set perspective (role-based emphasis) */
  setPerspective(perspective: 'nurse' | 'driver' | null): void
  /** Reset all bodies, emitters, trails — hard cleanup */
  reset(): void
  /** Per-frame update */
  update(dt: number): void
}

export class SceneRecipeController {
  private renderers: Map<string, RecipeRenderer> = new Map()
  private engine: Matter.Engine
  private currentRecipe: SceneRecipe | null = null
  private activeLayerIds: Set<string> = new Set()

  constructor(engine: Matter.Engine) {
    this.engine = engine
  }

  /** Register a renderer by its layer ID. */
  register(layerId: string, renderer: RecipeRenderer) {
    this.renderers.set(layerId, renderer)
  }

  /** Get current active recipe. */
  getActiveRecipe(): SceneRecipe | null {
    return this.currentRecipe
  }

  /**
   * Apply a new recipe. This is the HARD RESET point.
   *
   * 1. Deactivate all layers not in the new recipe
   * 2. Reset their bodies/emitters/trails
   * 3. Activate only the layers the recipe requires
   * 4. Set pressure, perspective, and other state
   */
  applyRecipe(recipe: SceneRecipe) {
    const prev = this.currentRecipe
    this.currentRecipe = recipe

    // ── Step 1: Determine which layers should be active ──
    const newActive = new Set(recipe.visibleLayers)

    // ── Step 2: Deactivate and reset layers that are no longer needed ──
    for (const layerId of this.activeLayerIds) {
      if (!newActive.has(layerId)) {
        const renderer = this.renderers.get(layerId)
        if (renderer) {
          renderer.setVisible(false)
          renderer.setAlpha(0)
          renderer.reset()
        }
      }
    }

    // ── Step 3: Reset Matter.js if recipe phase changed or lens changed ──
    const phaseChanged = !prev || prev.phase !== recipe.phase
    const lensChanged = !prev || prev.lens !== recipe.lens
    if (phaseChanged || lensChanged) {
      // Clear all non-static bodies from the engine
      const allBodies = Matter.Composite.allBodies(this.engine.world)
      const dynamicBodies = allBodies.filter(b => !b.isStatic)
      Matter.Composite.remove(this.engine.world, dynamicBodies)
    }

    // ── Step 4: Activate new layers ──
    for (const layerId of newActive) {
      const renderer = this.renderers.get(layerId)
      if (renderer) {
        // If this layer was not previously active, reset it first
        if (!this.activeLayerIds.has(layerId)) {
          renderer.reset()
        }
        renderer.setVisible(true)
        renderer.setAlpha(1.0)
        renderer.setPressure(recipe.pressure)
        renderer.setPerspective(
          recipe.perspective === 'amara' ? 'nurse'
            : recipe.perspective === 'joseph' ? 'driver'
              : null,
        )
      }
    }

    // ── Step 5: Hide all non-active renderers ──
    for (const [layerId, renderer] of this.renderers) {
      if (!newActive.has(layerId)) {
        renderer.setVisible(false)
        renderer.setAlpha(0)
      }
    }

    this.activeLayerIds = newActive
  }

  /** Update only the active renderers. */
  update(dt: number) {
    // One physics step
    Matter.Engine.update(this.engine, dt * 1000)

    // Only update active renderers
    for (const layerId of this.activeLayerIds) {
      const renderer = this.renderers.get(layerId)
      if (renderer) {
        renderer.update(dt)
      }
    }
  }

  /** Update pressure on active renderers (e.g., from time scrub). */
  setPressure(pressure: number) {
    for (const layerId of this.activeLayerIds) {
      const renderer = this.renderers.get(layerId)
      if (renderer) {
        renderer.setPressure(pressure)
      }
    }
  }

  /** Check if a recipe transition represents a meaningful change. */
  isSignificantChange(recipe: SceneRecipe): boolean {
    if (!this.currentRecipe) return true
    const curr = this.currentRecipe
    return (
      curr.id !== recipe.id ||
      curr.phase !== recipe.phase ||
      curr.lens !== recipe.lens ||
      curr.perspective !== recipe.perspective ||
      curr.time !== recipe.time
    )
  }

  dispose() {
    for (const renderer of this.renderers.values()) {
      renderer.reset()
      renderer.setVisible(false)
    }
    this.renderers.clear()
    this.activeLayerIds.clear()
    this.currentRecipe = null
  }
}
