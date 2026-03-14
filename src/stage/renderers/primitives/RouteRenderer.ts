import * as PIXI from 'pixi.js'

/**
 * RouteRenderer — animated dashed route lines with directional flow and soft glows.
 *
 * Three rendering layers: outer glow (additive), mid glow, core dashed line.
 * Optional pulse dot traveling the route.
 * All drawing uses PIXI.Graphics (v7 legacy API).
 */

export interface RouteConfig {
  path: { x: number; y: number }[]
  color: number
  width?: number
  speed?: number
  glowWidth?: number
  alpha?: number
  pulseEnabled?: boolean
  dashLength?: number
  gapLength?: number
}

interface ActiveRoute {
  config: RouteConfig
  dashOffset: number
  pulseT: number
  segmentLengths: number[]
  totalLength: number
}

export class RouteRenderer {
  private container: PIXI.Container
  private glowGfx: PIXI.Graphics
  private coreGfx: PIXI.Graphics
  private pulseGfx: PIXI.Graphics
  private routes: ActiveRoute[] = []

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container()
    parent.addChild(this.container)

    this.glowGfx = new PIXI.Graphics()
    this.glowGfx.blendMode = PIXI.BLEND_MODES.ADD
    this.container.addChild(this.glowGfx)

    this.coreGfx = new PIXI.Graphics()
    this.container.addChild(this.coreGfx)

    this.pulseGfx = new PIXI.Graphics()
    this.pulseGfx.blendMode = PIXI.BLEND_MODES.ADD
    this.container.addChild(this.pulseGfx)
  }

  addRoute(config: RouteConfig) {
    const path = config.path
    if (path.length < 2) return

    const segmentLengths: number[] = []
    let totalLength = 0
    for (let i = 0; i < path.length - 1; i++) {
      const dx = path[i + 1].x - path[i].x
      const dy = path[i + 1].y - path[i].y
      const len = Math.sqrt(dx * dx + dy * dy)
      segmentLengths.push(len)
      totalLength += len
    }

    this.routes.push({
      config,
      dashOffset: 0,
      pulseT: 0,
      segmentLengths,
      totalLength,
    })
  }

  clearRoutes() {
    this.routes = []
    this.glowGfx.clear()
    this.coreGfx.clear()
    this.pulseGfx.clear()
  }

  update(dt: number) {
    this.glowGfx.clear()
    this.coreGfx.clear()
    this.pulseGfx.clear()

    for (const route of this.routes) {
      const { config } = route
      const path = config.path
      const width = config.width ?? 2
      const speed = config.speed ?? 1
      const glowMul = config.glowWidth ?? 3
      const alpha = config.alpha ?? 0.6
      const dashLen = config.dashLength ?? 8
      const gapLen = config.gapLength ?? 5
      const color = config.color

      // Advance dash offset
      route.dashOffset += speed * dt * 60
      if (route.dashOffset > dashLen + gapLen) {
        route.dashOffset -= dashLen + gapLen
      }

      // ── Outer glow layer ──
      this.glowGfx.lineStyle(width * glowMul, color, alpha * 0.08)
      this.glowGfx.moveTo(path[0].x, path[0].y)
      for (let i = 1; i < path.length; i++) this.glowGfx.lineTo(path[i].x, path[i].y)

      // ── Mid glow ──
      this.glowGfx.lineStyle(width * glowMul * 0.5, color, alpha * 0.15)
      this.glowGfx.moveTo(path[0].x, path[0].y)
      for (let i = 1; i < path.length; i++) this.glowGfx.lineTo(path[i].x, path[i].y)

      // ── Core dashed line ──
      this.drawDashedPath(path, color, alpha, width, dashLen, gapLen, route.dashOffset, route)

      // ── Pulse dot ──
      if (config.pulseEnabled !== false) {
        route.pulseT += speed * dt * 0.3
        if (route.pulseT > 1) route.pulseT -= 1

        const pos = this.getPointAtT(path, route.pulseT, route)
        if (pos) {
          this.pulseGfx.beginFill(color, 0.7)
          this.pulseGfx.drawCircle(pos.x, pos.y, width * 1.5)
          this.pulseGfx.endFill()
          this.pulseGfx.beginFill(0xffffff, 0.4)
          this.pulseGfx.drawCircle(pos.x, pos.y, width * 0.8)
          this.pulseGfx.endFill()
        }
      }
    }
  }

  private drawDashedPath(
    path: { x: number; y: number }[],
    color: number, alpha: number, width: number,
    dashLen: number, gapLen: number, offset: number,
    route: ActiveRoute,
  ) {
    const cycle = dashLen + gapLen
    let traveled = -offset

    for (let i = 0; i < path.length - 1; i++) {
      const p0 = path[i]
      const p1 = path[i + 1]
      const segLen = route.segmentLengths[i]
      if (segLen < 0.1) continue

      const dx = (p1.x - p0.x) / segLen
      const dy = (p1.y - p0.y) / segLen

      let pos = 0
      while (pos < segLen) {
        const cyclePos = ((traveled + pos) % cycle + cycle) % cycle
        const isDash = cyclePos < dashLen

        if (isDash) {
          const remaining = dashLen - cyclePos
          const segRemaining = segLen - pos
          const drawLen = Math.min(remaining, segRemaining)

          const sx = p0.x + dx * pos
          const sy = p0.y + dy * pos
          const ex = p0.x + dx * (pos + drawLen)
          const ey = p0.y + dy * (pos + drawLen)

          this.coreGfx.lineStyle(width, color, alpha)
          this.coreGfx.moveTo(sx, sy)
          this.coreGfx.lineTo(ex, ey)

          pos += drawLen
        } else {
          const remaining = gapLen - (cyclePos - dashLen)
          pos += Math.min(remaining, segLen - pos)
        }

        if (pos >= segLen - 0.01) break
      }

      traveled += segLen
    }

    this.coreGfx.lineStyle(0)
  }

  private getPointAtT(
    path: { x: number; y: number }[],
    t: number,
    route: ActiveRoute,
  ): { x: number; y: number } | null {
    if (route.totalLength < 1) return null
    const targetDist = t * route.totalLength
    let acc = 0
    for (let i = 0; i < path.length - 1; i++) {
      const segLen = route.segmentLengths[i]
      if (acc + segLen >= targetDist) {
        const localT = (targetDist - acc) / segLen
        return {
          x: path[i].x + (path[i + 1].x - path[i].x) * localT,
          y: path[i].y + (path[i + 1].y - path[i].y) * localT,
        }
      }
      acc += segLen
    }
    return path[path.length - 1]
  }

  setVisible(visible: boolean) { this.container.visible = visible }

  dispose() {
    this.clearRoutes()
    this.container.destroy({ children: true })
  }
}
