import * as PIXI from 'pixi.js'
import { COLORS } from '../../app/config/constants'

/**
 * MarginRenderer — Food lens.
 *
 * Human question: Why is my month shrinking?
 *
 * Shows: broad distributed spread, market/household sinks as soft warm glows,
 * many small circle particles flowing along glowing paths, thinning under
 * pressure. Warmer tones shift from household gold toward orange-stress as
 * pressure rises.
 */

const HOUSEHOLD_HEX = PIXI.utils.string2hex(COLORS.household)
const STRESS_HEX = PIXI.utils.string2hex(COLORS.importStress)

/** Lerp two 0xRRGGBB colors by t (0–1). */
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return (r << 16) | (g << 8) | bl
}

interface DistributionFlow {
  glowGraphic: PIXI.Graphics   // wider dim pass
  lineGraphic: PIXI.Graphics   // narrow bright pass
  path: { x: number; y: number }[]
  particles: { progress: number; speed: number }[]
  isTerminal: boolean
}

interface MarketNode {
  graphic: PIXI.Graphics
  x: number
  y: number
  label: string
  isHousehold: boolean
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

  // Shared graphics for all flow particles (batched draw)
  private particleGraphic: PIXI.Graphics

  // Backward compat: old erosion bands
  private bands: { graphic: PIXI.Graphics; from: { x: number; y: number }; to: { x: number; y: number }; intensity: number; phase: number }[] = []

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container()
    parent.addChild(this.container)
    this.container.visible = false

