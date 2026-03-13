import * as PIXI from 'pixi.js'
import { COLORS } from '../../app/config/constants'

/**
 * FlowBandRenderer — Shipping lens.
 *
 * Human question: Where did the ships go?
 *
 * Shows: chokepoint blockage, bunching upstream, reroute around Africa,
 * maritime current, slower longer path. Container-shaped packets move
 * along glow lanes. Queue density blooms near the blockage.
 * Reroute arc activates when pressure builds.
 */

export interface FlowBand {
  container: PIXI.Container
  particles: PIXI.Graphics[]
  path: { x: number; y: number }[]
  progresses: number[]
  speeds: number[]
  active: boolean
  isReroute: boolean
  baseColor: number
}

export class FlowBandRenderer {
  private container: PIXI.Container
  private bands: FlowBand[] = []
  private pressure = 0.5
  private perspective: 'nurse' | 'driver' | null = null
  private constricted = false

  // Anchor nodes
  private chokeRing: PIXI.Graphics
  private portNode: PIXI.Graphics
  private queueBloom: PIXI.Graphics

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container()
    parent.addChild(this.container)

    // Chokepoint ring — visible blockage indicator
    this.chokeRing = new PIXI.Graphics()
    this.container.addChild(this.chokeRing)

    // Port node anchor
    this.portNode = new PIXI.Graphics()
    this.container.addChild(this.portNode)

