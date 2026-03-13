import * as PIXI from 'pixi.js'
import { COLORS } from '../../app/config/constants'

/**
 * MarginRenderer — household stage.
 * Margin erosion bands, breathing-room collapse.
 * Color: red → gold.
 */

interface ErosionBand {
  graphic: PIXI.Graphics
  from: { x: number; y: number }
  to: { x: number; y: number }
  intensity: number // 0..1
  phase: number
}

export class MarginRenderer {
  private container: PIXI.Container
  private bands: ErosionBand[] = []
  private erosion = 0 // 0..1, how much margin is eaten

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container()
    parent.addChild(this.container)
    this.container.visible = false
  }

  setErosion(pct: number) {
    this.erosion = Math.max(0, Math.min(1, pct / 100))
  }

  addBand(from: { x: number; y: number }, to: { x: number; y: number }) {
    const g = new PIXI.Graphics()
    this.container.addChild(g)
    this.bands.push({
      graphic: g,
      from, to,
      intensity: 0.5 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
    })
  }

  update(delta: number) {
    const time = Date.now() * 0.001

    for (const band of this.bands) {
      band.graphic.clear()

      const erosionColor = this.erosion > 0.5 ? COLORS.rupture : COLORS.gold
      const shimmer = 0.3 + 0.3 * Math.sin(time * 2 + band.phase)
      const width = 2 + this.erosion * 4

      band.graphic.lineStyle(width, PIXI.utils.string2hex(erosionColor), shimmer * band.intensity)
      band.graphic.moveTo(band.from.x, band.from.y)

      // Wobbling erosion band
      const mid = {
        x: (band.from.x + band.to.x) / 2 + Math.sin(time + band.phase) * 5 * this.erosion,
        y: (band.from.y + band.to.y) / 2 + Math.cos(time + band.phase) * 5 * this.erosion,
      }
      band.graphic.quadraticCurveTo(mid.x, mid.y, band.to.x, band.to.y)
    }
  }

  setVisible(visible: boolean) {
    this.container.visible = visible
  }

  clear() {
    this.bands.forEach(b => b.graphic.destroy())
    this.bands = []
  }

  dispose() {
    this.clear()
    this.container.destroy({ children: true })
  }
}
