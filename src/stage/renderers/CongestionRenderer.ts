import * as PIXI from 'pixi.js'
import { COLORS } from '../../app/config/constants'

/**
 * CongestionRenderer — freight stage.
 * Congestion clouds, bunching nodes, pulsing cost tension.
 * Color: yellow-orange.
 */

export class CongestionRenderer {
  private container: PIXI.Container
  private particles: PIXI.Graphics[] = []
  private positions: { x: number; y: number; vx: number; vy: number }[] = []
  private attractorTarget: { x: number; y: number } | null = null
  private accumulated = 0
  private releaseThreshold = 40

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container()
    parent.addChild(this.container)
    this.container.visible = false
  }

  setAttractor(target: { x: number; y: number }) {
    this.attractorTarget = target
  }

  spawn(x: number, y: number) {
    const g = new PIXI.Graphics()
    g.beginFill(PIXI.utils.string2hex(COLORS.freight), 0.7)
    g.drawCircle(0, 0, 2 + Math.random() * 2)
    g.endFill()
    g.x = x
    g.y = y
    this.container.addChild(g)
    this.particles.push(g)
    this.positions.push({
      x, y,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
    })
  }

  update(delta: number) {
    const dt = delta * 60

    for (let i = 0; i < this.particles.length; i++) {
      const pos = this.positions[i]

      if (this.attractorTarget) {
        const dx = this.attractorTarget.x - pos.x
        const dy = this.attractorTarget.y - pos.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 5) {
          const force = 0.00005 * dist
          pos.vx += (dx / dist) * force * dt
          pos.vy += (dy / dist) * force * dt
        } else {
          this.accumulated++
        }
      }

      // Air friction
      pos.vx *= 0.98
      pos.vy *= 0.98

      pos.x += pos.vx * dt
      pos.y += pos.vy * dt

      this.particles[i].x = pos.x
      this.particles[i].y = pos.y

      // Pulse opacity
      this.particles[i].alpha = 0.5 + 0.3 * Math.sin(Date.now() * 0.003 + i)
    }

    // Release pulse when accumulated
    if (this.accumulated >= this.releaseThreshold) {
      this.accumulated = 0
      this.releasePulse()
    }
  }

  private releasePulse() {
    // Push particles outward from attractor
    if (!this.attractorTarget) return
    for (let i = 0; i < this.particles.length; i++) {
      const pos = this.positions[i]
      const dx = pos.x - this.attractorTarget.x
      const dy = pos.y - this.attractorTarget.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 30 && dist > 0) {
        pos.vx += (dx / dist) * 2
        pos.vy += (dy / dist) * 2
      }
    }
  }

  setVisible(visible: boolean) {
    this.container.visible = visible
  }

  clear() {
    this.particles.forEach(p => p.destroy())
    this.particles = []
    this.positions = []
    this.accumulated = 0
  }

  dispose() {
    this.clear()
    this.container.destroy({ children: true })
  }
}
