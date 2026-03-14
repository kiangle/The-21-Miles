import * as PIXI from 'pixi.js'
import { COLORS } from '../../app/config/constants'

/**
 * FilamentRenderer — import stress stage.
 * Stretched filaments, discontinuous feed lines.
 * Color: orange-red.
 */

interface Filament {
  line: PIXI.Graphics
  points: { x: number; y: number }[]
  phase: number
  speed: number
}

export class FilamentRenderer {
  private container: PIXI.Container
  private filaments: Filament[] = []

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container()
    parent.addChild(this.container)
    this.container.visible = false
  }

  addFilament(from: { x: number; y: number }, to: { x: number; y: number }, segments = 8) {
    const line = new PIXI.Graphics()
    this.container.addChild(line)

    const points: { x: number; y: number }[] = []
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      points.push({
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
      })
    }

    this.filaments.push({
      line,
      points,
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 1,
    })
  }

  update(delta: number) {
    const time = Date.now() * 0.001

    for (const fil of this.filaments) {
      fil.line.clear()

      // Draw discontinuous dashed filament with wobble
      const color = PIXI.utils.string2hex(COLORS.importStress)

      for (let i = 0; i < fil.points.length - 1; i++) {
        // Create gaps — discontinuous feel
        const gapPhase = Math.sin(time * fil.speed + fil.phase + i * 0.8)
        if (gapPhase < -0.3) continue // gap

        const wobble = Math.sin(time * 2 + i * 1.5 + fil.phase) * 3
        const opacity = 0.3 + 0.4 * Math.abs(Math.sin(time + i * 0.5 + fil.phase))

        fil.line.lineStyle(1.5, color, opacity)
        fil.line.moveTo(fil.points[i].x, fil.points[i].y + wobble)
        fil.line.lineTo(fil.points[i + 1].x, fil.points[i + 1].y + wobble)
      }
    }
  }

  setVisible(visible: boolean) {
    this.container.visible = visible
  }

  setAlpha(alpha: number) {
    this.container.alpha = alpha
  }

  /** No-op — filaments don't respond to pressure. */
  setPressure(_pressure: number) {}

  /** No-op — filaments don't respond to perspective. */
  setPerspective(_perspective: 'nurse' | 'driver' | null) {}

  clear() {
    this.filaments.forEach(f => f.line.destroy())
    this.filaments = []
  }

  /** Hard reset — alias for clear(). Used by SceneRecipeController. */
  reset() { this.clear() }

  dispose() {
    this.clear()
    this.container.destroy({ children: true })
  }
}