    // Queue density bloom
    this.queueBloom = new PIXI.Graphics()
    this.container.addChild(this.queueBloom)
  }

  /**
   * Set chokepoint ring position and port node position
   */
  setAnchors(chokepoint: { x: number; y: number }, port: { x: number; y: number }) {
    this.drawChokeRing(chokepoint)
    this.drawPortNode(port)
  }

  private drawChokeRing(pos: { x: number; y: number }) {
    this.chokeRing.clear()
    // Outer warning ring
    this.chokeRing.lineStyle(2, 0xFF3333, 0.4)
    this.chokeRing.drawCircle(pos.x, pos.y, 18)
    // Inner blocked indicator
    this.chokeRing.lineStyle(1, 0xFF3333, 0.6)
    this.chokeRing.drawCircle(pos.x, pos.y, 8)
    // Cross through it — blocked
    this.chokeRing.lineStyle(1.5, 0xFF3333, 0.5)
    this.chokeRing.moveTo(pos.x - 6, pos.y - 6)
    this.chokeRing.lineTo(pos.x + 6, pos.y + 6)
    this.chokeRing.moveTo(pos.x + 6, pos.y - 6)
    this.chokeRing.lineTo(pos.x - 6, pos.y + 6)
  }

  private drawPortNode(pos: { x: number; y: number }) {
    this.portNode.clear()
    this.portNode.beginFill(0xC8A96E, 0.5)
    this.portNode.drawCircle(pos.x, pos.y, 6)
    this.portNode.endFill()
    this.portNode.lineStyle(1, 0xC8A96E, 0.3)
    this.portNode.drawCircle(pos.x, pos.y, 10)
  }

  addBand(
    path: { x: number; y: number }[],
    particleCount: number,
    color: string = COLORS.shipping,
    width: number = 3,
    isReroute = false,
  ): FlowBand {
    const bandContainer = new PIXI.Container()
    this.container.addChild(bandContainer)
    const hexColor = PIXI.utils.string2hex(color)

    // Draw the lane line with glow
    const glow = new PIXI.Graphics()
    glow.lineStyle(width + 4, hexColor, 0.06)
    glow.moveTo(path[0].x, path[0].y)
    for (let i = 1; i < path.length; i++) glow.lineTo(path[i].x, path[i].y)
    bandContainer.addChild(glow)

    const lane = new PIXI.Graphics()
    lane.lineStyle(1, hexColor, 0.2)
    lane.moveTo(path[0].x, path[0].y)
    for (let i = 1; i < path.length; i++) lane.lineTo(path[i].x, path[i].y)
    bandContainer.addChild(lane)

    // Container-shaped packets (small rectangles) instead of circles
    const particles: PIXI.Graphics[] = []
    const progresses: number[] = []
    const speeds: number[] = []

    for (let i = 0; i < particleCount; i++) {
      const g = new PIXI.Graphics()
      // Draw container shape: small rectangle
      const size = width * (0.4 + Math.random() * 0.4)
      g.beginFill(hexColor, 0.85)
      g.drawRect(-size, -size * 0.6, size * 2, size * 1.2)
      g.endFill()
      bandContainer.addChild(g)
      particles.push(g)
      progresses.push(Math.random())
      speeds.push(0.001 + Math.random() * 0.002)
    }

    const band: FlowBand = {
      container: bandContainer, particles, path, progresses, speeds,
      active: true, isReroute, baseColor: hexColor,
    }

    // Reroute bands start with low visibility
    if (isReroute) {
      bandContainer.alpha = 0.15
    }

    this.bands.push(band)
    return band
  }

  setPressure(p: number) {
    this.pressure = Math.max(0, Math.min(1.5, p))
  }

  setPerspective(role: 'nurse' | 'driver' | null) {
    this.perspective = role
  }

  setConstricted(constricted: boolean) {
    this.constricted = constricted
  }

  update(delta: number) {
    const time = Date.now() * 0.001
    const speedMod = this.constricted ? 0.08 : (1.0 - this.pressure * 0.4)

    for (const band of this.bands) {
      if (!band.active) continue
      const path = band.path
      const totalLen = path.length - 1

      // Reroute bands become more visible as pressure increases
      if (band.isReroute) {
        const targetAlpha = this.constricted
          ? Math.min(0.9, 0.2 + this.pressure * 0.7)
          : 0.15
        band.container.alpha += (targetAlpha - band.container.alpha) * 0.02
      }

      const bandSpeed = band.isReroute ? speedMod * 0.6 : speedMod

      for (let i = 0; i < band.particles.length; i++) {
        band.progresses[i] += band.speeds[i] * bandSpeed * delta * 60

        // Queue effect: particles slow down near the start of the path (chokepoint)
        if (!band.isReroute && this.constricted && band.progresses[i] < 0.3) {
          band.progresses[i] -= band.speeds[i] * bandSpeed * delta * 60 * 0.7
        }

        if (band.progresses[i] > 1) band.progresses[i] -= 1
        if (band.progresses[i] < 0) band.progresses[i] += 1

        const t = band.progresses[i]
        const seg = Math.min(Math.floor(t * totalLen), totalLen - 1)
        const localT = (t * totalLen) - seg

        const x = path[seg].x + (path[seg + 1].x - path[seg].x) * localT
        const y = path[seg].y + (path[seg + 1].y - path[seg].y) * localT

        band.particles[i].x = x
        band.particles[i].y = y

        // Bunching opacity: denser near chokepoint
        if (this.constricted && !band.isReroute) {
          const proximity = 1 - Math.min(1, band.progresses[i] / 0.3)
          band.particles[i].alpha = 0.3 + proximity * 0.6
        } else {
          band.particles[i].alpha = 0.75
        }
      }
    }

    // Animate queue bloom near chokepoint
    this.queueBloom.clear()
    if (this.constricted && this.pressure > 0.3) {
      const bloomIntensity = this.pressure * 0.4
      const chokePos = this.bands[0]?.path[0]
      if (chokePos) {
        const pulseR = 20 + Math.sin(time * 2) * 5
        this.queueBloom.beginFill(0xFF5555, bloomIntensity * 0.15)
        this.queueBloom.drawCircle(chokePos.x, chokePos.y, pulseR * this.pressure)
        this.queueBloom.endFill()
        this.queueBloom.lineStyle(1, 0xFF5555, bloomIntensity * 0.3)
        this.queueBloom.drawCircle(chokePos.x, chokePos.y, pulseR * this.pressure * 1.3)
      }
    }

    // Animate chokepoint ring pulse
    if (this.constricted) {
      const pulse = 0.4 + Math.sin(time * 3) * 0.2
      this.chokeRing.alpha = pulse
    } else {
      this.chokeRing.alpha = 0.3
    }

    // Perspective emphasis
    const dimForPerspective = this.perspective === 'nurse' ? 0.5 : 1.0
    this.container.alpha = dimForPerspective
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
