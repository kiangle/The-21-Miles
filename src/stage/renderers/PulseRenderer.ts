import * as PIXI from 'pixi.js'
import { COLORS } from '../../app/config/constants'

/**
 * PulseRenderer — medicine stage.
 * Cadence pulses weakening, narrowing supply rhythm.
 * Color: red-purple.
 */

interface Pulse {
  graphic: PIXI.Graphics
  x: number
  y: number
  phase: number
  baseRadius: number
  strength: number // 0..1, weakens as supply drops
}

export class PulseRenderer {
  private container: PIXI.Container
  private pulses: Pulse[] = []
  private supplyLevel = 1.0 // 1.0 = full, 0 = empty

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container()
    parent.addChild(this.container)
    this.container.visible = false
  }

  setSupplyLevel(pct: number) {
    this.supplyLevel = Math.max(0, Math.min(1, pct / 100))
  }

  addPulsePoint(x: number, y: number) {
    const g = new PIXI.Graphics()
    this.container.addChild(g)
    this.pulses.push({
      graphic: g,
      x, y,
      phase: Math.random() * Math.PI * 2,
      baseRadius: 8 + Math.random() * 6,
      strength: 1,
    })
  }

  update(delta: number) {
    const time = Date.now() * 0.001

    for (const pulse of this.pulses) {
      pulse.graphic.clear()

      // Weaken pulses based on supply level
      pulse.strength = this.supplyLevel

      const radius = pulse.baseRadius * (0.5 + 0.5 * Math.sin(time * 1.5 + pulse.phase))
      const opacity = 0.2 + 0.5 * pulse.strength * Math.abs(Math.sin(time * 1.5 + pulse.phase))

      // Inner glow
      pulse.graphic.beginFill(PIXI.utils.string2hex(COLORS.medicine), opacity * 0.3)
      pulse.graphic.drawCircle(pulse.x, pulse.y, radius * 1.5)
      pulse.graphic.endFill()

      // Main pulse
      pulse.graphic.lineStyle(2 * pulse.strength, PIXI.utils.string2hex(COLORS.medicine), opacity)
      pulse.graphic.drawCircle(pulse.x, pulse.y, radius)

      // Hospital-side pressure glow (when supply is low)
      if (this.supplyLevel < 0.7) {
        const pressureOpacity = (1 - this.supplyLevel) * 0.4
        pulse.graphic.lineStyle(1, 0xCC3366, pressureOpacity)
        pulse.graphic.drawCircle(pulse.x, pulse.y, radius * 2)
      }
    }
  }

  setVisible(visible: boolean) {
    this.container.visible = visible
  }

  clear() {
    this.pulses.forEach(p => p.graphic.destroy())
    this.pulses = []
  }

  dispose() {
    this.clear()
    this.container.destroy({ children: true })
  }
}
