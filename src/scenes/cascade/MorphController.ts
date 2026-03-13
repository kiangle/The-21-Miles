import gsap from 'gsap'
import type { FlowBandRenderer } from '../../stage/renderers/FlowBandRenderer'
import type { CongestionRenderer } from '../../stage/renderers/CongestionRenderer'
import type { FilamentRenderer } from '../../stage/renderers/FilamentRenderer'
import type { PulseRenderer } from '../../stage/renderers/PulseRenderer'
import type { MarginRenderer } from '../../stage/renderers/MarginRenderer'
import type { LensId } from '../../state/machine/worldContext'

/**
 * MorphController — transitions between visual species.
 *
 * shipping (flow bands) → freight (congestion) → import stress (filaments)
 * → medicine (pulses) → household (margin erosion)
 *
 * GSAP morphs the visual style. The cascade MUST change form as it crosses domains.
 */

export interface MorphRenderers {
  flowBands: FlowBandRenderer
  congestion: CongestionRenderer
  filaments: FilamentRenderer
  pulses: PulseRenderer
  margins: MarginRenderer
}

const LENS_ORDER: LensId[] = ['shipping', 'freight', 'medicine', 'household']

export class MorphController {
  private renderers: MorphRenderers
  private currentLens: LensId = 'shipping'
  private transitioning = false

  constructor(renderers: MorphRenderers) {
    this.renderers = renderers
  }

  getCurrentLens(): LensId {
    return this.currentLens
  }

  /**
   * Morph from current visual species to the target lens.
   * Uses GSAP for smooth transitions.
   */
  morphTo(targetLens: LensId, duration = 1.5): Promise<void> {
    if (this.transitioning || targetLens === this.currentLens) {
      return Promise.resolve()
    }

    this.transitioning = true
    const from = this.currentLens
    this.currentLens = targetLens

    return new Promise(resolve => {
      // Fade out current
      const fadeOutTarget = this.getRendererForLens(from)
      const fadeInTarget = this.getRendererForLens(targetLens)

      const tl = gsap.timeline({
        onComplete: () => {
          this.transitioning = false
          resolve()
        },
      })

      // Fade out current species
      tl.to({}, {
        duration: duration * 0.4,
        onComplete: () => {
          fadeOutTarget.setVisible(false)
        },
      })

      // Fade in new species
      tl.call(() => {
        fadeInTarget.setVisible(true)
      })

      tl.to({}, {
        duration: duration * 0.6,
      })
    })
  }

  /**
   * Auto-morph through the cascade sequence: shipping → freight → medicine → household
   */
  async autoMorph(delayBetween = 2): Promise<void> {
    const startIdx = LENS_ORDER.indexOf(this.currentLens)
    for (let i = startIdx + 1; i < LENS_ORDER.length; i++) {
      await new Promise(r => setTimeout(r, delayBetween * 1000))
      await this.morphTo(LENS_ORDER[i])
    }
  }

  showOnly(lens: LensId) {
    this.renderers.flowBands.setVisible(lens === 'shipping')
    this.renderers.congestion.setVisible(lens === 'freight')
    this.renderers.filaments.setVisible(lens === 'medicine' || lens === 'freight')
    this.renderers.pulses.setVisible(lens === 'medicine')
    this.renderers.margins.setVisible(lens === 'household')
    this.currentLens = lens
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
