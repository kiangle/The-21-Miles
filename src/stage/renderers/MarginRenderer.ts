import * as PIXI from 'pixi.js'
import { COLORS } from '../../app/config/constants'

/**
 * MarginRenderer — Food lens.
 *
 * Human question: Why is my month shrinking?
 *
 * Shows: broad distributed spread, market/household sinks, many small flows,
 * thinning and competition, monthly squeeze. Basket/crate-shaped anchors
 * mark market and household nodes. Flow particles thin as they branch outward.
 * Pressure coloration shows squeeze.
 */

interface DistributionFlow {
  graphic: PIXI.Graphics
  path: { x: number; y: number }[]
  particles: { progress: number; speed: number }[]
  isTerminal: boolean // ends at a household sink
}

interface MarketNode {
  graphic: PIXI.Graphics
  x: number
  y: number
  label: string
  fillLevel: number
  targetFill: number
}

export class MarginRenderer {
  private container: PIXI.Container
  private flows: DistributionFlow[] = []
  private marketNodes: MarketNode[] = []
  private erosion = 0
  private pressure = 0.5
  private perspective: 'nurse' | 'driver' | null = null

  // Backward compat: old erosion bands
  private bands: { graphic: PIXI.Graphics; from: { x: number; y: number }; to: { x: number; y: number }; intensity: number; phase: number }[] = []

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container()
    parent.addChild(this.container)
    this.container.visible = false
  }

  setErosion(pct: number) {
    this.erosion = Math.max(0, Math.min(1, pct / 100))
  }

  setPressure(p: number) {
    this.pressure = Math.max(0, Math.min(1.5, p))
  }

  setPerspective(role: 'nurse' | 'driver' | null) {
    this.perspective = role
  }

  /**
   * Add a distribution flow path (port → market → household)
   */
  addDistributionFlow(path: { x: number; y: number }[], particleCount: number, isTerminal = false) {
    const graphic = new PIXI.Graphics()
    this.container.addChild(graphic)
    const particles: { progress: number; speed: number }[] = []
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        progress: Math.random(),
        speed: 0.0006 + Math.random() * 0.001,
      })
    }
    this.flows.push({ graphic, path, particles, isTerminal })
  }

  /**
   * Add a market/household node anchor
   */
  addMarketNode(x: number, y: number, label: string) {
    const graphic = new PIXI.Graphics()
    this.container.addChild(graphic)
    this.marketNodes.push({ graphic, x, y, label, fillLevel: 1, targetFill: 1 })
  }

  // Backward compat
  addBand(from: { x: number; y: number }, to: { x: number; y: number }) {
    const g = new PIXI.Graphics()
    this.container.addChild(g)
    this.bands.push({ graphic: g, from, to, intensity: 0.5 + Math.random() * 0.5, phase: Math.random() * Math.PI * 2 })
  }

  update(delta: number) {
    const time = Date.now() * 0.001
    const dt = delta / 60

    // ── Distribution flows ──
    for (const flow of this.flows) {
      flow.graphic.clear()
      const path = flow.path
      const totalSegs = path.length - 1
      if (totalSegs < 1) continue

      // Draw flow line — thins with pressure
      const lineAlpha = flow.isTerminal ? 0.15 : 0.2
      const lineWidth = flow.isTerminal ? 1 : 1.5
      flow.graphic.lineStyle(lineWidth, PIXI.utils.string2hex(COLORS.household), lineAlpha)
      flow.graphic.moveTo(path[0].x, path[0].y)
      for (let i = 1; i < path.length; i++) flow.graphic.lineTo(path[i].x, path[i].y)

      // Draw particles — thinning effect under pressure
      const activePct = Math.max(0.2, 1 - this.pressure * 0.5)
      const activeCount = Math.floor(flow.particles.length * activePct)

      for (let i = 0; i < flow.particles.length; i++) {
        const p = flow.particles[i]
        p.progress += p.speed * (1 - this.pressure * 0.3) * delta * 60
        if (p.progress > 1) p.progress -= 1

        // Only draw active particles (rest are "squeezed out")
        if (i >= activeCount) continue

        const t = p.progress
        const seg = Math.min(Math.floor(t * totalSegs), totalSegs - 1)
        const lt = (t * totalSegs) - seg
        const x = path[seg].x + (path[seg + 1].x - path[seg].x) * lt
        const y = path[seg].y + (path[seg + 1].y - path[seg].y) * lt

        // Basket/crate hint for food particles
        const sz = 2
        const pressureColor = this.pressure > 0.6 ? 0xD4763C : PIXI.utils.string2hex(COLORS.household)
        flow.graphic.beginFill(pressureColor, 0.6)
        // Trapezoid basket shape
        flow.graphic.moveTo(x - sz, y - sz * 0.5)
        flow.graphic.lineTo(x + sz, y - sz * 0.5)
        flow.graphic.lineTo(x + sz * 0.8, y + sz * 0.5)
        flow.graphic.lineTo(x - sz * 0.8, y + sz * 0.5)
        flow.graphic.closePath()
        flow.graphic.endFill()
      }
    }

    // ── Market/household nodes ──
    for (const node of this.marketNodes) {
      node.targetFill = Math.max(0.1, 1 - this.pressure * 0.6)
      node.fillLevel += (node.targetFill - node.fillLevel) * 0.03
      node.graphic.clear()

      // Basket anchor shape
      const sz = 6
      const alpha = 0.4 + node.fillLevel * 0.4
      const color = node.fillLevel > 0.5 ? PIXI.utils.string2hex(COLORS.household) : PIXI.utils.string2hex(COLORS.importStress)

      // Trapezoid basket
      node.graphic.beginFill(color, alpha * 0.3)
      node.graphic.moveTo(node.x - sz, node.y - sz * 0.6)
      node.graphic.lineTo(node.x + sz, node.y - sz * 0.6)
      node.graphic.lineTo(node.x + sz * 0.7, node.y + sz * 0.6)
      node.graphic.lineTo(node.x - sz * 0.7, node.y + sz * 0.6)
      node.graphic.closePath()
      node.graphic.endFill()

      // Fill indicator
      node.graphic.lineStyle(1, color, alpha)
      node.graphic.moveTo(node.x - sz, node.y - sz * 0.6)
      node.graphic.lineTo(node.x + sz, node.y - sz * 0.6)
      node.graphic.lineTo(node.x + sz * 0.7, node.y + sz * 0.6)
      node.graphic.lineTo(node.x - sz * 0.7, node.y + sz * 0.6)
      node.graphic.closePath()

      // Pressure halo
      if (this.pressure > 0.5) {
        const halo = 0.15 * this.pressure
        node.graphic.lineStyle(1, PIXI.utils.string2hex(COLORS.importStress), halo)
        node.graphic.drawCircle(node.x, node.y, sz * 2 + Math.sin(time * 2) * 2)
      }
    }

    // ── Old erosion bands (backward compat) ──
    for (const band of this.bands) {
      band.graphic.clear()
      const erosionColor = this.erosion > 0.5 ? COLORS.rupture : COLORS.gold
      const shimmer = 0.3 + 0.3 * Math.sin(time * 2 + band.phase)
      const width = 2 + this.erosion * 4 + this.pressure * 2

      band.graphic.lineStyle(width, PIXI.utils.string2hex(erosionColor), shimmer * band.intensity)
      band.graphic.moveTo(band.from.x, band.from.y)
      const mid = {
        x: (band.from.x + band.to.x) / 2 + Math.sin(time + band.phase) * 5 * this.erosion,
        y: (band.from.y + band.to.y) / 2 + Math.cos(time + band.phase) * 5 * this.erosion,
      }
      band.graphic.quadraticCurveTo(mid.x, mid.y, band.to.x, band.to.y)
    }

    // Both perspectives see food, but Amara's view emphasizes downstream
    this.container.alpha = this.perspective === 'nurse' ? 0.9 : 0.8
  }

  setVisible(visible: boolean) {
    this.container.visible = visible
  }

  clear() {
    this.flows.forEach(f => f.graphic.destroy())
    this.flows = []
    this.marketNodes.forEach(n => n.graphic.destroy())
    this.marketNodes = []
    this.bands.forEach(b => b.graphic.destroy())
    this.bands = []
  }

  dispose() {
    this.clear()
    this.container.destroy({ children: true })
  }
}
