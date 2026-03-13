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

export class MorphController {
  private renderers: MorphRenderers
  private currentLens: LensId = 'shipping'
  private transitioning = false
  private state: WorldVisualState = {
    pressure: 0.5,
    constricted: false,
    supplyLevel: 1,
    erosion: 0,
    perspective: null,
    activeLens: 'shipping',
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

  morphTo(targetLens: LensId, duration = 1.5): Promise<void> {
    if (this.transitioning || targetLens === this.currentLens) {
      return Promise.resolve()
    }

    this.transitioning = true
    const from = this.currentLens
    this.currentLens = targetLens
    this.state.activeLens = targetLens

    return new Promise(resolve => {
      const fadeOutTarget = this.getRendererForLens(from)
      const fadeInTarget = this.getRendererForLens(targetLens)

      const tl = gsap.timeline({
        onComplete: () => {
          this.transitioning = false
          resolve()
        },
      })

      tl.to({}, {
        duration: duration * 0.4,
        onComplete: () => fadeOutTarget.setVisible(false),
      })

      tl.call(() => fadeInTarget.setVisible(true))

      tl.to({}, { duration: duration * 0.6 })
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
  private static LENS_WEIGHTS: Record<LensId, Record<LensId, number>> = {
    shipping: { shipping: 1.0, freight: 0.10, medicine: 0.08, household: 0.06 },
    freight:  { shipping: 0.18, freight: 1.0, medicine: 0.10, household: 0.08 },
    medicine: { shipping: 0.08, freight: 0.12, medicine: 1.0, household: 0.10 },
    household:{ shipping: 0.06, freight: 0.08, medicine: 0.10, household: 1.0 },
  }

  showOnly(lens: LensId) {
    const weights = MorphController.LENS_WEIGHTS[lens]

    // FlowBands (shipping) — visible if weight > threshold
    this.renderers.flowBands.setVisible(weights.shipping > 0.05)

    // Congestion (freight)
    this.renderers.congestion.setVisible(weights.freight > 0.05)

    // Filaments (import stress) — context for medicine + freight
    this.renderers.filaments.setVisible(lens === 'medicine' || lens === 'freight')

    // Pulses (medicine)
    this.renderers.pulses.setVisible(weights.medicine > 0.05)

    // Margins (household)
    this.renderers.margins.setVisible(weights.household > 0.05)

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
