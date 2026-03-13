import gsap from 'gsap'
import type { FlowBandRenderer } from '../../stage/renderers/FlowBandRenderer'
import type { CongestionRenderer } from '../../stage/renderers/CongestionRenderer'
import type { FilamentRenderer } from '../../stage/renderers/FilamentRenderer'
import type { PulseRenderer } from '../../stage/renderers/PulseRenderer'
import type { MarginRenderer } from '../../stage/renderers/MarginRenderer'
import type { LensId } from '../../state/machine/worldContext'

/**
 * MorphController — transitions between visual species + propagates parameters.
 *
 * WorldVisualState flows to ALL renderers so every tray control
 * creates visible changes in the mounted world.
 *
 * GSAP cross-fade: outgoing lens fades to ghost weight,
 * incoming lens scales up from ghost weight to 1.0.
 * All lenses stay visible at their dominance weights —
 * no hard on/off switching.
 */

export interface MorphRenderers {
  flowBands: FlowBandRenderer
  congestion: CongestionRenderer
  filaments: FilamentRenderer
  pulses: PulseRenderer
  margins: MarginRenderer
}

/** Full visual state pushed to every renderer each frame. */
export interface WorldVisualState {
  pressure: number        // 0–1.5, time × future combined
  constricted: boolean    // chokepoint blocked
  supplyLevel: number     // 0–1, medicine shelf
  erosion: number         // 0–1, margin erosion
  perspective: 'nurse' | 'driver' | null
  activeLens: LensId
}

const LENS_ORDER: LensId[] = ['shipping', 'freight', 'medicine', 'household']

/** Current alpha state for GSAP tweening */
interface LensAlphas {
  shipping: number
  freight: number
  medicine: number
  household: number
}

export class MorphController {
  private renderers: MorphRenderers
  private currentLens: LensId = 'shipping'
  private transitioning = false
  private activeTween: gsap.core.Timeline | null = null
  private state: WorldVisualState = {
    pressure: 0.5,
    constricted: false,
    supplyLevel: 1,
    erosion: 0,
    perspective: null,
    activeLens: 'shipping',
  }

  /** Live alpha values — GSAP tweens this object, we apply each frame */
  private alphas: LensAlphas = {
    shipping: 1.0,
    freight: 0.1,
    medicine: 0.08,
    household: 0.06,
  }

  constructor(renderers: MorphRenderers) {
    this.renderers = renderers
  }

  getCurrentLens(): LensId {
    return this.currentLens
  }

  /**
   * Push full visual state to all renderers.
   * Called by PixiStage when any tray control changes.
   */
  setVisualState(partial: Partial<WorldVisualState>) {
    Object.assign(this.state, partial)
    this.propagate()
  }

  /**
   * Propagate pressure to all renderers.
   * Timeline + future combine into this single value.
   */
  setPressure(pressure: number) {
    this.state.pressure = pressure
    this.propagate()
  }

  /**
   * Propagate perspective to all renderers.
   * "See through..." changes visual emphasis per role.
   */
  setPerspective(role: 'nurse' | 'driver' | null) {
    this.state.perspective = role
    this.propagate()
  }

  private propagate() {
    const { pressure, perspective } = this.state
    this.renderers.flowBands.setPressure(pressure)
    this.renderers.congestion.setPressure(pressure)
    this.renderers.pulses.setPressure(pressure)
    this.renderers.margins.setPressure(pressure)

    this.renderers.flowBands.setPerspective(perspective)
    this.renderers.congestion.setPerspective(perspective)
    this.renderers.pulses.setPerspective(perspective)
    this.renderers.margins.setPerspective(perspective)
  }

  /**
   * Apply current alpha values to renderer containers.
   * Called from the Pixi ticker so transitions are smooth.
   */
  applyAlphas() {
    this.renderers.flowBands.setAlpha(this.alphas.shipping)
    this.renderers.congestion.setAlpha(this.alphas.freight)
    this.renderers.pulses.setAlpha(this.alphas.medicine)
    this.renderers.margins.setAlpha(this.alphas.household)

    // Filaments visible during medicine + freight lenses
    const filAlpha = Math.max(this.alphas.medicine, this.alphas.freight) * 0.5
    this.renderers.filaments.setAlpha(filAlpha)
  }

