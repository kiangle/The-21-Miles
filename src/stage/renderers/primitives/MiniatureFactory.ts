import * as PIXI from 'pixi.js'

/**
 * MiniatureFactory — shared vector miniature drawing for all renderers.
 *
 * All actors share one visual language:
 * - Tiny, elegant silhouettes (8–24px scale)
 * - Soft glow underglow, not harsh outline
 * - Shape-first with subtle accent details
 * - Work at any rotation/angle
 *
 * Uses PIXI v7 legacy API (beginFill/endFill/lineStyle).
 */

// ── Transform helpers ───────────────────────────────────────────────

function tx(
  pts: [number, number][],
  cx: number, cy: number, angle: number, scale: number,
): [number, number][] {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return pts.map(([px, py]) => {
    const sx = px * scale
    const sy = py * scale
    return [sx * cos - sy * sin + cx, sx * sin + sy * cos + cy] as [number, number]
  })
}

function poly(g: PIXI.Graphics, pts: [number, number][], color: number, alpha: number) {
  if (pts.length < 3) return
  g.beginFill(color, alpha)
  g.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1])
  g.closePath()
  g.endFill()
}

function ellipseAt(
  g: PIXI.Graphics, cx: number, cy: number, rx: number, ry: number,
  angle: number, color: number, alpha: number,
) {
  // For small glows, rotation doesn't matter much — draw axis-aligned
  g.beginFill(color, alpha)
  g.drawEllipse(cx, cy, rx, ry)
  g.endFill()
}

// ── Ship miniature (top-down ~18px) ─────────────────────────────────

const SHIP_HULL: [number, number][] = [
  [-8, 0], [-5, -3], [6, -3], [10, 0], [6, 3], [-5, 3],
]
const SHIP_DECK: [number, number][] = [
  [-2, -1.5], [4, -1.5], [4, 1.5], [-2, 1.5],
]

export function drawShipMiniature(
  g: PIXI.Graphics, x: number, y: number, angle: number,
  scale = 1, alpha = 1,
) {
  // Soft underglow
  g.beginFill(0xb9d7ff, 0.06 * alpha)
  g.drawEllipse(x, y, 10 * scale, 5 * scale)
  g.endFill()

  // Hull
  poly(g, tx(SHIP_HULL, x, y, angle, scale), 0xd9ecff, 0.85 * alpha)

  // Deck strip
  poly(g, tx(SHIP_DECK, x, y, angle, scale), 0x8fb8df, 0.65 * alpha)
}

// ── Truck miniature (top-down ~16px) ────────────────────────────────

const TRUCK_CARGO: [number, number][] = [
  [-7, -3], [2, -3], [2, 3], [-7, 3],
]
const TRUCK_CAB: [number, number][] = [
  [2, -2.5], [7, -2.5], [7, 2.5], [2, 2.5],
]
const TRUCK_WHEEL_OFFSETS: [number, number][] = [
  [-5, -3.5], [-5, 3.5], [5, -3.5], [5, 3.5],
]

export function drawTruckMiniature(
  g: PIXI.Graphics, x: number, y: number, angle: number,
  scale = 1, alpha = 1,
) {
  // Soft underglow
  g.beginFill(0xe3b06b, 0.05 * alpha)
  g.drawEllipse(x, y, 9 * scale, 5 * scale)
  g.endFill()

  // Cargo body
  poly(g, tx(TRUCK_CARGO, x, y, angle, scale), 0xe3b06b, 0.8 * alpha)

  // Cab
  poly(g, tx(TRUCK_CAB, x, y, angle, scale), 0xc88f4e, 0.75 * alpha)

  // Tiny wheel dots
  const wheels = tx(TRUCK_WHEEL_OFFSETS, x, y, angle, scale)
  for (const [wx, wy] of wheels) {
    g.beginFill(0x2e2416, 0.7 * alpha)
    g.drawCircle(wx, wy, 1.0 * scale)
    g.endFill()
  }
}

// ── Medicine packet miniature (top-down ~10px) ──────────────────────

const MED_BODY: [number, number][] = [
  [-5, -4], [5, -4], [5, 4], [-5, 4],
]
const MED_CROSS_H: [number, number][] = [
  [-3, -1], [3, -1], [3, 1], [-3, 1],
]
const MED_CROSS_V: [number, number][] = [
  [-1, -3], [1, -3], [1, 3], [-1, 3],
]

export function drawMedicineMiniature(
  g: PIXI.Graphics, x: number, y: number, angle: number,
  scale = 1, alpha = 1,
) {
  // Soft underglow
  g.beginFill(0xd97a86, 0.06 * alpha)
  g.drawCircle(x, y, 7 * scale)
  g.endFill()

  // Body (rounded feel via polygon)
  poly(g, tx(MED_BODY, x, y, angle, scale), 0xd97a86, 0.8 * alpha)

  // Cross marking
  poly(g, tx(MED_CROSS_H, x, y, angle, scale), 0xf6d9de, 0.7 * alpha)
  poly(g, tx(MED_CROSS_V, x, y, angle, scale), 0xf6d9de, 0.7 * alpha)
}

// ── Food crate miniature (top-down ~12px) ───────────────────────────

