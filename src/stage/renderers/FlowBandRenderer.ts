import * as PIXI from 'pixi.js'
import { COLORS } from '../../app/config/constants'

/**
 * FlowBandRenderer — shipping / oil / LNG stage.
 * Thick moving flow bands. Convoy particles. Blue-white.
 */

export interface FlowBand {
  container: PIXI.Container
  particles: PIXI.Graphics[]
  path: { x: number; y: number }[]
  progresses: number[]
  speeds: number[]
  active: boolean
}

export class FlowBandRenderer {
  private container: PIXI.Container
  private bands: FlowBand[] = []

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container()
    parent.addChild(this.container)
  }

  addBand(
    path: { x: number; y: number }[],
    particleCount: number,
    color: string = COLORS.shipping,
    width: number = 3,
  ): FlowBand {
    const bandContainer = new PIXI.Container()
    this.container.addChild(bandContainer)

    // Draw the lane line
    const lane = new PIXI.Graphics()
    lane.lineStyle(1, PIXI.utils.string2hex(color), 0.15)
    lane.moveTo(path[0].x, path[0].y)
    for (let i = 1; i < path.length; i++) {
      lane.lineTo(path[i].x, path[i].y)
    }
    bandContainer.addChild(lane)

    // Particles
    const particles: PIXI.Graphics[] = []
    const progresses: number[] = []
    const speeds: number[] = []

    for (let i = 0; i < particleCount; i++) {
      const g = new PIXI.Graphics()
      g.beginFill(PIXI.utils.string2hex(color), 0.8)
      g.drawCircle(0, 0, width * (0.5 + Math.random() * 0.5))
      g.endFill()
      bandContainer.addChild(g)
      particles.push(g)
      progresses.push(Math.random())
      speeds.push(0.001 + Math.random() * 0.002)
    }

    const band: FlowBand = { container: bandContainer, particles, path, progresses, speeds, active: true }
    this.bands.push(band)
    return band
  }

  update(delta: number) {
    for (const band of this.bands) {
      if (!band.active) continue
      const path = band.path
      const totalLen = path.length - 1

      for (let i = 0; i < band.particles.length; i++) {
        band.progresses[i] += band.speeds[i] * delta * 60
        if (band.progresses[i] > 1) band.progresses[i] -= 1

        const t = band.progresses[i]
        const seg = Math.min(Math.floor(t * totalLen), totalLen - 1)
        const localT = (t * totalLen) - seg

        const x = path[seg].x + (path[seg + 1].x - path[seg].x) * localT
        const y = path[seg].y + (path[seg + 1].y - path[seg].y) * localT

        band.particles[i].x = x
        band.particles[i].y = y
      }
    }
  }

  setConstricted(constricted: boolean) {
    for (const band of this.bands) {
      for (const p of band.particles) {
        p.alpha = constricted ? 0.3 : 0.8
      }
      if (constricted) {
        band.speeds = band.speeds.map(s => s * 0.1)
      }
    }
  }

  setVisible(visible: boolean) {
    this.container.visible = visible
  }

  clear() {
    this.bands.forEach(b => b.container.destroy({ children: true }))
    this.bands = []
  }

  dispose() {
    this.clear()
    this.container.destroy({ children: true })
  }
}