  /**
   * GSAP-animated cross-fade between lenses.
   * Outgoing lens fades to its ghost weight.
   * Incoming lens fades up to 1.0.
   * All other lenses tween to their dominance weights.
   */
  morphTo(targetLens: LensId, duration = 1.2): Promise<void> {
    if (targetLens === this.currentLens && !this.transitioning) {
      return Promise.resolve()
    }

    // Kill any running transition
    if (this.activeTween) {
      this.activeTween.kill()
      this.activeTween = null
    }

    this.transitioning = true
    this.currentLens = targetLens
    this.state.activeLens = targetLens

    const targetAlphas = MorphController.LENS_WEIGHTS[targetLens]

    // Make sure all renderers are visible (alpha controls opacity, not visibility)
    this.renderers.flowBands.setVisible(true)
    this.renderers.congestion.setVisible(true)
    this.renderers.pulses.setVisible(true)
    this.renderers.margins.setVisible(true)
    this.renderers.filaments.setVisible(true)

    return new Promise(resolve => {
      const tl = gsap.timeline({
        onUpdate: () => this.applyAlphas(),
        onComplete: () => {
          this.transitioning = false
          this.activeTween = null
          // Hide renderers with very low alpha to save draw calls
          this.renderers.flowBands.setVisible(this.alphas.shipping > 0.04)
          this.renderers.congestion.setVisible(this.alphas.freight > 0.04)
          this.renderers.pulses.setVisible(this.alphas.medicine > 0.04)
          this.renderers.margins.setVisible(this.alphas.household > 0.04)
          this.renderers.filaments.setVisible(
            targetLens === 'medicine' || targetLens === 'freight',
          )
          resolve()
        },
      })

      // Tween all alphas to their target dominance weights
      tl.to(this.alphas, {
        shipping: targetAlphas.shipping,
        freight: targetAlphas.freight,
        medicine: targetAlphas.medicine,
        household: targetAlphas.household,
        duration,
        ease: 'power2.inOut',
      })

      this.activeTween = tl
    })
  }

  async autoMorph(delayBetween = 2): Promise<void> {
    const startIdx = LENS_ORDER.indexOf(this.currentLens)
    for (let i = startIdx + 1; i < LENS_ORDER.length; i++) {
      await new Promise(r => setTimeout(r, delayBetween * 1000))
      await this.morphTo(LENS_ORDER[i])
    }
  }

  /**
   * Lens dominance weights. Active lens is strong;
   * secondary context lenses are ghosted; others are near-invisible.
   */
  /**
   * Active lens: 1.0 — dominant, fully visible.
   * Secondary context: 0.15–0.22 — ghosted but present.
   * Others: 0.04–0.08 — near-invisible background.
   * The selected lens must be OBVIOUS immediately.
   */
  private static LENS_WEIGHTS: Record<LensId, Record<LensId, number>> = {
    shipping: { shipping: 1.0, freight: 0.15, medicine: 0.06, household: 0.04 },
    freight:  { shipping: 0.22, freight: 1.0, medicine: 0.08, household: 0.06 },
    medicine: { shipping: 0.06, freight: 0.15, medicine: 1.0, household: 0.08 },
    household:{ shipping: 0.04, freight: 0.06, medicine: 0.08, household: 1.0 },
  }

  /**
   * Instant snap to lens weights (no animation).
   * Used for initial setup.
   */
  showOnly(lens: LensId) {
    const weights = MorphController.LENS_WEIGHTS[lens]
    this.alphas.shipping = weights.shipping
    this.alphas.freight = weights.freight
    this.alphas.medicine = weights.medicine
    this.alphas.household = weights.household

    this.renderers.flowBands.setVisible(weights.shipping > 0.04)
    this.renderers.congestion.setVisible(weights.freight > 0.04)
    this.renderers.filaments.setVisible(lens === 'medicine' || lens === 'freight')
    this.renderers.pulses.setVisible(weights.medicine > 0.04)
    this.renderers.margins.setVisible(weights.household > 0.04)

    this.applyAlphas()
    this.currentLens = lens
    this.state.activeLens = lens
  }

  private getRendererForLens(lens: LensId) {
    switch (lens) {
      case 'shipping': return this.renderers.flowBands
      case 'freight': return this.renderers.congestion
      case 'medicine': return this.renderers.pulses
      case 'household': return this.renderers.margins
    }
  }
}
