import type { SceneRecipe } from '../SceneRecipe'
import type { ActiveScene, SceneCtx } from '../SceneRecipeController'

/**
 * MonthScene — "Your month" compression chamber.
 *
 * This is a stub — the actual CompressionChamber is rendered as a React overlay
 * by CompressionChamber.tsx. This scene just ensures no other Pixi actors
 * are alive during the yourMonth phase.
 */

export class MonthScene implements ActiveScene {
  readonly id: string

  constructor(recipe: SceneRecipe, _ctx: SceneCtx) {
    this.id = recipe.id
  }

  update(_dt: number) {
    // CompressionChamber overlay handles rendering
  }

  resize() {}

  dispose() {
    // Nothing to clean up — overlay handles its own lifecycle
  }
}