const FOOD_BODY: [number, number][] = [
  [-6, -4], [6, -4], [6, 4], [-6, 4],
]
const FOOD_SLAT1: [number, number][] = [
  [-4.5, -2.5], [-3, -2.5], [-3, 2.5], [-4.5, 2.5],
]
const FOOD_SLAT2: [number, number][] = [
  [-0.75, -2.5], [0.75, -2.5], [0.75, 2.5], [-0.75, 2.5],
]
const FOOD_SLAT3: [number, number][] = [
  [3, -2.5], [4.5, -2.5], [4.5, 2.5], [3, 2.5],
]

export function drawFoodMiniature(
  g: PIXI.Graphics, x: number, y: number, angle: number,
  scale = 1, alpha = 1,
) {
  // Soft underglow
  g.beginFill(0xd4a15d, 0.05 * alpha)
  g.drawEllipse(x, y, 8 * scale, 5 * scale)
  g.endFill()

  // Crate body
  poly(g, tx(FOOD_BODY, x, y, angle, scale), 0xd4a15d, 0.8 * alpha)

  // Slat markings
  poly(g, tx(FOOD_SLAT1, x, y, angle, scale), 0xf0c17b, 0.45 * alpha)
  poly(g, tx(FOOD_SLAT2, x, y, angle, scale), 0xf0c17b, 0.45 * alpha)
  poly(g, tx(FOOD_SLAT3, x, y, angle, scale), 0xf0c17b, 0.45 * alpha)
}

// ── Wake trail (behind ships) ───────────────────────────────────────

export function drawWake(
  g: PIXI.Graphics, points: { x: number; y: number }[],
  color: number, alpha: number, width: number,
) {
  if (points.length < 2) return
  // Outer dim wake
  g.lineStyle(width * 2, color, alpha * 0.1)
  g.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y)
  // Inner wake
  g.lineStyle(width, color, alpha)
  g.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y)
  g.lineStyle(0)
}

// ── Motion trail (general) ──────────────────────────────────────────

export function drawTrail(
  g: PIXI.Graphics, points: { x: number; y: number }[],
  color: number, alpha: number, width: number,
) {
  if (points.length < 2) return
  for (let i = 0; i < points.length - 1; i++) {
    const t = (i + 1) / points.length
    g.lineStyle(width * t, color, alpha * t)
    g.moveTo(points[i].x, points[i].y)
    g.lineTo(points[i + 1].x, points[i + 1].y)
  }
  g.lineStyle(0)
}

// ── Node glow (ports, depots, clinics, markets, households) ─────────

export function drawNodeGlow(
  g: PIXI.Graphics, x: number, y: number,
  outerR: number, color: number, intensity: number,
) {
  // 3-layer concentric glow
  g.beginFill(color, 0.04 * intensity)
  g.drawCircle(x, y, outerR)
  g.endFill()
  g.beginFill(color, 0.12 * intensity)
  g.drawCircle(x, y, outerR * 0.55)
  g.endFill()
  g.beginFill(color, 0.3 * intensity)
  g.drawCircle(x, y, outerR * 0.25)
  g.endFill()
}

// ── Queue bloom (chokepoint / bottleneck) ───────────────────────────

export function drawQueueBloom(
  g: PIXI.Graphics, x: number, y: number,
  pressure: number, color: number,
) {
  const layers = 6
  for (let i = layers; i >= 0; i--) {
    const r = (6 + i * 5) * pressure
    const a = 0.015 * (layers - i + 1) * pressure
    g.beginFill(color, Math.min(0.12, a))
    g.drawCircle(x, y, r)
    g.endFill()
  }
}

// ── Lane field (dim glow beneath actors along a path) ───────────────

export function drawLaneField(
  g: PIXI.Graphics, path: { x: number; y: number }[],
  color: number, alpha: number, width: number,
) {
  if (path.length < 2) return
  // Outer wide dim
  g.lineStyle(width * 3, color, alpha * 0.15)
  g.moveTo(path[0].x, path[0].y)
  for (let i = 1; i < path.length; i++) g.lineTo(path[i].x, path[i].y)
  // Mid
  g.lineStyle(width * 1.5, color, alpha * 0.3)
  g.moveTo(path[0].x, path[0].y)
  for (let i = 1; i < path.length; i++) g.lineTo(path[i].x, path[i].y)
  // Core
  g.lineStyle(width * 0.5, color, alpha * 0.5)
  g.moveTo(path[0].x, path[0].y)
  for (let i = 1; i < path.length; i++) g.lineTo(path[i].x, path[i].y)
  g.lineStyle(0)
}

// ── Density bloom (where bodies cluster) ────────────────────────────

export function drawDensityBloom(
  g: PIXI.Graphics,
  positions: { x: number; y: number }[],
  cellSize: number,
  color: number,
  threshold = 3,
) {
  const density: Map<string, { count: number; x: number; y: number }> = new Map()
  for (const p of positions) {
    const cx = Math.floor(p.x / cellSize)
    const cy = Math.floor(p.y / cellSize)
    const key = `${cx},${cy}`
    const existing = density.get(key)
    if (existing) {
      existing.count++
    } else {
      density.set(key, { count: 1, x: (cx + 0.5) * cellSize, y: (cy + 0.5) * cellSize })
    }
  }

  for (const [, cell] of density) {
    if (cell.count < threshold) continue
    const intensity = Math.min(1, cell.count / 8)
    g.beginFill(color, intensity * 0.06)
    g.drawCircle(cell.x, cell.y, cellSize * 1.1)
    g.endFill()
    g.beginFill(color, intensity * 0.1)
    g.drawCircle(cell.x, cell.y, cellSize * 0.5)
    g.endFill()
  }
}