    this.particleGraphic = new PIXI.Graphics()
    this.container.addChild(this.particleGraphic)
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
   * Add a distribution flow path (port -> market -> household).
   * Drawn as a 2-pass glow line with circle particles.
   */
  addDistributionFlow(path: { x: number; y: number }[], particleCount: number, isTerminal = false) {
    const glowGraphic = new PIXI.Graphics()
    const lineGraphic = new PIXI.Graphics()
    this.container.addChild(glowGraphic)
    this.container.addChild(lineGraphic)
    // Keep particle graphic on top
    this.container.setChildIndex(this.particleGraphic, this.container.children.length - 1)

    const particles: { progress: number; speed: number }[] = []
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        progress: Math.random(),
        speed: 0.0006 + Math.random() * 0.001,
      })
    }
    this.flows.push({ glowGraphic, lineGraphic, path, particles, isTerminal })
  }

  /**
   * Add a market or household node shown as concentric warm glows.
   * Nodes with "household" in the label (case-insensitive) use smaller radii.
   */
  addMarketNode(x: number, y: number, label: string) {
    const graphic = new PIXI.Graphics()
    this.container.addChild(graphic)
    // Keep particle graphic on top
    this.container.setChildIndex(this.particleGraphic, this.container.children.length - 1)

    const isHousehold = /household/i.test(label)
    this.marketNodes.push({ graphic, x, y, label, isHousehold, fillLevel: 1, targetFill: 1 })
  }

  // Backward compat
  addBand(from: { x: number; y: number }, to: { x: number; y: number }) {
    const g = new PIXI.Graphics()
    this.container.addChild(g)
    this.bands.push({ graphic: g, from, to, intensity: 0.5 + Math.random() * 0.5, phase: Math.random() * Math.PI * 2 })
  }

  update(delta: number) {
    const time = Date.now() * 0.001
    const pressureT = Math.min(this.pressure / 1.5, 1)

    // ── Distribution flows (2-pass glow lines + circle particles) ──

    // Clear shared particle graphic
    this.particleGraphic.clear()

    for (const flow of this.flows) {
      flow.glowGraphic.clear()
      flow.lineGraphic.clear()
      const path = flow.path
      const totalSegs = path.length - 1
      if (totalSegs < 1) continue

      const baseWidth = flow.isTerminal ? 1 : 1.5
      // Lines thin under pressure
      const widthScale = Math.max(0.3, 1 - pressureT * 0.5)
      const lineColor = lerpColor(HOUSEHOLD_HEX, STRESS_HEX, pressureT)

      // Pass 1: wider dim glow
      const glowWidth = baseWidth * widthScale * 3
      flow.glowGraphic.lineStyle(glowWidth, lineColor, 0.08)
      flow.glowGraphic.moveTo(path[0].x, path[0].y)
      for (let i = 1; i < path.length; i++) flow.glowGraphic.lineTo(path[i].x, path[i].y)

      // Pass 2: narrow bright core
      const coreWidth = baseWidth * widthScale
      const coreAlpha = flow.isTerminal ? 0.3 : 0.4
      flow.lineGraphic.lineStyle(coreWidth, lineColor, coreAlpha)
      flow.lineGraphic.moveTo(path[0].x, path[0].y)
      for (let i = 1; i < path.length; i++) flow.lineGraphic.lineTo(path[i].x, path[i].y)

      // ── Particles (circles) ──
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

        const particleColor = lerpColor(HOUSEHOLD_HEX, STRESS_HEX, pressureT)
        this.particleGraphic.beginFill(particleColor, 0.6)
        this.particleGraphic.drawCircle(x, y, 1.5)
        this.particleGraphic.endFill()
      }
    }

    // ── Market / household nodes (concentric warm glows) ──
    for (const node of this.marketNodes) {
      node.targetFill = Math.max(0.1, 1 - this.pressure * 0.6)
      node.fillLevel += (node.targetFill - node.fillLevel) * 0.03
      node.graphic.clear()

      const color = lerpColor(HOUSEHOLD_HEX, STRESS_HEX, 1 - node.fillLevel)
      // Glow dims as pressure rises (supply draining)
      const baseAlpha = node.fillLevel

      // Concentric circle radii depend on node type
      const radii = node.isHousehold ? [5, 3, 2] : [8, 5, 3]
      const alphas = [0.10, 0.20, 0.35]

      for (let r = 0; r < radii.length; r++) {
        node.graphic.beginFill(color, alphas[r] * baseAlpha)
        node.graphic.drawCircle(node.x, node.y, radii[r])
        node.graphic.endFill()
      }

      // Pressure halo — outer pulsing ring
      if (this.pressure > 0.3) {
        const pulseRadius = (node.isHousehold ? 8 : 12) + Math.sin(time * 2.5) * 1.5
        const haloAlpha = 0.12 * pressureT * (0.6 + 0.4 * Math.sin(time * 2.5))
        node.graphic.lineStyle(1, STRESS_HEX, Math.max(0, haloAlpha))
        node.graphic.drawCircle(node.x, node.y, pulseRadius)
      }
    }

    // ── Erosion bands (backward compat — thinner, subtle shimmer) ──
    for (const band of this.bands) {
      band.graphic.clear()
      const erosionColor = this.erosion > 0.5 ? COLORS.rupture : COLORS.gold
      const shimmer = 0.15 + 0.15 * Math.sin(time * 2 + band.phase)
      const width = 1 + this.erosion * 2 + this.pressure * 1

      band.graphic.lineStyle(width, PIXI.utils.string2hex(erosionColor), shimmer * band.intensity)
      band.graphic.moveTo(band.from.x, band.from.y)
      const mid = {
        x: (band.from.x + band.to.x) / 2 + Math.sin(time + band.phase) * 5 * this.erosion,
        y: (band.from.y + band.to.y) / 2 + Math.cos(time + band.phase) * 5 * this.erosion,
      }
      band.graphic.quadraticCurveTo(mid.x, mid.y, band.to.x, band.to.y)
    }

    // Perspective alpha
    this.container.alpha = this.perspective === 'nurse' ? 0.9 : 0.8
  }

  setVisible(visible: boolean) {
    this.container.visible = visible
  }

  clear() {
    this.flows.forEach(f => {
      f.glowGraphic.destroy()
      f.lineGraphic.destroy()
    })
    this.flows = []
    this.marketNodes.forEach(n => n.graphic.destroy())
    this.marketNodes = []
    this.bands.forEach(b => b.graphic.destroy())
    this.bands = []
    this.particleGraphic.clear()
  }

  dispose() {
    this.clear()
    this.particleGraphic.destroy()
    this.container.destroy({ children: true })
  }
}
