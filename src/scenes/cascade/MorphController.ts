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
 * Pressure and perspective flow to ALL renderers so every tray control
 * creates visible changes in the mounted world.
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
   * Propagate pressure to all renderers.
   * Timeline + future combine into this single value.
   */
  setPressure(pressure: number) {
    this.renderers.flowBands.setPressure(pressure)
    this.renderers.congestion.setPressure(pressure)
    this.renderers.pulses.setPressure(pressure)
    this.renderers.margins.setPressure(pressure)
  }

  /**
   * Propagate perspective to all renderers.
   * "See through..." changes visual emphasis per role.
   */
  setPerspective(role: 'nurse' | 'driver' | null) {
    this.renderers.flowBands.setPerspective(role)
    this.renderers.congestion.setPerspective(role)
    this.renderers.pulses.setPerspective(role)
    this.renderers.margins.setPerspective(role)
  }

  morphTo(targetLens: LensId, duration = 1.5): Promise<void> {
    if (this.transitioning || targetLens === this.currentLens) {
      return Promise.resolve()
    }

    this.transitioning = true
    const from = this.currentLens
    this.currentLens = targetLens

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
